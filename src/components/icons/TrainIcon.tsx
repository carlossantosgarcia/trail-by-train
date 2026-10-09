// Railway-tracks pictogram used by the "Réseau ferroviaire" overlay toggle:
// two rails converging in perspective crossed by three sleepers. Reads as the
// line network and stays distinct from the passenger-station "train" markers.
export default function TrainIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="9" y1="2.5" x2="5.5" y2="21.5" />
      <line x1="15" y1="2.5" x2="18.5" y2="21.5" />
      <line x1="8.4" y1="6" x2="15.6" y2="6" />
      <line x1="7.6" y1="11" x2="16.4" y2="11" />
      <line x1="6.7" y1="16.5" x2="17.3" y2="16.5" />
    </svg>
  );
}
