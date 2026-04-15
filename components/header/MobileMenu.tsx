'use client'
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "firebase/auth";
import type { PlatformKey } from "@/lib/platform";
import { PlatformSelector } from "./PlatformSelector";

interface NavItem {
    name: string;
    href: string;
    display: boolean;
}

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    menuItems: NavItem[];
    profileHref: string;
    user: User | null;
    pathname: string;
    topOffset: number;
    currentPlatform: PlatformKey;
    platformOptions: Array<{ key: PlatformKey; label: string }>;
    onPlatformChange: (platform: PlatformKey) => void;
}

export const MobileMenu = ({
    isOpen,
    onClose,
    menuItems,
    profileHref,
    user,
    pathname,
    topOffset,
    currentPlatform,
    platformOptions,
    onPlatformChange,
}: MobileMenuProps) => {
    const headerHeight = 86;
    // Use the same CSS variable as the header so mobile (16px) and desktop (32px) stay in sync
    const menuTopStyle = `calc(${topOffset}px + var(--header-top) + ${headerHeight}px)`;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-black bg-opacity-50 z-40"
                        style={{ top: menuTopStyle }}
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.3 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={{ left: 0, right: 0.5 }}
                        onDragEnd={(event, info) => {
                            if (info.offset.x > 100 || info.velocity.x > 500) {
                                onClose();
                            }
                        }}
                        className="fixed right-0 md:right-0 w-80 z-50 p-6 overflow-y-auto border rounded-2xl h-fit bg-[var(--platform-mobile-menu-bg)] border-[var(--platform-header-border)] text-[var(--platform-header-title)] shadow-[var(--platform-header-shadow)]"
                        style={{ top: menuTopStyle }}
                    >
                        <nav className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--platform-header-link)]">
                                    Platform
                                </label>
                                <PlatformSelector
                                    currentPlatform={currentPlatform}
                                    platformOptions={platformOptions}
                                    onPlatformChange={(platform) => {
                                        onPlatformChange(platform);
                                        onClose();
                                    }}
                                    className="w-full"
                                    buttonClassName="py-3 text-base"
                                    dropdownClassName="left-0 right-0"
                                />
                            </div>

                            {/* Menu Items */}
                            <div className="flex flex-col gap-2">
                                {menuItems.filter(item => item.display).map((item) => (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={onClose}
                                        className={`text-lg py-3 px-4 rounded-lg transition-all duration-150 ${item.href === pathname ? 'text-[var(--platform-header-link-active)] bg-[var(--platform-header-accent-soft)] font-semibold' : 'text-[var(--platform-header-link)]'}`}
                                    >
                                        {item.name}
                                    </Link>
                                ))}
                            </div>

                            {/* Divider */}
                            {user && <div className="border-t border-[var(--platform-header-border)]" />}

                            {/* Profile link */}
                            {user && (
                                <Link
                                    href={profileHref}
                                    onClick={onClose}
                                    className={`text-lg py-3 px-4 rounded-lg transition-all duration-150 ${profileHref === pathname ? 'text-[var(--platform-header-link-active)] bg-[var(--platform-header-accent-soft)] font-semibold' : 'text-[var(--platform-header-link)]'}`}
                                >
                                    Mijn profiel
                                </Link>
                            )}

                            {/* Login link for non-authenticated users */}
                            {!user && (
                                <Link
                                    href="/login"
                                    onClick={onClose}
                                    className={`text-lg py-3 px-4 rounded-lg transition-all duration-150 ${'/login' === pathname ? 'text-[var(--platform-header-link-active)] bg-[var(--platform-header-accent-soft)] font-semibold' : 'text-[var(--platform-header-link)]'}`}
                                >
                                    Login
                                </Link>
                            )}
                        </nav>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
