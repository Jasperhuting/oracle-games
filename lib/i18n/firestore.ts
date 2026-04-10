import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/client";

const TRANSLATIONS_CACHE_KEY = "oracle_translations_";
const TRANSLATIONS_CACHE_AT_KEY = "oracle_translations_at_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readCachedTranslations(locale: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${TRANSLATIONS_CACHE_KEY}${locale}`);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function writeCachedTranslations(locale: string, data: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${TRANSLATIONS_CACHE_KEY}${locale}`, JSON.stringify(data));
    localStorage.setItem(`${TRANSLATIONS_CACHE_AT_KEY}${locale}`, String(Date.now()));
  } catch {
    // localStorage full or unavailable — not critical
  }
}

function isCacheFresh(locale: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cachedAt = localStorage.getItem(`${TRANSLATIONS_CACHE_AT_KEY}${locale}`);
    if (!cachedAt) return false;
    return Date.now() - parseInt(cachedAt, 10) < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

export function getCachedTranslations(locale: string): Record<string, unknown> | null {
  return readCachedTranslations(locale);
}

/**
 * Fetch translations once. Uses localStorage cache (24h TTL) to avoid
 * repeated Firestore reads — translations change infrequently.
 * Returns a no-op cleanup function to stay compatible with the old
 * onSnapshot-based interface used by callers.
 */
export const listenTranslations = (
  locale: string,
  callback: (data: Record<string, unknown>) => void
): (() => void) => {
  // Serve from cache if still fresh — zero Firestore reads
  if (isCacheFresh(locale)) {
    const cached = readCachedTranslations(locale);
    if (cached) {
      callback(cached);
      return () => {};
    }
  }

  // Cache stale or missing: fetch once from Firestore
  const ref = doc(db, "translations", locale);
  getDoc(ref)
    .then((snapshot) => {
      const data = snapshot.exists() ? snapshot.data() ?? {} : {};
      writeCachedTranslations(locale, data);
      callback(data);
    })
    .catch((error) => {
      console.error("Error fetching translations:", error);
      callback({});
    });

  // No persistent listener — return no-op cleanup
  return () => {};
};
