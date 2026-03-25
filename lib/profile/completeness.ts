export type FieldKey =
  | 'playername'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'avatarUrl'
  | 'dateOfBirth'
  | 'preferredLanguage';

export interface ProfileCompleteness {
  score: number;          // integer 0–100
  missingFields: FieldKey[];
}

export const FIELD_LABELS: Record<Exclude<FieldKey, 'playername' | 'email'>, string> = {
  firstName: 'Voornaam',
  lastName: 'Achternaam',
  avatarUrl: 'Avatar',
  dateOfBirth: 'Geboortedatum',
  preferredLanguage: 'Taalvoorkeur',
};

const OPTIONAL_FIELDS: Exclude<FieldKey, 'playername' | 'email'>[] = [
  'firstName',
  'lastName',
  'avatarUrl',
  'dateOfBirth',
  'preferredLanguage',
];

export function getProfileCompleteness(user: Record<string, unknown>): ProfileCompleteness {
  const missingFields = OPTIONAL_FIELDS.filter((key) => !user[key]);
  const filledCount = 7 - missingFields.length; // playername + email always filled
  return {
    score: Math.floor((filledCount / 7) * 100),
    missingFields,
  };
}

/** Build the Dutch sentence listing missing fields for the CarriereCard nudge */
export function buildMissingFieldsSentence(missingFields: FieldKey[]): string {
  if (missingFields.length === 0) return '';
  // Only include fields that have a display label (filters out 'playername'/'email' if ever passed)
  const labels = missingFields
    .filter((f): f is keyof typeof FIELD_LABELS => f in FIELD_LABELS)
    .map((f) => FIELD_LABELS[f]);
  let list: string;
  if (labels.length === 1) {
    list = `een **${labels[0]}**`;
  } else if (labels.length === 2) {
    list = `een **${labels[0]}** en **${labels[1]}**`;
  } else {
    const last = labels[labels.length - 1];
    const rest = labels.slice(0, -1).map((l) => `**${l}**`).join(', ');
    list = `${rest} en **${last}**`;
  }
  return `Voeg ${list} toe om je profiel compleet te maken.`;
}
