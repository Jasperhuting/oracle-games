/**
 * Utility functions for handling Firestore Timestamps
 */

/**
 * Firestore Timestamp as it appears after JSON serialization
 */
export interface SerializedFirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

/**
 * Check if a value is a serialized Firestore Timestamp
 */
export function isSerializedTimestamp(value: unknown): value is SerializedFirestoreTimestamp {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_seconds' in value &&
    '_nanoseconds' in value &&
    typeof (value as SerializedFirestoreTimestamp)._seconds === 'number' &&
    typeof (value as SerializedFirestoreTimestamp)._nanoseconds === 'number'
  );
}

/**
 * Convert a serialized Firestore Timestamp to a Date object
 */
export function timestampToDate(timestamp: SerializedFirestoreTimestamp | string | { toDate: () => Date }): Date {
  // If it's already a Date, return it
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // If it's a Firestore Timestamp object with toDate method
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }

  // If it's a serialized Firestore Timestamp
  if (isSerializedTimestamp(timestamp)) {
    // Convert seconds and nanoseconds to milliseconds
    const milliseconds = timestamp._seconds * 1000 + Math.floor(timestamp._nanoseconds / 1000000);
    return new Date(milliseconds);
  }

  // If it's an ISO string or timestamp number
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp);
  }

  throw new Error('Invalid timestamp format');
}

/**
 * Format a timestamp to Dutch locale string
 */
export function formatTimestamp(
  timestamp: SerializedFirestoreTimestamp | string | { toDate: () => Date } | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!timestamp) {
    return 'Invalid date';
  }

  try {
    const date = timestampToDate(timestamp);

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return date.toLocaleString('nl-NL', options || {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Invalid date';
  }
}
