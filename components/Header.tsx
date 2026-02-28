'use client'
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { auth } from "@/lib/firebase/client";
import { signOut, User } from "firebase/auth";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logout, UserCircle, ChevronDown, Mail } from "tabler-icons-react";
import { MenuItem, MenuProvider, Menu } from "./ProfileMenu";
import { Menubar, MenuButton, useMenuContext, useStoreState } from "@ariakit/react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";


const ProfileMenuButton = ({ user, loading, pathname, unreadCount }: { user: User, loading: boolean, pathname: string, unreadCount: number }) => {
    const menu = useMenuContext();
    const isOpen = useStoreState(menu, 'open') || false;

    return (
        <MenuItem className="bg-white! hover:bg-white!" render={<MenuButton />}>
            {user?.displayName || user?.email ? (
                loading ? '...loading' : (
                    <span className="flex items-center gap-2 cursor-pointer whitespace-nowrap hover:[text-shadow:0_0_0.4px_currentColor]">
                        <span className="relative">
                            {user?.displayName || user?.email || 'Account'}
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
                <Link href={'/login'} className={`text-gray-900 whitespace-nowrap ${'/login' === pathname ? 'text-primary font-bold' : ''}`}>
                    Login
                </Link>
            )}
        </MenuItem>
    );
};

export const Header = ({ hideBetaBanner }: { hideBetaBanner: boolean }) => {

    const pathname = usePathname()
    const router = useRouter();
    const { t } = useTranslation();

    const { user, loading, impersonationStatus } = useAuth();
    const { unreadCount } = useUnreadMessages(user?.uid);
    const [isAdmin, setIsAdmin] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
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
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };


        const profileItems = [
        {
            name: t('header.menu.profile'),
            href: "/account",
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
    ]




    const MenuItems = [
        {
            name: t('header.menu.games'),
            href: "/games",
            display: true
        },
        {
            name: t('header.menu.riderPoints'),
            href: "/rider-points",
            display: false
        },
        {
            name: t('header.menu.forum'),
            href: "/forum",
            display: isAdmin || impersonationStatus.isImpersonating
        },
        {
            name: t('header.menu.myGames'),
            href: "/myGames",
            display: false
        },
        {
            name: t('header.menu.admin'),
            href: "/admin",
            display: true
        }
    ]

    // Calculate header top position based on banners
    const getHeaderTop = () => {
        let top = 0;
        if (hideBetaBanner) top += 36; // Beta banner
        if (impersonationStatus.isImpersonating) top += 48; // Impersonation banner
        return top;
    };


    return (
        <header 
            className="sticky w-full bg-white drop-shadow-header z-40 h-[86px] px-8"
            style={{ top: `sm:${getHeaderTop()}px` }}
        >
            <div className="container mx-auto hidden md:block">
                <div className="flex flex-1 justify-between py-2">
                    <div className="flex-1 flex items-center">
                        <Link href="/account">
                            <Image 
                                src="/logo.png" 
                                alt="Oracle Games Logo" 
                                width={56} 
                                height={56}
                                priority
                                className="cursor-pointer hover:opacity-80 transition-opacity" 
                            />
                        </Link>
                        <div className="flex-1 whitespace-nowrap text-3xl ml-4">
                            Oracle Games
                        </div>
                    </div>
                    <div className="menu-container flex flex-1 justify-end my-2 divide-solid divide-[#CAC4D0] divide-x">
                        <div className="flex divide-solid divide-[#CAC4D0] divide-x my-3 justify-center align-middle">
                            {/* it should show the admin only if isAdmin is true */}
                            {mounted && MenuItems.filter((item) => !isAdmin ? item.name !== 'Admin' : true).filter(item => item.display).map((item) => (
                                <div key={item.name} className="gap-1 flex flex-col items-center px-3 group">
                                    <Link key={item.name} href={item.href} className={`whitespace-nowrap transition-colors duration-150 ${item.href === pathname ? 'text-primary font-semibold' : 'text-gray-700 hover:text-gray-900 hover:[text-shadow:0_0_0.4px_currentColor]'}`}>
                                        {item.name}
                                    </Link>
                                    <span className={`w-full h-[2px] rounded-full transition-all duration-200 group-hover:bg-primary/50 ${item.href === pathname ? 'bg-primary' : 'bg-transparent'}`}></span>
                                </div>
                            ))}
                        </div>
                        <div className="flex divide-solid divide-[#CAC4D0] divide-x justify-center align-middle">
                            <div key={'account'} className="relative gap-1 flex flex-col items-center px-3 group justify-center align-middle">
                                <Menubar>
                                    <MenuProvider>
                                        {user && <ProfileMenuButton user={user} loading={loading} pathname={pathname} unreadCount={unreadCount} />}
                                        <Menu>
                                            {profileItems.filter((item) => item.display).map((item) => {
                                                return <MenuItem key={item.name} onClick={() => item.onClick ? item.onClick() : router.push(item.href)} className={`whitespace-nowrap py-2.5 px-4 transition-colors duration-100 hover:bg-gray-50 rounded cursor-pointer ${item.href === pathname ? 'text-primary font-semibold' : 'text-gray-700'}`}>
                                                    <span className="mr-2">{item.icon}</span>
                                                    {item.name}
                                                </MenuItem>
                                            })}
                                        </Menu>
                                    </MenuProvider>
                                </Menubar>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="md:hidden h-[86px] items-center justify-center content-center flex ">
                <div className="flex-1 flex items-center justify-center">
                        <Link href="/account">
                            <Image 
                                src="/logo.png" 
                                alt="Oracle Games Logo" 
                                width={56} 
                                height={56}
                                priority
                                className="cursor-pointer hover:opacity-80 transition-opacity" 
                            />
                        </Link>
                        <div className="flex-1 whitespace-nowrap text-3xl ml-4">
                            Oracle Games
                        </div>
                    </div>
                    <button
                        className="cursor-pointer w-10 h-10 flex flex-col items-center justify-center gap-1.5 relative"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                    >
                        <motion.span
                            animate={isMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="w-6 h-0.5 bg-gray-900 block"
                        />
                        <motion.span
                            animate={isMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="w-6 h-0.5 bg-gray-900 block"
                        />
                        <motion.span
                            animate={isMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="w-6 h-0.5 bg-gray-900 block"
                        />
                    </button>

                    <AnimatePresence>
                        {isMenuOpen && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                                    style={{ top: `${getHeaderTop() + 86}px` }}
                                    onClick={() => setIsMenuOpen(false)}
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
                                            setIsMenuOpen(false);
                                        }
                                    }}
                                    className="fixed top-[86px] right-0 h-[calc(100vh-86px)] w-80 bg-white shadow-lg z-50 p-6 overflow-y-auto"
                                    style={{ top: `sm:${getHeaderTop() + 86}px` }}
                                >
                                    <nav className="flex flex-col gap-4">
                                        {/* Menu Items */}
                                        <div className="flex flex-col gap-2">
                                            {mounted && MenuItems.filter((item) => !isAdmin ? item.name !== 'Admin' : true).filter(item => item.display).map((item) => (
                                                <Link
                                                    key={item.name}
                                                    href={item.href}
                                                    onClick={() => setIsMenuOpen(false)}
                                                    className={`text-lg py-3 px-4 rounded-lg transition-all duration-150 ${
                                                        item.href === pathname
                                                            ? 'text-primary font-semibold bg-primary/10'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                    }`}
                                                >
                                                    {item.name}
                                                </Link>
                                            ))}
                                        </div>

                                        {/* Divider */}
                                        {user && <div className="border-t border-gray-200" />}

                                        {/* Profile Items */}
                                        {user && (
                                            <div className="flex flex-col gap-2">
                                                {profileItems.filter((item) => item.display).map((item) => (
                                                    <button
                                                        key={item.name}
                                                        onClick={() => {
                                                            if (item.onClick) {
                                                                item.onClick();
                                                            } else if (item.href) {
                                                                router.push(item.href);
                                                            }
                                                            setIsMenuOpen(false);
                                                        }}
                                                        className={`flex items-center gap-3 text-lg py-3 px-4 rounded-lg transition-all duration-150 text-left w-full ${
                                                            item.href === pathname
                                                                ? 'text-primary font-semibold bg-primary/10'
                                                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                        }`}
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
                                                onClick={() => setIsMenuOpen(false)}
                                                className={`text-lg py-3 px-4 rounded-lg transition-all duration-150 ${
                                                    '/login' === pathname
                                                        ? 'text-primary font-semibold bg-primary/10'
                                                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                }`}
                                            >
                                                Login
                                            </Link>
                                        )}
                                    </nav>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

            </div>
        </header>
    );
}
