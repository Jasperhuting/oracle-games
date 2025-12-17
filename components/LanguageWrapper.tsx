'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import I18nProvider from '@/components/i18nProvider';

export default function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [locale, setLocale] = useState<string>('nl');

  useEffect(() => {
    const fetchUserLanguage = async () => {
      if (user) {
        try {
          const response = await fetch(`/api/getUser?userId=${user.uid}`);
          if (response.ok) {
            const userData = await response.json();
            setLocale(userData.preferredLanguage || 'nl');
          }
        } catch (error) {
          console.error('Error fetching user language:', error);
          setLocale('nl');
        }
      } else {
        setLocale('nl');
      }
    };

    fetchUserLanguage();
  }, [user]);

  return (
    <I18nProvider locale={locale}>
      {children}
    </I18nProvider>
  );
}
