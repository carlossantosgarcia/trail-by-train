import { useEffect, useState } from 'react';
import {
  armDraw,
  exitExplore,
  exploreFit,
  exploreFlyTo,
  redraw,
  showHikeOnMap,
  useExplore,
} from './store';
import { setTransitHighlight } from '../../transit/highlightStore';
import { ensureManifestLoaded, setSelected } from '../curated-hikes';
import { useIsMobile } from '../../lib/useIsMobile';
import type { ExploreResults, ExploreHike } from './data';
import BottomSheet, { type Snap } from '../../components/BottomSheet';
import { useMapGesture } from '../../lib/mapGestures';
import ExploreRadiusPanel from './ExploreRadiusPanel';
import styles from './ExplorePanel.module.css';
import { CloseIcon } from '../../components/icons/lucide';
import { useT } from '../../i18n';

function onExit() {
  setTransitHighlight(null);
  setSelected(null);
  exitExplore();
}

function onRedraw() {
  setTransitHighlight(null);
  setSelected(null);
  redraw();
}

/** Draw the tapped hike's track on the map and frame it. The info box is not
 * opened here — the user opens it by clicking the track on the map. We preload
 * the curated manifest so that click can render the box. */
function onSelectHike(hike: ExploreHike) {
  void ensureManifestLoaded().catch(() => {});
  showHikeOnMap(hike.id);
  exploreFit(hike.bbox);
}

function ResultsBody({ results }: { results: ExploreResults }) {
  const t = useT();
  return (
    <div className={styles.body}>
      <section className={styles.group}>
        <h4 className={styles.groupTitle}>
          {t('layers.bus')} <span className={styles.count}>{results.totalLines}</span>
        </h4>
        {results.providers.length === 0 ? (
          <p className={styles.emptyLine}>{t('explore.noBus')}</p>
        ) : (
          results.providers.map((p) => (
            <div key={p.providerId} className={styles.providerBlock}>
              <div className={styles.providerLabel}>{p.providerLabel}</div>
              <div className={styles.lineChips}>
                {p.lines.map((line) => (
                  <button
                    key={line.routeId}
                    type="button"
                    className={styles.lineChip}
                    style={{ borderColor: line.color }}
                    onClick={() =>
                      setTransitHighlight({ providerId: p.providerId, routeId: line.routeId })
                    }
                  >
                    <span
                      className={styles.hikeDot}
                      style={{ background: line.color }}
                      aria-hidden
                    />
                    {line.shortName}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className={styles.group}>
        <h4 className={styles.groupTitle}>
          {t('layers.trains')} <span className={styles.count}>{results.stations.length}</span>
        </h4>
        {results.stations.length === 0 ? (
          <p className={styles.emptyLine}>{t('explore.noStation')}</p>
        ) : (
          <ul className={styles.list}>
            {results.stations.map((st) => (
              <li key={`${st.name}-${st.coord[0]}-${st.coord[1]}`}>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => exploreFlyTo(st.coord)}
                >
                  {st.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.group}>
        <h4 className={styles.groupTitle}>
          {t('explore.hikes')} <span className={styles.count}>{results.hikes.length}</span>
        </h4>
        {results.hikes.length === 0 ? (
          <p className={styles.emptyLine}>{t('explore.noHike')}</p>
        ) : (
          <ul className={styles.list}>
            {results.hikes.map((h) => (
              <li key={h.id}>
                <button type="button" className={styles.rowButton} onClick={() => onSelectHike(h)}>
                  <span className={styles.hikeDot} style={{ background: h.colour }} aria-hidden />
                  {h.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Explore-mode chrome: draw prompt, then the results sheet. */
export default function ExplorePanel() {
  const t = useT();
  const s = useExplore();
  const isMobile = useIsMobile();
  // The results open at half; the user can lower them to the summary line to
  // see the region, or raise them to read everything. New results reopen.
  const [snap, setSnap] = useState<Snap>('half');
  const showingResults = s.active && s.phase === 'results';
  useEffect(() => {
    if (showingResults) setSnap('half');
  }, [showingResults, s.results]);
  // Turning to the map lowers them, unless the tap opened something (a hike
  // route), which then layers above.
  useMapGesture(
    (g) => {
      if (g.kind === 'pan' || !g.claimed) setSnap('peek');
    },
    isMobile && showingResults && snap !== 'peek',
  );
  if (!s.active) return null;

  const resultsHeader = (
    <div className={styles.sheetHeader}>
      {s.status === 'loading' && (
        <span className={styles.headerText}>{t('explore.searching')}</span>
      )}
      {s.status === 'error' && (
        <span className={styles.headerText}>{t('explore.error', { error: s.error ?? '' })}</span>
      )}
      {s.status === 'empty' && <span className={styles.headerText}>{t('explore.empty')}</span>}
      {s.status === 'ready' && s.results && (
        <span className={styles.headerText}>
          {t('explore.summary', {
            lines: s.results.totalLines,
            stations: s.results.stations.length,
            hikes: s.results.hikes.length,
          })}
        </span>
      )}
      <button type="button" className={styles.redraw} onClick={onRedraw}>
        {/* Point-seeded regions go back to the slider, not the lasso, so the
            label has to name the control the user will actually get. */}
        {t(s.origin === 'point' ? 'explore.changeRadius' : 'explore.redraw')}
      </button>
    </div>
  );

  return (
    <>
      <div className={styles.topBar}>
        <span className={styles.topTitle}>
          {t(s.origin === 'point' ? 'explore.aroundPoint' : 'explore.button')}
        </span>
        <button
          type="button"
          className={styles.close}
          onClick={onExit}
          aria-label={t('explore.quit')}
          title={t('explore.quit')}
        >
          <CloseIcon />
        </button>
      </div>

      {s.phase === 'radius' && <ExploreRadiusPanel />}

      {s.phase === 'drawing' && (
        <div className={styles.prompt}>
          {s.notice ? (
            <p className={styles.notice}>
              <span className={styles.noticeIcon} aria-hidden>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M8 1.5 15 14H1L8 1.5Z" strokeLinejoin="round" />
                  <path d="M8 6.5v3.2" strokeLinecap="round" />
                  <circle cx="8" cy="11.8" r=".85" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span>{s.notice}</span>
            </p>
          ) : (
            <p className={styles.promptText}>
              {s.armed ? t('explore.promptArmed') : t('explore.promptFrame')}
            </p>
          )}
          {!s.armed && (
            <button type="button" className={styles.primary} onClick={armDraw}>
              {t('explore.draw')}
            </button>
          )}
        </div>
      )}

      {s.phase === 'results' &&
        (isMobile ? (
          // A transient sheet, layered above the persistent one. This is what
          // retired the old workaround: results and a tapped hike used to
          // share a z-index, so the results hid themselves whenever a hike
          // box opened.
          <BottomSheet
            variant="transient"
            snap={snap}
            onSnapChange={setSnap}
            label={t('explore.results')}
            head={resultsHeader}
          >
            {s.status === 'ready' && s.results && <ResultsBody results={s.results} />}
          </BottomSheet>
        ) : (
          <div className={styles.sheet}>
            {resultsHeader}
            {s.status === 'ready' && s.results && <ResultsBody results={s.results} />}
          </div>
        ))}
    </>
  );
}
