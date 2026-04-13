import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/client";

// Bump this when you want to force everyone to re-fetch translations immediately.
// Alternatively, update the `_version` field in the Firestore translations document
// (via the admin panel or seed script) to invalidate caches without a code deploy.
const CACHE_VERSION = "v2";

const TRANSLATIONS_CACHE_KEY = `oracle_translations_${CACHE_VERSION}_`;
const TRANSLATIONS_VERSION_KEY = `oracle_translations_fsversion_${CACHE_VERSION}_`;
const TRANSLATIONS_CACHE_AT_KEY = `oracle_translations_at_${CACHE_VERSION}_`;
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

function writeCachedTranslations(locale: string, data: Record<string, unknown>, firestoreVersion?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${TRANSLATIONS_CACHE_KEY}${locale}`, JSON.stringify(data));
    localStorage.setItem(`${TRANSLATIONS_CACHE_AT_KEY}${locale}`, String(Date.now()));
    if (firestoreVersion) {
      localStorage.setItem(`${TRANSLATIONS_VERSION_KEY}${locale}`, firestoreVersion);
    }
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

function getCachedFirestoreVersion(locale: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${TRANSLATIONS_VERSION_KEY}${locale}`);
  } catch {
    return null;
  }
}

export function getCachedTranslations(locale: string): Record<string, unknown> | null {
  return readCachedTranslations(locale);
}

/**
 * Fetch translations with version-based cache invalidation.
 *
 * On each call:
 * 1. If the local cache is fresh (< 24h), serve it immediately.
 * 2. Always do a lightweight Firestore read to check the `_version` field.
 *    - If the Firestore version differs from the cached version → re-fetch full translations.
 *    - If versions match → keep the cache as-is and extend its TTL.
 *
 * To force all users to re-fetch without a code deploy:
 *   Update the `_version` field in the Firestore `translations/{locale}` document.
 *   e.g. set `_version` to "2" or any new string value.
 */
export const listenTranslations = (
  locale: string,
  callback: (data: Record<string, unknown>) => void
): (() => void) => {
  const cached = readCachedTranslations(locale);

  // Serve cached data immediately so the UI doesn't wait
  if (cached && isCacheFresh(locale)) {
    callback(cached);
  }

  // Always check Firestore version to detect translation updates
  const ref = doc(db, "translations", locale);
  getDoc(ref)
    .then((snapshot) => {
      if (!snapshot.exists()) {
        if (!cached) callback({});
        return;
      }

      const data = snapshot.data() ?? {};
      const firestoreVersion = (data._version as string | undefined) ?? "1";
      const cachedVersion = getCachedFirestoreVersion(locale);

      if (cachedVersion === firestoreVersion && cached && isCacheFresh(locale)) {
        // Cache is still valid — nothing to do
        return;
      }

      // Version mismatch or cache stale → update cache and notify
      // Remove internal _version field before passing to i18n
      const { _version, ...translations } = data;
      writeCachedTranslations(locale, translations, firestoreVersion);
      callback(translations);
    })
    .catch((error) => {
      console.error("Error fetching translations:", error);
      if (!cached) callback({});
    });

  return () => {};
};
