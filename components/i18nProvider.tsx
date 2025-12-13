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

    const initialize = async () => {
      try {
        // Initialize with empty resources
        await initI18n(locale, {});
        
        if (isMounted) {
          setReady(true);
        }

        // Listen for translation updates - use the imported i18n instance
        unsubscribe = listenTranslations(locale, (translations) => {
          console.log('Received translations:', translations);
          i18n.addResourceBundle(locale, 'translation', translations, true, true);
        });

        // Fallback in case translations take too long
        const timeout = setTimeout(() => {
          if (isMounted) {
            setReady(true);
          }
        }, 3000);

        return () => clearTimeout(timeout);
      } catch (error) {
        console.error('Error initializing i18n:', error);
        if (isMounted) {
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