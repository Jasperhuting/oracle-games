// In i18nProvider.tsx
"use client";

import { useEffect, useState } from "react";
import i18n from "i18next";  // Import i18n directly
import { initI18n } from "@/lib/i18n/i18n";
import { listenTranslations } from "@/lib/i18n/firestore";

export default function I18nProvider({ 
  children,
  locale = "nl" 
}: { 
  children: React.ReactNode;
  locale: string;
}) {
  const [isReady, setIsReady] = useState(() => i18n.isInitialized);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const initialize = async () => {
      try {
        // Initialize quickly, then load translation payload in the background.
        if (!i18n.isInitialized) {
          await initI18n(locale, {});
        } else if (i18n.language !== locale) {
          await i18n.changeLanguage(locale);
        }

        if (!cancelled) {
          setIsReady(true);
        }

        unsubscribe = listenTranslations(locale, (translations) => {
          i18n.addResourceBundle(locale, 'translation', translations, true, true);
        });
      } catch (error) {
        console.error('Error initializing i18n:', error);
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [locale]);

  // Change language when locale changes
  useEffect(() => {
    if (i18n.isInitialized && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}
