// Icons from Lucide (https://lucide.dev), lucide-static@0.460.0.
//
// ISC License. Copyright (c) for portions of Lucide are held by Cole Bemis
// 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are
// held by Lucide Contributors 2022. Permission to use, copy, modify, and/or
// distribute this software for any purpose with or without fee is hereby
// granted, provided that the above copyright notice and this permission
// notice appear in all copies.
//
// Vendored as paths rather than a dependency: the app needs a handful, and
// each one is a few bytes. They size to 1em, so they follow the text around
// them; a button can override with CSS.

import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      // Sit on the text baseline when inline; harmless inside flex rows.
      style={{ verticalAlign: '-0.125em', flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function WarningIcon() {
  return (
    <Icon>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function PhoneIcon() {
  return (
    <Icon>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </Icon>
  );
}

export function LayersIcon() {
  return (
    <Icon>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </Icon>
  );
}

export function FitIcon() {
  return (
    <Icon>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </Icon>
  );
}

export function MountainIcon() {
  return (
    <Icon>
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </Icon>
  );
}

export function BedIcon() {
  return (
    <Icon>
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </Icon>
  );
}

export function LassoSelectIcon() {
  return (
    <Icon>
      <path d="M7 22a5 5 0 0 1-2-4" />
      <path d="M7 16.93c.96.43 1.96.74 2.99.91" />
      <path d="M3.34 14A6.8 6.8 0 0 1 2 10c0-4.42 4.48-8 10-8s10 3.58 10 8a7.19 7.19 0 0 1-.33 2" />
      <path d="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path d="M14.33 22h-.09a.35.35 0 0 1-.24-.32v-10a.34.34 0 0 1 .33-.34c.08 0 .15.03.21.08l7.34 6a.33.33 0 0 1-.21.59h-4.49l-2.57 3.85a.35.35 0 0 1-.28.14z" />
    </Icon>
  );
}
