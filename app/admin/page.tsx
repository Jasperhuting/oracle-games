'use client'

import { UserList } from "@/components/UserList";
import { Tabs } from "@/components/Tabs";
import { GamesTab } from "@/components/GamesTab";
import { ForumTab } from "@/components/ForumTab";
import { ActivityLogTab } from "@/components/ActivityLogTab";
import { AddGameTab } from "@/components/AddGameTab";
import { CreateGameTab } from "@/components/CreateGameTab";
import { GamesManagementTab } from "@/components/GamesManagementTab";
import { RidersManagementTab } from "@/components/RidersManagementTab";
import { RacesScraperTab } from "@/components/RacesScraperTab";
import { GameRulesTab } from "@/components/GameRulesTab";
import { FeedbackTab } from "@/components/FeedbackTab";
import { PageEditor } from "@/components/PageEditor";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

import { ArrowRight } from "tabler-icons-react";

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
                <div className="text-gray-600">Loading...</div>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen p-8 mt-[36px] bg-gray-50">
            <div className="container mx-auto">
                

                <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

                <div className="flex flex-row border border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
                    <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        Back to Home
                    </Link>
                    <ArrowRight className="mx-2" size={16} />
                    <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        Admin
                    </Link>
                </div>

                <Tabs
                    defaultTab="users"
                    tabs={[
                        {
                            id: 'users',
                            label: 'Users',
                            content: <UserList />
                        },
                        {
                            id: 'games',
                            label: 'Races',
                            content: <GamesTab />
                        },
                        {
                            id: 'add-game',
                            label: 'Add Race',
                            content: <AddGameTab />
                        },
                        {
                            id: 'create-game',
                            label: 'Create Game',
                            content: <CreateGameTab />
                        },
                        {
                            id: 'games-management',
                            label: 'Manage Games',
                            content: <GamesManagementTab />
                        },
                        {
                            id: 'riders',
                            label: 'Manage Riders',
                            content: <RidersManagementTab />
                        },
                        {
                            id: 'scrape-races',
                            label: 'Scrape Races',
                            content: <RacesScraperTab />
                        },
                        {
                            id: 'game-rules',
                            label: 'Game Rules',
                            content: <GameRulesTab />
                        },
                        {
                            id: 'pages-editor',
                            label: 'Pages Editor',
                            content: <PageEditor />
                        },
                        {
                            id: 'feedback',
                            label: 'Feedback',
                            content: <FeedbackTab />
                        },
                        {
                            id: 'forum',
                            label: 'Forum',
                            content: <ForumTab />
                        },
                        {
                            id: 'activity',
                            label: 'Activity Log',
                            content: <ActivityLogTab />
                        }
                    ]}
                />
            </div>
        </div>
    );
}