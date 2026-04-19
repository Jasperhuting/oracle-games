'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { LayoutShell } from '@/components/LayoutShell';
import { AuthGuard } from '@/components/AuthGuard';
import MessageNotification from '@/components/MessageNotification';
import { LastActiveTracker } from '@/components/LastActiveTracker';
import { ImpersonationProvider } from '@/contexts/ImpersonationContext';
import { CurrentUserProvider } from '@/contexts/CurrentUserContext';
import { RankingsProvider } from '@/contexts/RankingsContext';
import LanguageWrapper from '@/components/LanguageWrapper';
import { PlayerTeamsProvider } from '@/contexts/PlayerTeamsContext';
import { isPublicRoute } from '@/lib/constants/routes';
import ChatFloatingButton from '@/components/chat/ChatFloatingButton';
import SidebarChatWidget from '@/components/chat/SidebarChatWidget';
import { TabFocusRefresher } from '@/components/TabFocusRefresher';
import { registerTokenService } from '@/lib/auth/token-service';
import { FirebaseTokenAdapter } from '@/lib/auth/adapters/firebase-token-adapter';
import { SurveyModal } from '@/components/SurveyModal';

export default function AppShellProviders({
  children,
  initialIsAdmin,
}: {
  children: React.ReactNode;
  initialIsAdmin: boolean;
}) {
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);
  const disablePlayerTeamsAutoLoad =
    typeof pathname === 'string' && /^\/games\/[^/]+\/auction$/.test(pathname);

  useEffect(() => {
    registerTokenService(new FirebaseTokenAdapter());
  }, []);

  return (
    <CurrentUserProvider>
      <LanguageWrapper>
        <ImpersonationProvider>
          <RankingsProvider autoLoad={!isPublic}>
            <PlayerTeamsProvider autoLoad={!isPublic && !disablePlayerTeamsAutoLoad}>
              <Toaster position="top-center" />
              <TabFocusRefresher />
              {!isPublic && <LastActiveTracker />}
              {!isPublic && <MessageNotification />}
              {!isPublic && <SurveyModal />}
              <AuthGuard>
                {isPublic ? (
                  <main>{children}</main>
                ) : (
                  <LayoutShell initialIsAdmin={initialIsAdmin}>
                    <main>{children}</main>
                  </LayoutShell>
                )}
                {!isPublic && <ChatFloatingButton />}
                {!isPublic && <SidebarChatWidget />}
              </AuthGuard>
            </PlayerTeamsProvider>
          </RankingsProvider>
        </ImpersonationProvider>
      </LanguageWrapper>
    </CurrentUserProvider>
  );
}
