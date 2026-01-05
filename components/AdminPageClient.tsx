'use client'

import { UserList } from "@/components/UserList";
import { NestedTabs } from "@/components/NestedTabs";
import { GamesTab } from "@/components/GamesTab";
import { ForumTab } from "@/components/ForumTab";
import { ActivityLogTab } from "@/components/ActivityLogTab";
import { DeploymentsTab } from "@/components/DeploymentsTab";
import { AddGameTab } from "@/components/AddGameTab";
import { CreateGameTab } from "@/components/CreateGameTab";
import { GamesManagementTab } from "@/components/GamesManagementTab";
import { RidersManagementTab } from "@/components/RidersManagementTab";
import { AddRiderTab } from "@/components/AddRiderTab";
import { EnrichTeamTab } from "@/components/EnrichTeamTab";
import { EnrichRidersTab } from "@/components/EnrichRidersTab";
import { RacesScraperTab } from "@/components/RacesScraperTab";
import { GameRulesTab } from "@/components/GameRulesTab";
import { GameCategoriesTab } from "@/components/GameCategoriesTab";
import { FeedbackTab } from "@/components/FeedbackTab";
import { PageEditor } from "@/components/PageEditor";
import MessagingTab from "@/components/MessagingTab";
import { DataMigrationsTab } from "@/components/DataMigrationsTab";
import { TranslationsTab } from "@/components/TranslationsTab";
import { BidBackupTab } from "@/components/BidBackupTab";
import { FinalizeOverviewTab } from "@/components/FinalizeOverviewTab";
import { SimulateResultsTab } from "@/components/SimulateResultsTab";
import { TodosTab } from "@/components/TodosTab";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import { ArrowRight } from "tabler-icons-react";

export default function AdminPageClient() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isProgrammer, setIsProgrammer] = useState(false);
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
                            // Check if user is also a programmer
                            if (userData.programmer === true) {
                                setIsProgrammer(true);
                            }
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

                <NestedTabs
                    defaultGroup="community"
                    defaultTab="users"
                    groups={[
                        {
                            id: 'community',
                            label: 'Gebruikers & Community',
                            tabs: [
                                {
                                    id: 'users',
                                    label: t('admin.tabs.users'),
                                    content: <UserList />
                                },
                                {
                                    id: 'messaging',
                                    label: t('admin.tabs.messaging'),
                                    content: <MessagingTab />
                                },
                                {
                                    id: 'forum',
                                    label: t('admin.tabs.forum'),
                                    content: <ForumTab />
                                },
                                {
                                    id: 'feedback',
                                    label: t('admin.tabs.feedback'),
                                    content: <FeedbackTab />
                                }
                            ]
                        },
                        {
                            id: 'games',
                            label: 'Games Management',
                            tabs: [
                                {
                                    id: 'races',
                                    label: t('admin.tabs.races'),
                                    content: <GamesTab />
                                },
                                {
                                    id: 'add-game',
                                    label: t('admin.tabs.addRace'),
                                    content: <AddGameTab />
                                },
                                {
                                    id: 'create-game',
                                    label: t('admin.tabs.createGame'),
                                    content: <CreateGameTab />
                                },
                                {
                                    id: 'games-management',
                                    label: t('admin.tabs.manageGames'),
                                    content: <GamesManagementTab />
                                },
                                {
                                    id: 'scrape-races',
                                    label: t('admin.tabs.scrapeRaces'),
                                    content: <RacesScraperTab />
                                },
                                {
                                    id: 'bid-backup',
                                    label: 'Bid Backup',
                                    content: <BidBackupTab />
                                },
                                {
                                    id: 'finalize-overview',
                                    label: 'Finalize Overzicht',
                                    content: <FinalizeOverviewTab />
                                },
                                {
                                    id: 'simulate-results',
                                    label: '🎲 Simuleer Results',
                                    content: <SimulateResultsTab />
                                }
                            ]
                        },
                        {
                            id: 'content',
                            label: 'Content Management',
                            tabs: [
                                {
                                    id: 'riders',
                                    label: t('admin.tabs.manageRiders'),
                                    content: <RidersManagementTab />
                                },
                                {
                                    id: 'add-rider',
                                    label: 'Voeg Renner Toe',
                                    content: <AddRiderTab />
                                },
                                {
                                    id: 'enrich-team',
                                    label: 'Verrijk Team',
                                    content: <EnrichTeamTab />
                                },
                                {
                                    id: 'enrich-riders',
                                    label: 'Verrijk Renners',
                                    content: <EnrichRidersTab />
                                },
                                {
                                    id: 'game-categories',
                                    label: 'Game Categories',
                                    content: <GameCategoriesTab />
                                },
                                {
                                    id: 'game-rules',
                                    label: t('admin.tabs.gameRules'),
                                    content: <GameRulesTab />
                                },
                                {
                                    id: 'pages-editor',
                                    label: t('admin.tabs.pagesEditor'),
                                    content: <PageEditor />
                                },
                                {
                                    id: 'translations',
                                    label: t('admin.tabs.translations'),
                                    content: <TranslationsTab isProgrammer={isProgrammer} />
                                }
                            ]
                        },
                        {
                            id: 'system',
                            label: 'Systeem',
                            tabs: [
                                {
                                    id: 'todos',
                                    label: 'Todo\'s',
                                    content: <TodosTab />
                                },
                                {
                                    id: 'deployments',
                                    label: t('admin.tabs.deployments'),
                                    content: <DeploymentsTab />
                                },
                                {
                                    id: 'activity',
                                    label: t('admin.tabs.activityLog'),
                                    content: <ActivityLogTab />
                                },
                                {
                                    id: 'migrations',
                                    label: t('admin.tabs.dataMigrations'),
                                    content: <DataMigrationsTab />
                                }
                            ]
                        }
                    ]}
                />
            </div>
        </div>
    );
}
