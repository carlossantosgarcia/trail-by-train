// What a report is about, and the categories offered for it. The categories
// must match the Worker's (workers/feedback/src/report.js); a test checks it.

export type FeedbackSubject =
  | {
      kind: 'line';
      network: string;
      providerId: string;
      line: string;
      lineName: string;
      routeId: string;
    }
  | { kind: 'hike'; hike: string; hikeId: string }
  | { kind: 'general' };

export type FeedbackKind = FeedbackSubject['kind'];

export const CATEGORIES: Record<FeedbackKind, readonly string[]> = {
  line: ['Horaires', 'Tracé', 'Arrêts', 'Lien vers les horaires', 'Réservation', 'Autre'],
  hike: ['Tracé', 'Accès en transport', 'Informations', 'Autre'],
  general: [
    'Horaires',
    'Tracé',
    'Arrêts',
    'Lien vers les horaires',
    'Réservation',
    'Randonnée',
    'Demande de ligne',
    'Suggestion',
    'Autre',
  ],
};

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const LINKS_MAX = 3;

const KIND_TITLE: Record<FeedbackKind, string> = {
  line: 'Ligne',
  hike: 'Randonnée',
  general: 'Général',
};

/** "[Ligne] Cars Région Isère T40 : Horaires", as the Worker titles the issue. */
export function reportTitle(subject: FeedbackSubject, category: string): string {
  const what =
    subject.kind === 'line'
      ? `${subject.network} ${subject.line}`.trim()
      : subject.kind === 'hike'
        ? subject.hike
        : '';
  return `[${KIND_TITLE[subject.kind]}] ${what ? `${what} : ` : ''}${category}`;
}

/** What the form shows under "Ce qui sera envoyé". */
export function subjectSummary(subject: FeedbackSubject): string | null {
  if (subject.kind === 'line') {
    return `${subject.network} · ${subject.line} ${subject.lineName}`.trim();
  }
  if (subject.kind === 'hike') return subject.hike;
  return null;
}
