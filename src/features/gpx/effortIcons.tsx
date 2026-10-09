import type { ReactElement, SVGProps } from 'react';
import type { MetricId } from './effort';

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      {...props}
    />
  );
}

function ClockIcon(): ReactElement {
  return (
    <IconBase>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </IconBase>
  );
}

function MountainIcon(): ReactElement {
  return (
    <IconBase>
      <path d="M1.5 12.5L5 7l3 3 3-5 3.5 7.5z" />
    </IconBase>
  );
}

function FlameIcon(): ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      focusable={false}
    >
      <path d="M8.4 1.4c0 2 -2.1 2.7 -2.1 5.1c0 0.9 0.4 1.7 1 2.3c-0.1 -0.4 0 -1 0.4 -1.4c0 1 0.4 1.6 0.9 2.2C9 10.2 9.9 10.8 9.6 12c1.4 -0.8 2.3 -2.3 2.3 -4c0 -2.7 -3.5 -3.7 -3.5 -6.6z" />
      <path d="M5.5 9.8C4.7 10.5 4 11.4 4 12.4C4 14 5.5 15 7.8 15c2.6 0 4.7 -1.3 4.7 -3.6c0 -1.2 -0.7 -2.3 -1.7 -3c0.2 0.5 0.3 1 0.3 1.5c0 1.6 -1.4 3 -3.4 3c-1 0 -2 -0.4 -2.2 -1.2c-0.1 -0.3 0 -0.8 0.4 -1.1c-0.2 -0.3 -0.4 -0.5 -0.4 -0.8z" />
    </svg>
  );
}

function DistanceIcon(): ReactElement {
  return (
    <IconBase>
      <path d="M2 8h12" />
      <path d="M4.5 5.5L2 8l2.5 2.5" />
      <path d="M11.5 5.5L14 8l-2.5 2.5" />
    </IconBase>
  );
}

const ICONS: Record<MetricId, () => ReactElement> = {
  naismith: ClockIcon,
  tobler: MountainIcon,
  minetti: FlameIcon,
  effortKm: DistanceIcon,
};

export default function MetricIcon({ id }: { id: MetricId }): ReactElement {
  const Comp = ICONS[id];
  return <Comp />;
}
