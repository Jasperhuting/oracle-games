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