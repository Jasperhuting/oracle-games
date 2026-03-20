'use client';

import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { LayoutShell } from '@/components/LayoutShell';
import { AuthGuard } from '@/components/AuthGuard';
import MessageNotification from '@/components/MessageNotification';
import { LastActiveTracker } from '@/components/LastActiveTracker';
import { ImpersonationProvider } from '@/contexts/ImpersonationContext';
import { RankingsProvider } from '@/contexts/RankingsContext';
import LanguageWrapper from '@/components/LanguageWrapper';
import { PlayerTeamsProvider } from '@/contexts/PlayerTeamsContext';
import { isPublicRoute } from '@/lib/constants/routes';
import ChatFloatingButton from '@/components/chat/ChatFloatingButton';
import { TabFocusRefresher } from '@/components/TabFocusRefresher';

export default function AppShellProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);

  return (
    <LanguageWrapper>
      <ImpersonationProvider>
        <RankingsProvider autoLoad={!isPublic}>
          <PlayerTeamsProvider autoLoad={!isPublic}>
            <Toaster position="top-center" />
            <TabFocusRefresher />
            {!isPublic && <LastActiveTracker />}
            {!isPublic && <MessageNotification />}
            <AuthGuard>
              {isPublic ? (
                <main>{children}</main>
              ) : (
                <LayoutShell>
                  <main>{children}</main>
                </LayoutShell>
              )}
              {!isPublic && <ChatFloatingButton />}
            </AuthGuard>
          </PlayerTeamsProvider>
        </RankingsProvider>
      </ImpersonationProvider>
    </LanguageWrapper>
  );
}
