'use client'
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const Header = ({ hideBetaBanner }: { hideBetaBanner: boolean }) => {

    const pathname = usePathname()
    const router = useRouter();

    const { user, loading } = useAuth();

      
        const [isAdmin, setIsAdmin] = useState(false);
    
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
    

    

    const MenuItems =  [
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
                    <div className="menu-container flex flex-1 gap-3 justify-end my-2">
                    <div className="flex divide-solid divide-[#CAC4D0] divide-x my-3 justify-center align-middle">
                        {/* it should show the admin only if isAdmin is true */}
                        {MenuItems.filter((item) => !isAdmin ? item.name !== 'admin' : true).filter(item => item.display).map((item) => (
                            <div key={item.name} className="gap-1 flex flex-col items-center px-3 hover:[text-shadow:0_0_0.4px_currentColor] group">
                            <Link key={item.name} href={item.href} className={`text-gray-900 whitespace-nowrap ${item.href === pathname ? 'text-primary font-bold' : ''}`}>
                                {item.name}
                            </Link>
                            <span className={`w-full h-[2px]   group-hover:bg-primary ${item.href === pathname ? 'bg-primary' : 'bg-white'}`}></span>
                            </div>
                        ))}
                    </div>
                    <div className="flex divide-solid divide-[#CAC4D0] divide-x my-3 justify-center align-middle">
                        <div key={'account'} className="gap-1 flex flex-col items-center px-3 hover:[text-shadow:0_0_0.4px_currentColor] group">
                            {user?.displayName || user?.email ? (<Link href={'/account'} className={`text-gray-900 whitespace-nowrap ${'/account' === pathname ? 'text-primary font-bold' : ''}`}>
                                {loading ? '...loading' : user?.displayName || user?.email || 'Account'}
                            </Link>) : (
                                <Link href={'/login'} className={`text-gray-900 whitespace-nowrap ${'/login' === pathname ? 'text-primary font-bold' : ''}`}>
                                    Login
                                </Link>
                            )}
                            <span className={`w-full h-[2px]   group-hover:bg-primary ${'/login' === pathname ? 'bg-primary' : 'bg-white'}`}></span>
                            </div>

                        
                        {user?.displayName || user?.email ? (<div key={'logout'} className="gap-1 flex flex-col items-center px-3 hover:[text-shadow:0_0_0.4px_currentColor] group">
                            <span onClick={handleLogout} className={`text-gray-900 whitespace-nowrap cursor-pointer ${'account' === pathname ? 'text-primary font-bold' : ''}`}>
                                Logout
                            </span>
                            <span className={`w-full h-[2px]   group-hover:bg-primary ${'account' === pathname ? 'bg-primary' : 'bg-white'}`}></span>
                            </div>) : (<></>)}

                        


                        
                    </div>
                    </div>
                </div>
            </div>
        </header>
    );
}