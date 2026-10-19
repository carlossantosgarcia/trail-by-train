import { useEffect, useRef, useState, type ReactNode } from 'react';
import TrainIcon from '../../components/icons/TrainIcon';
import BusIcon from '../../components/icons/BusIcon';
import HikeIcon from '../../components/icons/HikeIcon';
import FileIcon from '../../components/icons/FileIcon';
import { ChevronLeftIcon, ChevronRightIcon, LassoSelectIcon } from '../../components/icons/lucide';
import LanguageSwitch from '../../components/LanguageSwitch';
import toggleStyles from '../../components/OverlayToggle.module.css';
import { useIsMobile } from '../../lib/useIsMobile';
import { useLocale, useT } from '../../i18n';
import { enterExplore } from '../explore';
import { addPickedFiles } from '../gpx/pickFiles';
import { closeTutorial, useTutorialOpen } from './store';
import styles from './TutorialDialog.module.css';
// Written by `npm run media -- tutorial-stills` with the map it fits.
import traceDesktop from './hike-trace-desktop.json';
import tracePhone from './hike-trace-phone.json';

const MEDIA = `${import.meta.env.BASE_URL}tutorial/`;
const STEPS = 4;
// A swipe changes step past this many pixels, when mostly horizontal.
const SWIPE_PX = 50;

/**
 * The first-visit tutorial: four picture-led steps, two recorded and two captured. Opens by itself once
 * (see App) and again from the dock's info button.
 */
export default function TutorialDialog() {
  const open = useTutorialOpen();
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Focus the sheet itself, not its first button: no ring on open.
      d.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      tabIndex={-1}
      aria-labelledby="tutorial-title"
      onClose={closeTutorial}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) closeTutorial();
      }}
    >
      {open && <Tutorial />}
    </dialog>
  );
}

function Tutorial() {
  const t = useT();
  const [step, setStep] = useState(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const clamp = (n: number) => Math.max(0, Math.min(STEPS - 1, n));
  const go = (n: number) => setStep(clamp(n));
  const last = step === STEPS - 1;

  // On the window: focus sits on the dialog itself, outside this element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStep((s) => clamp(s + 1));
      else if (e.key === 'ArrowLeft') setStep((s) => clamp(s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={styles.tutorial}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') swipe.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
          go(step + (dx < 0 ? 1 : -1));
        }
      }}
    >
      {/* Their own bar, above the picture, so they never cover it. A first
          visit may land in the wrong language: switch before reading. */}
      <div className={styles.top}>
        <LanguageSwitch />
        <button type="button" className={styles.skip} onClick={closeTutorial}>
          {t('tutorial.skip')}
        </button>
      </div>

      {step === 0 && <ExploreStep />}
      {step === 1 && <TransitStep />}
      {step === 2 && <GpxStep />}
      {step === 3 && <HikesStep />}

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.back}
          onClick={() => go(step - 1)}
          aria-label={t('tutorial.prev')}
          title={t('tutorial.prev')}
          disabled={step === 0}
        >
          <ChevronLeftIcon />
        </button>
        <div className={styles.dots} role="tablist" aria-label={t('tutorial.steps')}>
          {Array.from({ length: STEPS }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={t('tutorial.stepN', { n: i + 1, total: STEPS })}
              className={styles.dot}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.next}
          onClick={() => (last ? closeTutorial() : go(step + 1))}
        >
          <span>{last ? t('tutorial.done') : t('tutorial.next')}</span>
          {!last && <ChevronRightIcon />}
        </button>
      </div>
    </div>
  );
}

function Step({
  hero,
  art = false,
  title,
  children,
}: {
  hero: ReactNode;
  /** A drawing rather than the recorded clip: on a map-coloured band. */
  art?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className={`${styles.hero} ${art ? styles.heroArt : ''}`}>{hero}</div>
      <div className={styles.text}>
        <h2 id="tutorial-title" className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </>
  );
}

