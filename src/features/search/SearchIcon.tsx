/**
 * Magnifier glyph, shared by the field's leading icon and the dock's collapsed
 * search action. Sized by whatever wraps it (`width: 100%`), matching the
 * icon convention in components/icons.
 */
export default function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      width="14"
      height="14"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.4 10.4 14 14" strokeLinecap="round" />
    </svg>
  );
}
