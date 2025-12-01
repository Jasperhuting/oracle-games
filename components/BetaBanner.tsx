'use client'
import { X } from "tabler-icons-react";

export const BetaBanner = ({ setShowBanner }: { setShowBanner: (show: boolean) => void }) => {

    const setShowBannerCookie = () => {
        setShowBanner(false);

        // Set cookie to expire in 30 days
        const maxAge = 60 * 60 * 24 * 30; // 30 days in seconds
        document.cookie = `hide-beta-banner=true; max-age=${maxAge}; path=/; SameSite=Lax`;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-white text-center h-[36px]">
            <span className="text-sm h-[36px] flex items-center justify-center">This is a beta version of the website. Please report any issues if you find any.</span>
            <button className="absolute top-0 right-0 h-[36px] w-[36px] flex items-center justify-center cursor-pointer" onClick={setShowBannerCookie}>
                <X className="h-6 w-6" />
            </button>
        </div>
    );
}