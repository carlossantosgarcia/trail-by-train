import { openTutorial } from './store';
import { useT } from '../../i18n';
import { useIsMobile } from '../../lib/useIsMobile';

/** Reopens the tutorial. Rendered in the top-left dock, which styles it. */
export default function TutorialButton({ className }: { className?: string }) {
  const t = useT();
  // On a phone the button is itself a round tile: the bare question mark,
  // larger, rather than a ring inside a ring.
  const ring = !useIsMobile();
  return (
    <button
      type="button"
      className={className}
      onClick={openTutorial}
      aria-label={t('tutorial.info')}
      title={t('tutorial.info')}
    >
      <HelpMark ring={ring} />
    </button>
  );
}

/**
 * Lucide's "circle-help". On a phone the bare mark, larger and bolder, drawn
 * about the tile's middle. Drawn as a block so the button centres it, not the
 * text baseline.
 */
function HelpMark({ ring }: { ring: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={ring ? '1em' : '1.4em'}
      height={ring ? '1em' : '1.4em'}
      fill="none"
      stroke="currentColor"
      strokeWidth={ring ? 2 : 2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {ring ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </>
      ) : (
        <>
          <path d="M7.6 8.2a4.5 4.5 0 0 1 8.75 1.5c0 3-4.35 3.6-4.35 5.6" />
          <circle cx="12" cy="19.6" r="1.5" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
