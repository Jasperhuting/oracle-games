"use client";

import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useEffect, useState } from "react";
import { FeedbackModal } from "./FeedbackModal";
import { BetaBanner } from "./BetaBanner";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { useAuth } from "@/hooks/useAuth";
import { BuyMeCoffeeWidget } from "./BuyMeCoffeeWidget";
import { MobileFloatingMenu } from "./MobileFloatingMenu";

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const hideHeader = pathname === "/login" || pathname === "/register" || pathname === "/reset-password";
    const { impersonationStatus } = useAuth();

    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    // Initialize banner state from cookie immediately to prevent layout shift
    const [showBanner, setShowBanner] = useState(() => {
        if (typeof document !== 'undefined') {
            const cookies = document.cookie.split('; ');
            const hideBannerCookie = cookies.find(cookie => cookie.startsWith('hide-beta-banner='));
            return hideBannerCookie ? hideBannerCookie.split('=')[1] !== 'true' : true;
        }
        return true;
    });

    // Check if user has previously hidden the banner
    useEffect(() => {
        const checkBannerCookie = () => {
            const cookies = document.cookie.split('; ');
            const hideBannerCookie = cookies.find(cookie => cookie.startsWith('hide-beta-banner='));

            if (hideBannerCookie) {
                // Extract the value after 'hide-beta-banner='
                const value = hideBannerCookie.split('=')[1];
                setShowBanner(value !== 'true');
            } else {
                setShowBanner(true);
            }
        };

        // Check initially
        checkBannerCookie();

        // Poll for cookie changes (since cookies don't trigger events)
        const interval = setInterval(checkBannerCookie, 100);

        return () => clearInterval(interval);
    }, []);

    const stopImpersonation = async () => {
        console.log('LayoutShell: stopImpersonation called');
        try {
            const response = await fetch('/api/impersonate/stop', {
                method: 'POST',
            });
            
            if (!response.ok) {
                throw new Error('Failed to stop impersonation');
            }
            
            const data = await response.json();
            
            // Get the admin restore token from localStorage
            const adminToken = localStorage.getItem('admin_restore_token') || data.adminToken;
            
            // Clear impersonation tokens and state
            localStorage.removeItem('impersonation_token');
            localStorage.removeItem('admin_restore_token');
            localStorage.removeItem('impersonation');
            
            if (adminToken) {
                // Store admin token temporarily to restore session
                localStorage.setItem('restore_admin_session', adminToken);
                console.log('Stored restore_admin_session token');
            } else {
                console.error('No admin token available for restore!');
            }
            
            // Small delay to ensure localStorage is written before redirect
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Force reload to admin page - this will trigger the restore flow in useAuth
            window.location.href = '/admin';
        } catch (error) {
            console.error('Error stopping impersonation:', error);
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
                        topOffset={showBanner ? 36 : 0}
                    />
                )}
            </div>
            
            {!hideHeader && <Header hideBetaBanner={showBanner} />}
            <main>{children}</main>

            {/* Desktop: rotated sidebar buttons */}
            <button className="hidden md:block fixed bottom-[100px] rotate-90 -left-[40px] z-50 rounded-t-lg bg-primary text-white px-4 py-2 cursor-pointer hover:bg-[#357771] transition-colors" onClick={() => setShowFeedbackModal(true)}>Feedback</button>
            <BuyMeCoffeeWidget />

            {/* Mobile: floating action button with menu */}
            <MobileFloatingMenu onFeedbackClick={() => setShowFeedbackModal(true)} />

            {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
        </>
    );
}