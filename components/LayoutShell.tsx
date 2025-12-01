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
    const [showBanner, setShowBanner] = useState(true);

    // Check if user has previously hidden the banner
    useEffect(() => {
        const cookies = document.cookie.split('; ');
        const hideBannerCookie = cookies.find(cookie => cookie.startsWith('hide-beta-banner='));

        if (hideBannerCookie) {
            setShowBanner(false);
        }
    }, []);


    return (
        <>  {showBanner && <BetaBanner setShowBanner={setShowBanner} />}
            {!hideHeader && <Header hideBetaBanner={showBanner} />}
            <main>{children}</main>
            <button className="fixed bottom-[100px] rotate-90 -left-[40px] z-50 rounded-t-lg bg-primary text-white px-4 py-2 cursor-pointer hover:bg-[#357771] transition-colors" onClick={() => setShowFeedbackModal(true)}>Feedback</button>
            {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
        </>
    );
}