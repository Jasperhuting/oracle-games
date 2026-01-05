import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const initI18n = async (locale: string, resources: Record<string, string> = {}) => {
  await i18n.use(initReactI18next).init({
    lng: locale,
    fallbackLng: 'en',
    load: 'currentOnly',
    resources: {
      [locale]: { translation: resources }
    },
    interpolation: { 
      escapeValue: false
    },
    saveMissing: true,
    missingKeyHandler: (lngs: string | readonly string[] | undefined, ns: string, key: string) => {
      // only show this local 
      process.env.NODE_ENV === 'development' && console.warn(`Missing translation for key: ${key} in language: ${lngs}`);
    },
    parseMissingKeyHandler: (key: string) => {
      console.warn(`Missing key: ${key}, falling back to key as value`);
      const parts = key.split('.');
      return parts[parts.length - 1]
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str: string) => str.toUpperCase());
    },
    react: {
      useSuspense: false
    }
  });
};

// Helper function for pluralization
export const pluralize = (key: string, count: number, variables: Record<string, unknown> = {}) => {
  return i18n.t(key, {
    ...variables,
    count,
    // Add any additional pluralization rules here if needed
  });
};