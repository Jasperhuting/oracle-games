/**
 * Rider Name Matching Service
 *
 * Provides fuzzy matching for rider names to handle:
 * - Different name formats (firstName-lastName vs lastName-firstName)
 * - Accented characters (Pogačar vs Pogacar)
 * - Typos and minor variations
 * - Known aliases from database
 */

import { getServerFirebase } from '@/lib/firebase/server';

export interface RiderIdentifier {
  nameID: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  shortName?: string;
}

export interface MatchResult {
  matched: boolean;
  riderNameId: string | null;
  confidence: number;
  matchedVia: 'exact' | 'alias' | 'fuzzy' | 'none';
  alternativeMatches?: Array<{
    nameID: string;
    confidence: number;
  }>;
}

/**
 * Normalize a string for comparison
 * - Lowercase
 * - Remove accents
 * - Replace spaces with hyphens
 * - Remove special characters
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove special characters
    .replace(/-+/g, '-') // Remove multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function calculateSimilarity(a: string, b: string): number {
  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);

  if (normalizedA === normalizedB) return 1;

  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - distance / maxLength;
}

/**
 * Generate possible name variations
 */
function generateNameVariations(rider: RiderIdentifier): string[] {
  const variations: string[] = [];

  // Add nameID
  if (rider.nameID) {
    variations.push(rider.nameID);
    variations.push(normalizeString(rider.nameID));
  }

  // Add full name
  if (rider.name) {
    variations.push(normalizeString(rider.name));
  }

  // Add shortName
  if (rider.shortName) {
    variations.push(normalizeString(rider.shortName));
  }

  // Add firstName-lastName and lastName-firstName combinations
  if (rider.firstName && rider.lastName) {
    const firstName = normalizeString(rider.firstName);
    const lastName = normalizeString(rider.lastName);
    variations.push(`${firstName}-${lastName}`);
    variations.push(`${lastName}-${firstName}`);
    variations.push(`${firstName[0]}-${lastName}`); // Initial + lastName
    variations.push(`${lastName}`); // Just lastName
  }

  return [...new Set(variations)]; // Remove duplicates
}

/**
 * In-memory cache for aliases
 */
let aliasCache: Map<string, string> | null = null;
let aliasCacheExpiry: number = 0;
const ALIAS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load rider aliases from database
 */
async function loadAliases(): Promise<Map<string, string>> {
  const now = Date.now();

  if (aliasCache && now < aliasCacheExpiry) {
    return aliasCache;
  }

  const db = getServerFirebase();
  const snapshot = await db.collection('riderAliases').get();

  const aliases = new Map<string, string>();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const canonicalNameId = data.canonicalNameId;

    if (canonicalNameId && Array.isArray(data.aliases)) {
      data.aliases.forEach((alias: string) => {
        aliases.set(normalizeString(alias), canonicalNameId);
      });
    }
  });

  aliasCache = aliases;
  aliasCacheExpiry = now + ALIAS_CACHE_TTL;

  return aliases;
}

/**
 * Clear the alias cache (call after updating aliases)
 */
export function clearAliasCache(): void {
  aliasCache = null;
  aliasCacheExpiry = 0;
}

/**
 * Match a search name against a list of known riders
 */
export async function matchRider(
  searchName: string,
  knownRiders: RiderIdentifier[],
  options: {
    threshold?: number;
    includeAlternatives?: boolean;
  } = {}
): Promise<MatchResult> {
  const threshold = options.threshold ?? 0.7;
  const includeAlternatives = options.includeAlternatives ?? false;

  const normalizedSearch = normalizeString(searchName);

  // 1. Try exact match first
  for (const rider of knownRiders) {
    const variations = generateNameVariations(rider);
    if (variations.includes(normalizedSearch)) {
      return {
        matched: true,
        riderNameId: rider.nameID,
        confidence: 1.0,
        matchedVia: 'exact',
      };
    }
  }

  // 2. Try alias lookup
  const aliases = await loadAliases();
  const aliasMatch = aliases.get(normalizedSearch);
  if (aliasMatch) {
    const matchedRider = knownRiders.find((r) => r.nameID === aliasMatch);
    if (matchedRider) {
      return {
        matched: true,
        riderNameId: matchedRider.nameID,
        confidence: 0.95,
        matchedVia: 'alias',
      };
    }
  }

  // 3. Try fuzzy matching
  const scores: Array<{ rider: RiderIdentifier; score: number }> = [];

  for (const rider of knownRiders) {
    const variations = generateNameVariations(rider);
    let bestScore = 0;

    for (const variation of variations) {
      const score = calculateSimilarity(normalizedSearch, variation);
      if (score > bestScore) {
        bestScore = score;
      }
    }

    if (bestScore >= threshold) {
      scores.push({ rider, score: bestScore });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  if (scores.length > 0) {
    const bestMatch = scores[0];

    const result: MatchResult = {
      matched: true,
      riderNameId: bestMatch.rider.nameID,
      confidence: bestMatch.score,
      matchedVia: 'fuzzy',
    };

    if (includeAlternatives && scores.length > 1) {
      result.alternativeMatches = scores.slice(1, 4).map((s) => ({
        nameID: s.rider.nameID,
        confidence: s.score,
      }));
    }

    return result;
  }

  // No match found
  return {
    matched: false,
    riderNameId: null,
    confidence: 0,
    matchedVia: 'none',
  };
}

/**
 * Add a new alias to the database
 */
export async function addRiderAlias(
  canonicalNameId: string,
  alias: string
): Promise<void> {
  const db = getServerFirebase();
  const docRef = db.collection('riderAliases').doc(canonicalNameId);
  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data();
    const existingAliases = data?.aliases || [];
    if (!existingAliases.includes(alias)) {
      await docRef.update({
        aliases: [...existingAliases, alias],
      });
    }
  } else {
    await docRef.set({
      canonicalNameId,
      aliases: [alias],
      addedAt: new Date().toISOString(),
    });
  }

  clearAliasCache();
}

/**
 * Find unmatched riders from scraper data
 */
export async function findUnmatchedRiders(
  scraperRiders: RiderIdentifier[],
  knownRiders: RiderIdentifier[]
): Promise<
  Array<{
    scraperName: string;
    possibleMatches: Array<{ nameID: string; confidence: number }>;
  }>
> {
  const unmatched: Array<{
    scraperName: string;
    possibleMatches: Array<{ nameID: string; confidence: number }>;
  }> = [];

  for (const scraperRider of scraperRiders) {
    const searchName =
      scraperRider.shortName ||
      scraperRider.nameID ||
      scraperRider.name ||
      '';

    if (!searchName) continue;

    const result = await matchRider(searchName, knownRiders, {
      threshold: 0.5, // Lower threshold to find possible matches
      includeAlternatives: true,
    });

    if (!result.matched || result.confidence < 0.8) {
      const possibleMatches: Array<{ nameID: string; confidence: number }> =
        [];

      if (result.matched && result.riderNameId) {
        possibleMatches.push({
          nameID: result.riderNameId,
          confidence: result.confidence,
        });
      }

      if (result.alternativeMatches) {
        possibleMatches.push(...result.alternativeMatches);
      }

      unmatched.push({
        scraperName: searchName,
        possibleMatches,
      });
    }
  }

  return unmatched;
}
