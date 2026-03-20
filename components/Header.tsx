'use client'
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { auth } from "@/lib/firebase/client";
import { clearSharedSession } from "@/lib/auth/client-session";
import { signOut } from "firebase/auth";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logout, UserCircle, Mail } from "tabler-icons-react";
import { MenuItem, MenuProvider, Menu } from "./ProfileMenu";
import { Menubar } from "@ariakit/react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ProfileMenuButton } from "./header/ProfileMenuButton";
import { MobileMenu } from "./header/MobileMenu";
import { PlatformSelector } from "./header/PlatformSelector";
import { buildPlatformUrl, getAllPlatformConfigs, getPlatformConfig, getPlatformConfigFromHost, type HeaderMenuKey, type PlatformKey } from "@/lib/platform";

export const Header = ({ hideBetaBanner }: { hideBetaBanner: boolean }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useTranslation();

    const { user, loading, impersonationStatus } = useAuth();
    const { unreadCount } = useUnreadMessages(user?.uid);
    const [isAdmin, setIsAdmin] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentPlatform, setCurrentPlatform] = useState<PlatformKey>("cycling");

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        setCurrentPlatform(getPlatformConfigFromHost(window.location.host).key);
    }, []);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (user) {
                try {
                    const response = await fetch(`/api/getUser?userId=${user.uid}`);
                    if (response.ok) {
                        const userData = await response.json();
                        setIsAdmin(userData.userType === 'admin');
                    }
                } catch (error) {
                    console.error('Error checking admin status:', error);
                }
            } else {
                setIsAdmin(false);
            }
        };
        checkAdminStatus();
    }, [user]);

    const handleLogout = async () => {
        try {
            await clearSharedSession();
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const profileItems = [
        {
            name: t('header.menu.profile'),
            href: getPlatformConfig(currentPlatform).accountPath,
            icon: <UserCircle className="w-6 h-6" />,
            display: true
        },
        {
            name: t('header.menu.inbox'),
            href: "/inbox",
            icon: (
                <div className="relative">
                    <Mail className="w-6 h-6" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </div>
            ),
            display: false
        },
        {
            name: t('header.menu.logout'),
            onClick: handleLogout,
            icon: <Logout className="w-6 h-6" />,
            display: true
        }
    ];

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
        { key: "footballPredictions", name: "Predictions", href: "/wk-2026/predictions", display: !!user },
        { key: "footballKnockout", name: "Knockout Predictions", href: "/wk-2026/predictions/knockout", display: !!user },
        { key: "footballStandings", name: "Standings", href: "/wk-2026/standings", display: !!user },
        { key: "admin", name: t('header.menu.admin'), href: adminHref, display: isAdmin },
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
            className="sticky w-[calc(100%-32px)] md:w-[calc(100%-64px)] z-40 h-[86px] px-4 left-4 right-4 md:left-8 md:right-8 rounded-md border backdrop-blur-md overflow-visible"
            style={{
                top: `${bannerOffset + 32}px`,
                background: "var(--platform-header-bg)",
                borderColor: "var(--platform-header-border)",
                boxShadow: "var(--platform-header-shadow)",
            }}
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
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ filter: "var(--platform-logo-filter)" }}
                            />
                        </Link>
                        <div className="whitespace-nowrap text-3xl ml-4 shrink-0" style={{ color: "var(--platform-header-title)" }}>
                            Oracle Games
                        </div>

                        <div
                            className="h-8 w-px shrink-0 mx-4"
                            style={{ background: "var(--platform-header-border)" }}
                        />

                        <div className="flex items-center">
                            {visibleMenuItems.map((item) => (
                                <div key={item.name} className="relative flex items-center px-3 h-full group">
                                    <Link
                                        href={item.href}
                                        className="whitespace-nowrap transition-colors duration-150 hover:[text-shadow:0_0_0.4px_currentColor]"
                                        style={{
                                            color: isMenuItemActive(item.href)
                                                ? "var(--platform-header-link-active)"
                                                : "var(--platform-header-link)",
                                            fontWeight: isMenuItemActive(item.href) ? 600 : 400,
                                        }}
                                    >
                                        {item.name}
                                    </Link>
                                    {isMenuItemActive(item.href) && (
                                        <span
                                            className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                                            style={{ backgroundColor: "var(--platform-header-accent)" }}
                                        />
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

                        <Menubar>
                            <MenuProvider>
                                {user && (
                                    <ProfileMenuButton
                                        user={user}
                                        loading={loading}
                                        pathname={pathname}
                                        unreadCount={unreadCount}
                                        label={profileLabel}
                                    />
                                )}
                                <Menu>
                                    {profileItems.filter(item => item.display).map((item) => (
                                        <MenuItem
                                            key={item.name}
                                            onClick={() => item.onClick ? item.onClick() : router.push(item.href!)}
                                            className="whitespace-nowrap py-2.5 px-4 transition-colors duration-100 rounded cursor-pointer"
                                            style={{
                                                color: item.href && isMenuItemActive(item.href)
                                                    ? "var(--platform-header-link-active)"
                                                    : "var(--platform-header-link)",
                                                fontWeight: item.href && isMenuItemActive(item.href) ? 600 : 400,
                                            }}
                                        >
                                            <span className="mr-2">{item.icon}</span>
                                            {item.name}
                                        </MenuItem>
                                    ))}
                                </Menu>
                            </MenuProvider>
                        </Menubar>
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
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ filter: "var(--platform-logo-filter)" }}
                        />
                    </Link>
                    <div className="flex-1 whitespace-nowrap text-3xl ml-4" style={{ color: "var(--platform-header-title)" }}>
                        Oracle Games
                    </div>
                </div>

                {/* Hamburger button */}
                <button
                    className="cursor-pointer w-10 h-10 flex flex-col items-center justify-center gap-1.5 relative"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label={isMenuOpen ? "Sluit menu" : "Open menu"}
                >
                    <motion.span
                        animate={isMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-6 h-0.5 block"
                        style={{ background: "var(--platform-header-title)" }}
                    />
                    <motion.span
                        animate={isMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="w-6 h-0.5 block"
                        style={{ background: "var(--platform-header-title)" }}
                    />
                    <motion.span
                        animate={isMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-6 h-0.5 block"
                        style={{ background: "var(--platform-header-title)" }}
                    />
                </button>

                <MobileMenu
                    isOpen={isMenuOpen}
                    onClose={() => setIsMenuOpen(false)}
                    menuItems={visibleMenuItems}
                    profileItems={profileItems}
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
