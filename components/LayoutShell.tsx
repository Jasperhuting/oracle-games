"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { useEffect, useState } from "react";
import { FeedbackModal } from "./FeedbackModal";
import { BetaBanner } from "./BetaBanner";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { useAuth } from "@/hooks/useAuth";
import { BuyMeCoffeeWidget } from "./BuyMeCoffeeWidget";
import { MobileFloatingMenu } from "./MobileFloatingMenu";
import { BercBikePopup } from "./BercBikePopup";
import { FeedbackSidebar } from "./FeedbackSidebar";
import {
    clearAllImpersonationClientState,
    getAdminRestoreToken,
    setRestoreAdminSessionToken,
} from "@/lib/auth/impersonation-storage";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

function readShowBannerFromCookie() {
    const cookies = document.cookie.split('; ');
    const hideBannerCookie = cookies.find(cookie => cookie.startsWith('hide-beta-banner='));

    if (!hideBannerCookie) {
        return true;
    }

    return hideBannerCookie.split('=')[1] !== 'true';
}

export function LayoutShell({
    children,
    initialIsAdmin,
}: {
    children: React.ReactNode;
    initialIsAdmin: boolean;
}) {
    const pathname = usePathname();
    const hideHeader = pathname === "/login" || pathname === "/register" || pathname === "/reset-password";
    const { impersonationStatus, refreshImpersonationStatus, clearImpersonationStatus } = useAuth();
    const [stoppingImpersonation, setStoppingImpersonation] = useState(false);

    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showBercPopup, setShowBercPopup] = useState(false);
    const [hideSponsorButtons, setHideSponsorButtons] = useState(false);
    // Keep the first client render identical to SSR; cookie sync happens after mount.
    const [showBanner, setShowBanner] = useState(true);

    // Check if user has previously hidden the banner
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setShowBanner(readShowBannerFromCookie());
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, []);

    useEffect(() => {
        const updateBottomState = () => {
            const threshold = 140;
            const viewportBottom = window.scrollY + window.innerHeight;
            const pageBottom = document.documentElement.scrollHeight;
            setHideSponsorButtons(viewportBottom >= pageBottom - threshold);
        };

        updateBottomState();
        window.addEventListener('scroll', updateBottomState, { passive: true });
        window.addEventListener('resize', updateBottomState);

        return () => {
            window.removeEventListener('scroll', updateBottomState);
            window.removeEventListener('resize', updateBottomState);
        };
    }, []);

    const stopImpersonation = async () => {
        if (stoppingImpersonation) return;
        setStoppingImpersonation(true);
        try {
            // Sign out the impersonated Firebase user immediately so the
            // shared-session restore on the next page load doesn't
            // re-create the session for the wrong user.
            await signOut(auth);

            const response = await fetch('/api/impersonate/stop', {
                method: 'POST',
            });

            // Even on a non-OK response (e.g. cookie already gone) we still
            // want to clean up client state and redirect so the user isn't stuck.
            const data = response.ok ? await response.json() : {};

            // Get the admin restore token from localStorage or API response
            const adminToken = getAdminRestoreToken() || data.adminToken;

            // Clear all client-side impersonation state
            clearAllImpersonationClientState();
            clearImpersonationStatus();

            if (adminToken) {
                setRestoreAdminSessionToken(adminToken);
            }

            // Best-effort server re-check after clearing local state.
            // The optimistic clear above avoids a stale banner when the
            // cookie removal has not propagated to the next request yet.
            void refreshImpersonationStatus();

            // Navigate to admin page — the restore flow in useAuth will
            // sign the admin back in via the stored restore token.
            window.location.href = '/admin';
        } catch (error) {
            console.error('Error stopping impersonation:', error);
            // Best-effort redirect so the user is never stuck
            clearAllImpersonationClientState();
            clearImpersonationStatus();
            window.location.href = '/admin';
        }
    };

    return (
        <>
            {/* Reserve space for beta banner to prevent layout shift */}
            <div className={`${showBanner ? 'h-[36px]' : 'h-0'} transition-[height] duration-300`}>
                {showBanner && <BetaBanner setShowBanner={setShowBanner} />}
            </div>
            
            {/* Reserve space for impersonation banner */}
            <div className={`${impersonationStatus.isImpersonating ? 'h-[48px]' : 'h-0'} transition-[height] duration-300`}>
                {impersonationStatus.isImpersonating && (
                    <ImpersonationBanner
                        impersonatedUserName={impersonationStatus.impersonatedUser?.displayName || impersonationStatus.impersonatedUser?.email || 'Unknown'}
                        adminName={impersonationStatus.realAdmin?.displayName || impersonationStatus.realAdmin?.email || 'Unknown'}
                        onStop={stopImpersonation}
                        stopping={stoppingImpersonation}
                        topOffset={showBanner ? 36 : 0}
                    />
                )}
            </div>
            
            {!hideHeader && <Header hideBetaBanner={showBanner} initialIsAdmin={initialIsAdmin} />}
            {children}

            {/* Desktop: rotated sidebar buttons */}
            <FeedbackSidebar
                onFeedbackClick={() => setShowFeedbackModal(true)}
                onBercClick={() => setShowBercPopup(true)}
                hidden={hideSponsorButtons}
            />
            {!hideSponsorButtons && <BuyMeCoffeeWidget />}

            {/* Mobile: floating action button with menu */}
            <MobileFloatingMenu onFeedbackClick={() => setShowFeedbackModal(true)} />

            {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
            <BercBikePopup isOpen={showBercPopup} onClose={() => setShowBercPopup(false)} />
        </>
    );
}
