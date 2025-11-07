'use client'

import { UserList } from "@/components/UserList";
import { Tabs } from "@/components/Tabs";
import { GamesTab } from "@/components/GamesTab";
import { ForumTab } from "@/components/ForumTab";
import { ActivityLogTab } from "@/components/ActivityLogTab";
import { AddGameTab } from "@/components/AddGameTab";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!loading && !user) {
                router.push('/login');
                return;
            }

            if (user) {
                // Check if user is admin
                try {
                    const response = await fetch(`/api/getUser?userId=${user.uid}`);
                    if (response.ok) {
                        const userData = await response.json();
                        if (userData.userType === 'admin') {
                            setIsAdmin(true);
                        } else {
                            router.push('/home');
                        }
                    }
                } catch (error) {
                    console.error('Error checking admin status:', error);
                    router.push('/home');
                } finally {
                    setChecking(false);
                }
            }
        };

        checkAdminStatus();
    }, [user, loading, router]);

    if (loading || checking) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600">Laden...</div>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen p-8 bg-gray-50">
            <div className="max-w-7xl mx-auto w-full">
                <div className="flex flex-row border-b border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
                    <Link href="/home">
                        <img src="/logo.png" alt="" className="w-12 h-12 cursor-pointer hover:opacity-80 transition-opacity" />
                    </Link>
                    <div className="flex-1 whitespace-nowrap text-3xl ml-4">
                        Oracle Games - Admin
                    </div>
                    <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        Terug naar home
                    </Link>
                </div>

                <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

                <Tabs
                    defaultTab="users"
                    tabs={[
                        {
                            id: 'users',
                            label: 'Gebruikers',
                            content: <UserList />
                        },
                        {
                            id: 'games',
                            label: 'Races',
                            content: <GamesTab />
                        },
                        {
                            id: 'add-game',
                            label: 'Race Toevoegen',
                            content: <AddGameTab />
                        },
                        {
                            id: 'forum',
                            label: 'Forum',
                            content: <ForumTab />
                        },
                        {
                            id: 'activity',
                            label: 'Activiteiten Log',
                            content: <ActivityLogTab />
                        }
                    ]}
                />
            </div>
        </div>
    );
}