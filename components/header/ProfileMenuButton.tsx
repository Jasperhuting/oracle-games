'use client'
import { useMenuContext, useStoreState } from "@ariakit/react";
import { MenuButton } from "@ariakit/react";
import Link from "next/link";
import { ChevronDown } from "tabler-icons-react";
import type { User } from "firebase/auth";
import { MenuItem } from "../ProfileMenu";

interface ProfileMenuButtonProps {
    user: User;
    loading: boolean;
    pathname: string;
    unreadCount: number;
    label?: string;
}

export const ProfileMenuButton = ({ user, loading, pathname, unreadCount, label }: ProfileMenuButtonProps) => {
    const menu = useMenuContext();
    const isOpen = useStoreState(menu, 'open') || false;
    const displayLabel = label || user?.displayName || user?.email || 'Account';

    return (
        <MenuItem
            className="hover:opacity-90"
            render={<MenuButton />}
            style={{ background: "transparent", color: "var(--platform-header-link)" }}
        >
            {displayLabel ? (
                loading ? '...loading' : (
                    <span className="flex items-center gap-2 cursor-pointer whitespace-nowrap hover:[text-shadow:0_0_0.4px_currentColor]">
                        <span className="relative">
                            {displayLabel}
                            {unreadCount > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </span>
                        <ChevronDown
                            className={`transition-transform duration-400 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                        />
                    </span>
                )
            ) : (
                <Link
                    href={'/login'}
                    className="whitespace-nowrap"
                    style={{
                        color: '/login' === pathname
                            ? "var(--platform-header-link-active)"
                            : "var(--platform-header-title)",
                        fontWeight: '/login' === pathname ? 700 : 400,
                    }}
                >
                    Login
                </Link>
            )}
        </MenuItem>
    );
};
