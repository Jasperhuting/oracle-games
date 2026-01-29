// In i18nProvider.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    let translationsLoaded = false;

    // Start timeout IMMEDIATELY - this ensures we never hang forever
    // even if Firestore connection itself is blocked
    timeoutId = setTimeout(() => {
      if (isMounted && !translationsLoaded) {
        console.warn('Translations not loaded within 5 seconds, proceeding without translations');
        setReady(true);
      }
    }, 5000);

    const initialize = async () => {
      try {
        // Initialize with empty resources
        await initI18n(locale, {});

        // Listen for translation updates - use the imported i18n instance
        unsubscribe = listenTranslations(locale, (translations) => {
          i18n.addResourceBundle(locale, 'translation', translations, true, true);
          if (!translationsLoaded && isMounted) {
            translationsLoaded = true;
            if (timeoutId) clearTimeout(timeoutId);
            setReady(true);
          }
        });
      } catch (error) {
        console.error('Error initializing i18n:', error);
        if (isMounted && !translationsLoaded) {
          translationsLoaded = true;
          if (timeoutId) clearTimeout(timeoutId);
          setReady(true);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [locale]);

  // Change language when locale changes
  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  // Show loading state until translations are ready
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading translations...</div>
      </div>
    );
  }

  return <>{children}</>;
}