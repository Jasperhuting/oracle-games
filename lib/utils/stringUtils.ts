/**
 * Normalizes a string by removing diacritical marks (accents, umlauts, etc.)
 * This allows for accent-insensitive searching.
 *
 * Examples:
 * - "Žak" → "zak"
 * - "Élie" → "elie"
 * - "Óscar" → "oscar"
 * - "Łukasz" → "lukasz"
 *
 * @param str - The string to normalize
 * @returns The normalized string in lowercase without diacritical marks
 */
export const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD') // Decompose characters into base + combining marks
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .toLowerCase();
};
