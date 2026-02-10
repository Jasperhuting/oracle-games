'use client'
import { X } from "tabler-icons-react";
import { useTranslation } from "react-i18next";

export const BetaBanner = ({ setShowBanner }: { setShowBanner: (show: boolean) => void }) => {

    const { t } = useTranslation();

    const setShowBannerCookie = () => {
        setShowBanner(false);

        // Set cookie to expire in 30 days
        const maxAge = 60 * 60 * 24 * 30; // 30 days in seconds
        document.cookie = `hide-beta-banner=true; max-age=${maxAge}; path=/; SameSite=Lax`;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-white text-center h-0 sm:h-[36px]">
            <span className="text-sm h-[36px] flex items-center justify-center">{t('betaBanner.description')}</span>
            <button className="absolute top-0 right-0 h-[36px] w-[36px] flex items-center justify-center cursor-pointer" onClick={setShowBannerCookie}>
                <X className="h-6 w-6" />
            </button>
        </div>
    );
}