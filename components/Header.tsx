'use client'
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, Logout, UserCircle, ArrowDown, ChevronDown } from "tabler-icons-react";
import { Menu, MenuItem, MenuProvider, MenuSeparator } from "./ProfileMenu";
import { MotionProps, Variants } from "framer-motion";
import { Menubar, MenuButton, useMenuContext, useStoreState } from "@ariakit/react";

const menu = {
    closed: {
        scale: 0,
        transition: {
            delay: 0.15,
        },
    },
    open: {
        scale: 1,
        transition: {
            type: "spring",
            duration: 0.4,
            delayChildren: 0.2,
            staggerChildren: 0.05,
        },
    },
} satisfies Variants;

const item = {
    variants: {
        closed: { x: -16, opacity: 0 },
        open: { x: 0, opacity: 1 },
    },
    transition: { opacity: { duration: 0.2 } },
} satisfies MotionProps;

const ProfileMenuButton = ({ user, loading, pathname }: { user: any, loading: boolean, pathname: string }) => {
    const menu = useMenuContext();
    const isOpen = useStoreState(menu, 'open') || false;

    return (
        <MenuItem className="bg-white! hover:bg-white!" render={<MenuButton />}>
            {user?.displayName || user?.email ? (
                loading ? '...loading' : (
                    <span className="flex items-center gap-2 cursor-pointer whitespace-nowrap hover:[text-shadow:0_0_0.4px_currentColor]">
                        {user?.displayName || user?.email || 'Account'}
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

    const { user, loading } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [mounted, setMounted] = useState(false);

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
            name: "Profile",
            href: "/account",
            icon: <UserCircle className="w-6 h-6" />,
            display: true
        },
        {
            name: "Logout",
            onClick: handleLogout,
            icon: <Logout className="w-6 h-6" />,
            display: true
        }
    ]




    const MenuItems = [
        {
            name: "Home",
            href: "/home",
            display: true
        },
        {
            name: "Games",
            href: "/games",
            display: true
        },
        {
            name: "Rider Points",
            href: "/rider-points",
            display: false
        },
        {
            name: "Forum",
            href: "/forum",
            display: false
        },
        {
            name: "GameCalendar",
            href: "/gameCalendar",
            display: false
        },
        {
            name: "MyGames",
            href: "/myGames",
            display: false
        },
        {
            name: "Admin",
            href: "/admin",
            display: true
        }
    ]

    return (
        <header className={`sticky ${hideBetaBanner ? 'top-[36px]' : 'top-0'} w-full bg-white drop-shadow-header z-50 h-[86px] px-8`}>
            <div className="container mx-auto">
                <div className="flex flex-1 justify-between py-2">
                    <div className="flex-1 flex items-center">
                        <Link href="/home">
                            <img src="/logo.png" alt="" className="w-14 h-14 cursor-pointer hover:opacity-80 transition-opacity" />
                        </Link>
                        <div className="flex-1 whitespace-nowrap text-3xl ml-4">
                            Oracle Games
                        </div>
                    </div>
                    <div className="menu-container flex flex-1 justify-end my-2 divide-solid divide-[#CAC4D0] divide-x">
                        <div className="flex divide-solid divide-[#CAC4D0] divide-x my-3 justify-center align-middle">
                            {/* it should show the admin only if isAdmin is true */}
                            {mounted && MenuItems.filter((item) => !isAdmin ? item.name !== 'Admin' : true).filter(item => item.display).map((item) => (
                                <div key={item.name} className="gap-1 flex flex-col items-center px-3 hover:[text-shadow:0_0_0.4px_currentColor] group">
                                    <Link key={item.name} href={item.href} className={`text-gray-900 whitespace-nowrap ${item.href === pathname ? 'text-primary font-bold' : ''}`}>
                                        {item.name}
                                    </Link>
                                    <span className={`w-full h-[2px]   group-hover:bg-primary ${item.href === pathname ? 'bg-primary' : 'bg-white'}`}></span>
                                </div>
                            ))}
                        </div>
                        <div className="flex divide-solid divide-[#CAC4D0] divide-x justify-center align-middle">
                            <div key={'account'} className="relative gap-1 flex flex-col items-center px-3 group justify-center align-middle">
                                <Menubar>
                                    <MenuProvider>
                                        <ProfileMenuButton user={user} loading={loading} pathname={pathname} />
                                        <Menu>
                                            {profileItems.map((item) => {
                                                return <MenuItem key={item.name} onClick={() => item.onClick ? item.onClick() : router.push(item.href)} className={`text-gray-900 whitespace-nowrap py-2 px-3 ${item.href === pathname ? 'text-primary font-bold' : ''}`}>
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
        </header>
    );
}