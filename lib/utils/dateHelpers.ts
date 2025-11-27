/**
 * Helper to convert Timestamp or Date to ISO string
 * Works with both Firebase client SDK Timestamp and Admin SDK Timestamp
 */
export function toISOString(date: any): string {
  if (!date) return '';
  if (date instanceof Date) return date.toISOString();
  if (date.toDate && typeof date.toDate === 'function') return date.toDate().toISOString();
  return date.toString();
}

/**
 * Helper to convert optional Timestamp or Date to ISO string
 */
export function toISOStringOrUndefined(date: any): string | undefined {
  if (!date) return undefined;
  return toISOString(date);
}
