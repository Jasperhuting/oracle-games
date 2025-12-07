"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { useEffect, useState } from "react";
import { FeedbackModal } from "./FeedbackModal";
import { BetaBanner } from "./BetaBanner";

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const hideHeader = pathname === "/login" || pathname === "/register" || pathname === "/reset-password";

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


    return (
        <>
            {/* Reserve space for banner to prevent layout shift */}
            <div className={`${showBanner ? 'h-[36px]' : 'h-0'} transition-[height] duration-300`}>
                {showBanner && <BetaBanner setShowBanner={setShowBanner} />}
            </div>
            {!hideHeader && <Header hideBetaBanner={showBanner} />}
            <main>{children}</main>
            <button className="fixed bottom-[100px] rotate-90 -left-[40px] z-50 rounded-t-lg bg-primary text-white px-4 py-2 cursor-pointer hover:bg-[#357771] transition-colors" onClick={() => setShowFeedbackModal(true)}>Feedback</button>
            {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
        </>
    );
}