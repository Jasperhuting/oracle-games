'use client';

import { useAuth } from '@/hooks/useAuth';
import I18nProvider from '@/components/i18nProvider';
import { useCurrentUser } from '@/contexts/CurrentUserContext';

export default function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { userData } = useCurrentUser();
  const locale = user ? userData?.preferredLanguage || 'nl' : 'nl';

  return (
    <I18nProvider locale={locale}>
      {children}
    </I18nProvider>
  );
}
