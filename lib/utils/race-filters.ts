// lib/utils/race-filters.ts
// Shared race exclusion logic used by race-status API and scrape crons.

const UNWANTED_CLASSIFICATIONS = ['MJ', 'MU', 'WJ', 'WU', 'WE', 'WWT'] as const;

const WOMEN_NAME_KEYWORDS = [
  'WOMEN',
  'WOMAN',
  'FEMINA',
  'FEMINAS',
  'FEMENINA',
  'FEMENINO',
  'FEMME',
  'FEMMES',
  'DAMES',
  'LADIES',
  'FEMALE',
] as const;

/**
 * Returns true if a race should be excluded from scraping and admin display.
 *
 * @param name - Race display name
 * @param classification - PCS classification string (e.g. "2.UWT", "1.WE")
 * @param slug - Race slug (optional)
 * @param excludeFromScraping - Explicit Firestore flag; if true, always exclude
 */
export function shouldExcludeRace(
  name: string,
  classification: string | null,
  slug?: string,
  excludeFromScraping?: boolean,
): boolean {
  if (excludeFromScraping === true) return true;

  const cls = (classification || '').trim();
  const nameUpper = name.toUpperCase();
  const clsUpper = cls.toUpperCase();
  const slugUpper = (slug || '').toUpperCase();

  // Word-boundary check: MU inside "AMUNDSEN" should NOT match
  const hasUnwantedClassToken = (value: string): boolean =>
    UNWANTED_CLASSIFICATIONS.some(code => {
      const pattern = new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`);
      return pattern.test(value);
    });

  const hasUnwantedInName = hasUnwantedClassToken(nameUpper);
  // WWT is already in UNWANTED_CLASSIFICATIONS so no separate check is needed
  const hasUnwantedInClassification = UNWANTED_CLASSIFICATIONS.some(
    unwanted => clsUpper.includes(unwanted),
  );
  const hasWomenInName = WOMEN_NAME_KEYWORDS.some(k => nameUpper.includes(k));
  const hasWomenInSlug = WOMEN_NAME_KEYWORDS.some(k => slugUpper.includes(k));

  return (
    hasUnwantedInName ||
    hasUnwantedInClassification ||
    hasWomenInName ||
    hasWomenInSlug
  );
}
