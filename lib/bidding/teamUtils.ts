/**
 * Returns true if the given team class string denotes a ProTour / WorldTour team.
 * Canonical class strings observed in PCS data.
 * This is the single source of truth — do not duplicate in components or API routes.
 */
export function isProTourTeamClass(teamClass?: string): boolean {
  if (!teamClass) return false;
  const normalized = teamClass.trim().toLowerCase();
  return (
    normalized === 'prt' ||
    normalized === 'proteam' ||
    normalized === 'pro team' ||
    normalized === 'protour' ||
    normalized === 'pro tour' ||
    normalized === 'pro'
  );
}

/**
 * Normalises a team name to a lowercase alphanumeric key for stable comparison.
 * e.g. "Team Visma | Lease a Bike" → "teamvismaleaseabike"
 */
export function normalizeTeamKey(name?: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
