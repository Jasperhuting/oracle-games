'use client'
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, useState } from "react";
import { useTranslation } from "react-i18next";
import { PlatformSelector } from "./header/PlatformSelector";
import { buildPlatformUrl, getAllPlatformConfigs, getPlatformConfig, getPlatformConfigFromHost, type HeaderMenuKey, type PlatformKey } from "@/lib/platform";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

const MobileMenu = dynamic(() => import("./header/MobileMenu").then((mod) => mod.MobileMenu), {
    ssr: false,
});

export const Header = ({
    hideBetaBanner,
    initialIsAdmin,
}: {
    hideBetaBanner: boolean;
    initialIsAdmin: boolean;
}) => {
    const pathname = usePathname();
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const { user, loading, impersonationStatus } = useAuth();
    const { userData, loading: currentUserLoading } = useCurrentUser();
    const { unreadCount } = useUnreadMessages(user?.uid);
    const currentPlatform = useSyncExternalStore(
        () => () => {},
        () => getPlatformConfigFromHost(window.location.host).key,
        () => "cycling"
    );
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );
    const isAdmin = !user
        ? false
        : currentUserLoading
            ? initialIsAdmin
            : userData?.userType === "admin";

    const adminHref = currentPlatform === "football"
        ? "/wk-2026/admin"
        : currentPlatform === "f1"
            ? "/f1/admin/results"
            : "/admin";

    const menuItems: Array<{ key: HeaderMenuKey; name: string; href: string; display: boolean }> = [
        { key: "news", name: 'Nieuws', href: "/news", display: !!user },
        { key: "games", name: t('header.menu.games'), href: "/games", display: !!user },
        { key: "riderPoints", name: t('header.menu.riderPoints'), href: "/rider-points", display: false },
        { key: "forum", name: t('header.menu.forum'), href: "/forum", display: isAdmin || impersonationStatus.isImpersonating },
        { key: "chat", name: "Chat", href: "/chat", display: !!user },
        { key: "myGames", name: t('header.menu.myGames'), href: "/myGames", display: false },
        { key: "footballWedstrijden", name: "Wedstrijden", href: "/wk-2026/wedstrijden", display: !!user },
        { key: "footballPredictions", name: "Predictions", href: "/wk-2026/predictions", display: !!user },
        { key: "footballKnockout", name: "Knockout Predictions", href: "/wk-2026/predictions/knockout", display: !!user },
        { key: "footballStandings", name: "Standings", href: "/wk-2026/standings", display: !!user },
        { key: "admin", name: t('header.menu.admin'), href: adminHref, display: isAdmin || impersonationStatus.isImpersonating },
    ];

    const currentPlatformConfig = getPlatformConfig(currentPlatform);
    const platformOptions = getAllPlatformConfigs().map((platform) => ({
        key: platform.key,
        label: platform.label,
    }));
    const profileLabel = impersonationStatus.isImpersonating
        ? impersonationStatus.impersonatedUser?.displayName || impersonationStatus.impersonatedUser?.email || user?.displayName || user?.email || 'Account'
        : user?.displayName || user?.email || 'Account';

    // Offset in px: sum of visible fixed banners above the header.
    // hideBetaBanner means the beta banner IS showing (prop name is confusing but matches LayoutShell usage)
    const bannerOffset =
        (hideBetaBanner ? 36 : 0) +
        (impersonationStatus.isImpersonating ? 16 : 0);

    // Only render nav items after hydration to avoid SSR mismatch
    const visibleMenuItems = mounted
        ? menuItems.filter((item) => item.display && currentPlatformConfig.headerMenuItems.includes(item.key))
        : [];

    const activeMenuHref = visibleMenuItems
        .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

    const isMenuItemActive = (href: string) => activeMenuHref === href;

    const handlePlatformChange = (platformKey: PlatformKey) => {
        if (typeof window === "undefined") return;
        const targetPlatform = getPlatformConfig(platformKey);
        if (targetPlatform.key === currentPlatform) return;
        const targetPath = user
            ? targetPlatform.authenticatedEntryPath
            : targetPlatform.rootEntryPath;
        window.location.href = buildPlatformUrl(window.location.host, targetPlatform, targetPath);
    };

    return (
        <header
            className="sticky w-[calc(100%-32px)] md:w-[calc(100%-64px)] z-40 h-[86px] px-4 left-4 right-4 md:left-8 md:right-8 rounded-md border backdrop-blur-md overflow-visible bg-[var(--platform-header-bg)] border-[var(--platform-header-border)] shadow-[var(--platform-header-shadow)]"
            style={{ top: `calc(${bannerOffset}px + var(--header-top))` }}
        >
            {/* Desktop nav */}
            <div className="container mx-auto hidden h-full lg:block">
                <div className="flex h-full items-center justify-between gap-4">
                    {/* Left: logo + title + separator + nav */}
                    <div className="flex items-center gap-0 min-w-0">
                        <Link href="/account" className="shrink-0">
                            <Image
                                src="/logo.png"
                                alt="Oracle Games Logo"
                                width={56}
                                height={56}
                                priority
                                className="cursor-pointer hover:opacity-80 transition-opacity [filter:var(--platform-logo-filter)]"
                            />
                        </Link>
                        <div className="whitespace-nowrap text-3xl ml-4 shrink-0 text-[var(--platform-header-title)]">
                            Oracle Games
                        </div>

                        <div className="h-8 w-px shrink-0 mx-4 bg-[var(--platform-header-border)]" />

                        <div className="flex items-center">
                            {visibleMenuItems.map((item) => (
                                <div key={item.name} className="relative flex items-center px-3 h-full group">
                                    <Link
                                        href={item.href}
                                        className={`whitespace-nowrap transition-colors duration-150 hover:[text-shadow:0_0_0.4px_currentColor] ${isMenuItemActive(item.href) ? 'text-[var(--platform-header-link-active)] font-semibold' : 'text-[var(--platform-header-link)]'}`}
                                    >
                                        {item.name}
                                    </Link>
                                    {isMenuItemActive(item.href) && (
                                        <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[var(--platform-header-accent)]" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: platform selector + user menu */}
                    <div className="flex items-center gap-2 shrink-0">
                        <PlatformSelector
                            currentPlatform={currentPlatform}
                            platformOptions={platformOptions}
                            onPlatformChange={handlePlatformChange}
                            className="min-w-[170px]"
                            buttonClassName="rounded-full py-2 pl-4 pr-3"
                        />

                        {user && (
                            <Link
                                href={getPlatformConfig(currentPlatform).accountPath}
                                className="relative whitespace-nowrap cursor-pointer text-[var(--platform-header-link)] hover:[text-shadow:0_0_0.4px_currentColor] transition-colors duration-150"
                            >
                                {loading ? '...' : profileLabel}
                                {unreadCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile nav */}
            <div className="lg:hidden h-[86px] items-center justify-center content-center flex">
                <div className="flex-1 flex items-center justify-center">
                    <Link href="/account">
                        <Image
                            src="/logo.png"
                            alt="Oracle Games Logo"
                            width={56}
                            height={56}
                            priority
                            className="cursor-pointer hover:opacity-80 transition-opacity [filter:var(--platform-logo-filter)]"
                        />
                    </Link>
                    <div className="flex-1 whitespace-nowrap text-3xl ml-4 text-[var(--platform-header-title)]">
                        Oracle Games
                    </div>
                </div>

                {/* Hamburger button */}
                <button
                    className="cursor-pointer w-10 h-10 flex flex-col items-center justify-center gap-1.5 relative"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label={isMenuOpen ? "Sluit menu" : "Open menu"}
                >
                    <span
                        className="w-6 h-0.5 block bg-[var(--platform-header-title)] transition-transform duration-300 ease-in-out"
                        style={{ transform: isMenuOpen ? "translateY(8px) rotate(45deg)" : "translateY(0) rotate(0)" }}
                    />
                    <span
                        className="w-6 h-0.5 block bg-[var(--platform-header-title)] transition-opacity duration-200 ease-in-out"
                        style={{ opacity: isMenuOpen ? 0 : 1 }}
                    />
                    <span
                        className="w-6 h-0.5 block bg-[var(--platform-header-title)] transition-transform duration-300 ease-in-out"
                        style={{ transform: isMenuOpen ? "translateY(-8px) rotate(-45deg)" : "translateY(0) rotate(0)" }}
                    />
                </button>

                <MobileMenu
                    isOpen={isMenuOpen}
                    onClose={() => setIsMenuOpen(false)}
                    menuItems={visibleMenuItems}
                    profileHref={getPlatformConfig(currentPlatform).accountPath}
                    user={user}
                    pathname={pathname}
                    topOffset={bannerOffset}
                    currentPlatform={currentPlatform}
                    platformOptions={platformOptions}
                    onPlatformChange={handlePlatformChange}
                />
            </div>
        </header>
    );
};
