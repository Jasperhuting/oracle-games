'use client'
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "firebase/auth";
import type { PlatformKey } from "@/lib/platform";
import { PlatformSelector } from "./PlatformSelector";

interface NavItem {
    name: string;
    href: string;
    display: boolean;
}

interface ProfileItem {
    name: string;
    href?: string;
    icon: React.ReactNode;
    display: boolean;
    onClick?: () => void;
}

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    menuItems: NavItem[];
    profileItems: ProfileItem[];
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
    profileItems,
    user,
    pathname,
    topOffset,
    currentPlatform,
    platformOptions,
    onPlatformChange,
}: MobileMenuProps) => {
    const router = useRouter();
    const headerHeight = 86;    
    const menuTop = topOffset + headerHeight; // below header + half side margin gap

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
                        style={{ top: `${menuTop}px` }}
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
                        className="fixed right-0 md:right-0 w-80 z-50 p-6 overflow-y-auto border rounded-2xl"
                        style={{
                            top: `${menuTop}px`,
                            height: `h-fit`,
                            background: "var(--platform-mobile-menu-bg)",
                            borderColor: "var(--platform-header-border)",
                            color: "var(--platform-header-title)",
                            boxShadow: "var(--platform-header-shadow)",
                        }}
                    >
                        <nav className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="px-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--platform-header-link)" }}>
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
                                        className="text-lg py-3 px-4 rounded-lg transition-all duration-150"
                                        style={{
                                            color: item.href === pathname
                                                ? "var(--platform-header-link-active)"
                                                : "var(--platform-header-link)",
                                            background: item.href === pathname
                                                ? "var(--platform-header-accent-soft)"
                                                : "transparent",
                                            fontWeight: item.href === pathname ? 600 : 400,
                                        }}
                                    >
                                        {item.name}
                                    </Link>
                                ))}
                            </div>

                            {/* Divider */}
                            {user && <div className="border-t" style={{ borderColor: "var(--platform-header-border)" }} />}

                            {/* Profile Items */}
                            {user && (
                                <div className="flex flex-col gap-2">
                                    {profileItems.filter(item => item.display).map((item) => (
                                        <button
                                            key={item.name}
                                            onClick={() => {
                                                if (item.onClick) {
                                                    item.onClick();
                                                } else if (item.href) {
                                                    router.push(item.href);
                                                }
                                                onClose();
                                            }}
                                            className="flex items-center gap-3 text-lg py-3 px-4 rounded-lg transition-all duration-150 text-left w-full"
                                            style={{
                                                color: item.href === pathname
                                                    ? "var(--platform-header-link-active)"
                                                    : "var(--platform-header-link)",
                                                background: item.href === pathname
                                                    ? "var(--platform-header-accent-soft)"
                                                    : "transparent",
                                                fontWeight: item.href === pathname ? 600 : 400,
                                            }}
                                        >
                                            {item.icon}
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Login link for non-authenticated users */}
                            {!user && (
                                <Link
                                    href="/login"
                                    onClick={onClose}
                                    className="text-lg py-3 px-4 rounded-lg transition-all duration-150"
                                    style={{
                                        color: '/login' === pathname
                                            ? "var(--platform-header-link-active)"
                                            : "var(--platform-header-link)",
                                        background: '/login' === pathname
                                            ? "var(--platform-header-accent-soft)"
                                            : "transparent",
                                        fontWeight: '/login' === pathname ? 600 : 400,
                                    }}
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
