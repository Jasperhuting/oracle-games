type DateLike = Date | { toDate: () => Date } | string | null | undefined;

/**
 * Helper to convert Timestamp or Date to ISO string
 * Works with both Firebase client SDK Timestamp and Admin SDK Timestamp
 */
export function toISOString(date: DateLike): string {
  if (!date) return '';
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    return date.toDate().toISOString();
  }
  if (typeof date === 'string') return date;
  return '';
}

/**
 * Helper to convert optional Timestamp or Date to ISO string
 */
export function toISOStringOrUndefined(date: DateLike): string | undefined {
  if (!date) return undefined;
  return toISOString(date);
}
