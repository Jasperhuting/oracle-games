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
    const [showBercPopup, setShowBercPopup] = useState(false);
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
            <div className={`${showBanner ? 'h-0 sm:h-[36px]' : 'h-0'} transition-[height] duration-300`}>
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
            {children}

            {/* Desktop: rotated sidebar buttons */}
            <button
                className="hidden md:block fixed bottom-[100px] rotate-90 -left-[40px] z-50 rounded-t-lg bg-primary text-white px-4 py-2 cursor-pointer hover:bg-[#357771] transition-colors"
                onClick={() => setShowFeedbackModal(true)}
            >
                Feedback
            </button>
            <button
                className="hidden md:flex fixed bottom-[404px] rotate-90 -left-[46px] z-50 rounded-t-lg bg-[#e9fbf4] text-[#0f5132] px-4 py-2 cursor-pointer border border-[#b5f0d4] hover:bg-[#def8ee] transition-colors items-center gap-2"
                onClick={() => setShowBercPopup(true)}
                aria-label="Berc Bikes prijzenactie"
            >
                <img
                    src="/berc-bike-logo-transparent.png"
                    alt="Berc Bikes"
                    className="w-5 h-5 object-contain"
                />
                <span className="text-sm whitespace-nowrap">Berc Bike</span>
            </button>
            <BuyMeCoffeeWidget />

            {/* Mobile: floating action button with menu */}
            <MobileFloatingMenu onFeedbackClick={() => setShowFeedbackModal(true)} />

            {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}

            {showBercPopup && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <img
                                    src="/berc-bike-logo.jpg"
                                    alt="Berc Bikes"
                                    className="w-12 h-12 object-contain"
                                />
                                <h2 className="text-lg font-bold text-gray-900">Speel mee voor de prijzen</h2>
                            </div>
                            <button
                                onClick={() => setShowBercPopup(false)}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                aria-label="Sluiten"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="mt-4 text-sm text-gray-700 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-2">
                                <div className="font-semibold text-gray-900">1e prijs</div>
                                <div>&#39;Bike &amp; Pancakes&#39; arrangement voor 4 personen.</div>
                                <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <img
                                        src="https://bercbike.nl/wp-content/uploads/2023/02/gravelbike-huren-montferland-1024x683.jpg"
                                        alt="1e prijs - Bike & Pancakes arrangement"
                                        className="w-full h-40 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-gray-900">2e prijs</div>
                                <div>Gravel arrangement voor 2 personen.</div>
                                <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <img
                                        src="https://bercbike.nl/wp-content/uploads/2021/11/mtb-verhuur-zeddam-montferland.jpg"
                                        alt="2e prijs - Gravel arrangement"
                                        className="w-full h-40 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-gray-900">3e prijs</div>
                                <div>&#39;Proefritje&#39; te nuttigen in het wielercafe in Zeddam</div>
                                <div className="text-xs text-gray-500">(3 speciaalbiertjes geserveerd met lokale kaas &amp; worst)</div>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <img
                                        src="https://bercbike.nl/wp-content/uploads/2021/07/achterhoekse-bieren-wielercafe-1024x1024.jpg"
                                        alt="3e prijs - Proefritje"
                                        className="w-full h-40 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-gray-900">4e &amp; 5e prijs</div>
                                <div>een &#39;Veloholic&#39; shirt</div>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <img
                                        src="https://res.cloudinary.com/dtkg71eih/image/upload/v1771949728/wielershirt_z4m8wc.jpg"
                                        alt="4e en 5e prijs - Veloholic shirt"
                                        className="w-full h-40 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="text-xs text-gray-500">
                                * Het buffje mag je houden als aandenken aan een leuke sportieve middag!
                            </div>
                        </div>
                        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <button
                                onClick={() => setShowBercPopup(false)}
                                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                                Sluiten
                            </button>
                            <a
                                href="https://buymeacoffee.com/oraclegames"
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-center"
                            >
                                Betaal €5
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