/** One of the layer toggles as the controls show it, switched on. */
function Tile({ icon }: { icon: ReactNode }) {
  return (
    <span className={`${toggleStyles.button} ${toggleStyles.active} ${styles.tile}`} aria-hidden>
      <span className={toggleStyles.icon}>{icon}</span>
    </span>
  );
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * A recorded clip in the interface language: a muted looping video (the size
 * of an animated image for a fraction of the bytes), the phone take at the
 * mobile breakpoint, and its last frame as a still with reduced motion.
 * Rendered only while its step shows, so nothing is fetched until then.
 */
function Clip({ base, alt }: { base: 'explore' | 'gpx'; alt: string }) {
  const lang = useLocale();
  const layout = useIsMobile() ? 'phone' : 'desktop';
  const [still] = useState(() => window.matchMedia?.(REDUCED_MOTION).matches ?? false);
  const name = `${MEDIA}${base}-${layout}-${lang}`;
  return (
    <div className={styles.clip}>
      {still ? (
        <img src={`${name}-still.webp`} alt={alt} />
      ) : (
        // Keyed by source: a language or layout change loads the other take.
        <video
          key={name}
          src={`${name}.mp4`}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          aria-label={alt}
        />
      )}
    </div>
  );
}

/** A screenshot of the real app, per language and layout, framed like a clip. */
function Shot({ name, alt }: { name: 'transit'; alt: string }) {
  const lang = useLocale();
  const layout = useIsMobile() ? 'phone' : 'desktop';
  return (
    <div className={styles.clip}>
      <img src={`${MEDIA}${name}-${layout}-${lang}.webp`} alt={alt} />
    </div>
  );
}

function ExploreStep() {
  const t = useT();
  return (
    <Step
      title={t('tutorial.explore.title')}
      hero={<Clip base="explore" alt={t('tutorial.explore.alt')} />}
    >
      <p className={styles.lead}>{t('tutorial.explore.lead')}</p>
      <button
        type="button"
        className={styles.try}
        onClick={() => {
          closeTutorial();
          enterExplore();
        }}
      >
        <LassoSelectIcon />
        <span>{t('tutorial.explore.try')}</span>
      </button>
    </Step>
  );
}

function TransitStep() {
  const t = useT();
  return (
    <Step
      title={t('tutorial.transit.title')}
      hero={<Shot name="transit" alt={t('tutorial.transit.alt')} />}
    >
      <ul className={styles.facts}>
        <li>
          <Tile icon={<TrainIcon />} />
          <span>
            <b>{t('layers.trains')}</b> {t('tutorial.transit.trains')}
          </span>
        </li>
        <li>
          <Tile icon={<BusIcon />} />
          <span>
            <b>{t('layers.bus')}</b> {t('tutorial.transit.buses')}
          </span>
        </li>
      </ul>
      <p className={styles.note}>{t('tutorial.transit.select')}</p>
    </Step>
  );
}

function GpxStep() {
  const t = useT();
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <Step title={t('tutorial.gpx.title')} hero={<Clip base="gpx" alt={t('tutorial.gpx.alt')} />}>
      <p className={styles.lead}>{t('tutorial.gpx.lead')}</p>
      <button type="button" className={styles.try} onClick={() => input.current?.click()}>
        <FileIcon />
        <span>{t('tutorial.gpx.open')}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length === 0) return;
          closeTutorial();
          addPickedFiles(files);
        }}
      />
    </Step>
  );
}

function HikesStep() {
  const t = useT();
  const touch = useIsMobile();
  return (
    <Step title={t('tutorial.hikes.title')} art hero={<HikeMap />}>
      <p className={styles.lead}>{t('tutorial.hikes.lead')}</p>
      <ul className={styles.facts}>
        <li>
          <Tile icon={<HikeIcon />} />
          <span>{t('tutorial.hikes.layer')}</span>
        </li>
      </ul>
      <p className={styles.note}>{t(touch ? 'tutorial.hikes.tap' : 'tutorial.hikes.click')}</p>
    </Step>
  );
}

/* ── The hike step's map ───────────────────────────────────────────────
 * The bare map (satellite and the railways, as the app draws them) around a
 * station-to-station hike, captured by the media scripts with the hike's
 * trace, smoothed, projected to its pixels. The trace and its ends are drawn
 * here like the curated-hikes layer draws them (a line on a white halo; A/B
 * ends from endpointsLayer.ts), in a colour that holds on the imagery. */

interface HikeTrace {
  width: number;
  height: number;
  start: string;
  end: string;
  points: [number, number][];
}

function HikeMap() {
  const t = useT();
  const layout = useIsMobile() ? 'phone' : 'desktop';
  const trace = (layout === 'phone' ? tracePhone : traceDesktop) as HikeTrace;
  const d = 'M' + trace.points.map(([x, y]) => `${x} ${y}`).join(' L');
  const [a, b] = [trace.points[0], trace.points[trace.points.length - 1]];
  return (
    <div className={styles.hikeMap}>
      <img src={`${MEDIA}hike-map-${layout}.webp`} alt="" />
      <svg
        viewBox={`0 0 ${trace.width} ${trace.height}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={t('tutorial.hikes.alt', { from: trace.start, to: trace.end })}
      >
        <path className={styles.trackHalo} d={d} />
        <path className={styles.hikeTrack} d={d} />
        <End at={a} letter="A" />
        <End at={b} letter="B" />
      </svg>
      <span className={styles.credit}>© IGN — Géoplateforme · SNCF Réseau</span>
    </div>
  );
}

function End({ at, letter }: { at: [number, number]; letter: string }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <circle className={styles.endHike} r="8" />
      <text className={styles.endText} y="3.6" textAnchor="middle">
        {letter}
      </text>
    </g>
  );
}
