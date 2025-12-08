import { TTTTeamResult } from "../scraper";

/**
 * Recursively removes undefined values from an object to make it Firebase-safe
 * Firebase doesn't allow undefined values in documents
 */
export function cleanFirebaseData(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(cleanFirebaseData).filter(item => item !== null && item !== undefined);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const cleanedValue = cleanFirebaseData(value);
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  }
  
  return obj;
}

export function iso2ToFlag(code: string): string {
  if (!code || code.length !== 2) return code;
  const A = 0x1f1e6; // Regional Indicator Symbol Letter A
  const asciiA = 65; // 'A'
  const [c1, c2] = code.toUpperCase();
  return String.fromCodePoint(
    A + (c1.charCodeAt(0) - asciiA),
    A + (c2.charCodeAt(0) - asciiA)
  );
}

export function isTTTTeamResult(v: unknown): v is TTTTeamResult {
  const obj = v as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return obj && typeof obj === 'object' && typeof obj.team === 'string' && Array.isArray(obj.riders);
}


export const toSlug = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0142]/g, "l")   // ł
    .replace(/[\u0141]/g, "L")   // Ł
    .replace(/[\u00F8]/g, "o")   // ø
    .replace(/[\u00D8]/g, "O")   // Ø
    .replace(/[\u00DF]/g, "ss")  // ß
    .replace(/[\u00E6]/g, "ae")  // æ
    .replace(/[\u00C6]/g, "Ae")  // Æ
    .replace(/[\u0300-\u036f]/g, "") // remove combining accents
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, "")  // allow periods in addition to alphanumeric, spaces, and hyphens
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};