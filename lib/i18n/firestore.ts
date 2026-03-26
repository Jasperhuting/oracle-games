import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/client";

const TRANSLATIONS_CACHE_KEY = "oracle_translations_";

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
  } catch {
    // localStorage full or unavailable — not critical
  }
}

export function getCachedTranslations(locale: string): Record<string, unknown> | null {
  return readCachedTranslations(locale);
}

export const listenTranslations = (locale: string, callback: (data: Record<string, unknown>) => void) => {
  const ref = doc(db, "translations", locale);

  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() || {};
        writeCachedTranslations(locale, data);
        callback(data);
      } else {
        callback({});
      }
    },
    (error) => {
      console.error('Error listening to translations:', error);
      callback({});
    }
  );

  // Return cleanup function — same interface as before
  return unsubscribe;
};
