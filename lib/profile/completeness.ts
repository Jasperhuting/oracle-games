export type FieldKey =
  | 'playername'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'avatarUrl'
  | 'dateOfBirth'
  | 'preferredLanguage';

/** Total number of tracked profile fields (2 required + 5 optional). */
export const TOTAL_PROFILE_FIELDS = 7;

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

export const OPTIONAL_FIELDS: Exclude<FieldKey, 'playername' | 'email'>[] = [
  'firstName',
  'lastName',
  'avatarUrl',
  'dateOfBirth',
  'preferredLanguage',
];

/**
 * Compute profile completeness for a user document.
 * @precondition `user.playername` and `user.email` are assumed to be non-empty (always filled at registration).
 */
export function getProfileCompleteness(user: Record<string, unknown>): ProfileCompleteness {
  const missingFields = OPTIONAL_FIELDS.filter((key) => !user[key]);
  const filledCount = TOTAL_PROFILE_FIELDS - missingFields.length; // playername + email always filled
  return {
    score: Math.floor((filledCount / TOTAL_PROFILE_FIELDS) * 100),
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
