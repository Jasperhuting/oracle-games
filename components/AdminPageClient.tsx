'use client'

import dynamic from "next/dynamic";
import { NestedTabs } from "@/components/NestedTabs";

const UserList = dynamic(() => import("@/components/UserList").then(m => ({ default: m.UserList })));
const GamesTab = dynamic(() => import("@/components/GamesTab").then(m => ({ default: m.GamesTab })));
const ActivityLogTab = dynamic(() => import("@/components/ActivityLogTab").then(m => ({ default: m.ActivityLogTab })));
const DeploymentsTab = dynamic(() => import("@/components/DeploymentsTab").then(m => ({ default: m.DeploymentsTab })));
const AddGameTab = dynamic(() => import("@/components/AddGameTab").then(m => ({ default: m.AddGameTab })));
const CreateGameTab = dynamic(() => import("@/components/CreateGameTab").then(m => ({ default: m.CreateGameTab })));
const GamesManagementTab = dynamic(() => import("@/components/GamesManagementTab").then(m => ({ default: m.GamesManagementTab })));
const RidersManagementTab = dynamic(() => import("@/components/RidersManagementTab").then(m => ({ default: m.RidersManagementTab })));
const AddRiderTab = dynamic(() => import("@/components/AddRiderTab").then(m => ({ default: m.AddRiderTab })));
const EnrichTeamTab = dynamic(() => import("@/components/EnrichTeamTab").then(m => ({ default: m.EnrichTeamTab })));
const EnrichRidersTab = dynamic(() => import("@/components/EnrichRidersTab").then(m => ({ default: m.EnrichRidersTab })));
const RacesScraperTab = dynamic(() => import("@/components/RacesScraperTab").then(m => ({ default: m.RacesScraperTab })));
const GameRulesTab = dynamic(() => import("@/components/GameRulesTab").then(m => ({ default: m.GameRulesTab })));
const GameCategoriesTab = dynamic(() => import("@/components/GameCategoriesTab").then(m => ({ default: m.GameCategoriesTab })));
const FeedbackTab = dynamic(() => import("@/components/FeedbackTab").then(m => ({ default: m.FeedbackTab })));
const PageEditor = dynamic(() => import("@/components/PageEditor").then(m => ({ default: m.PageEditor })));
const MessagingTab = dynamic(() => import("@/components/MessagingTab"));
const DataMigrationsTab = dynamic(() => import("@/components/DataMigrationsTab").then(m => ({ default: m.DataMigrationsTab })));
const TranslationsTab = dynamic(() => import("@/components/TranslationsTab").then(m => ({ default: m.TranslationsTab })));
const EmailTemplatesTab = dynamic(() => import("@/components/EmailTemplatesTab").then(m => ({ default: m.EmailTemplatesTab })));
const BidBackupTab = dynamic(() => import("@/components/BidBackupTab").then(m => ({ default: m.BidBackupTab })));
const FinalizeOverviewTab = dynamic(() => import("@/components/FinalizeOverviewTab").then(m => ({ default: m.FinalizeOverviewTab })));
const SimulateResultsTab = dynamic(() => import("@/components/SimulateResultsTab").then(m => ({ default: m.SimulateResultsTab })));
const TodosTab = dynamic(() => import("@/components/TodosTab").then(m => ({ default: m.TodosTab })));
const CacheToolsTab = dynamic(() => import("@/components/CacheToolsTab").then(m => ({ default: m.CacheToolsTab })));
const JobsDashboard = dynamic(() => import("@/components/admin/JobsDashboard").then(m => ({ default: m.JobsDashboard })));
const NewsAdminTab = dynamic(() => import("@/components/NewsAdminTab").then(m => ({ default: m.NewsAdminTab })));
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

    const groups = [
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
                    id: 'feedback',
                    label: t('admin.tabs.feedback'),
                    content: <FeedbackTab />
                },
                {
                    id: 'chat',
                    label: 'Chat Beheer',
                    content: (
                        <div className="p-4">
                            <p className="text-gray-600 mb-4">Beheer wedstrijd-chatrooms: aanmaken, sluiten, heropenen en modereren.</p>
                            <Link href="/admin/chat" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                                Naar Chat Beheer <ArrowRight size={16} />
                            </Link>
                        </div>
                    )
                },
                {
                    id: 'survey',
                    label: 'Survey',
                    content: (
                        <div className="p-4">
                            <p className="text-gray-600 mb-4">Bekijk de ingevulde feedback surveys van gebruikers.</p>
                            <Link href="/admin/survey" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                                Naar Survey Resultaten <ArrowRight size={16} />
                            </Link>
                        </div>
                    )
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
                },
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
                    id: 'news',
                    label: 'Nieuws',
                    content: <NewsAdminTab />
                },
                {
                    id: 'translations',
                    label: t('admin.tabs.translations'),
                    content: <TranslationsTab isProgrammer={isProgrammer} />
                },
                {
                    id: 'email-templates',
                    label: 'Email Templates',
                    content: <EmailTemplatesTab />
                }
            ]
        },
        {
            id: 'stats-lab',
            label: 'Stats Lab',
            tabs: [
                {
                    id: 'stats-lab-home',
                    label: 'Workspace',
                    content: (
                        <div className="p-4">
                            <p className="text-gray-600 mb-4">
                                Interne AI-assisted stats workspace met read-only tools, idee-generatie en opgeslagen resultaten.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <Link
                                    href="/admin/stats-lab"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    Naar Stats Lab <ArrowRight size={16} />
                                </Link>
                                <Link
                                    href="/admin/stats-ideas"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Bekijk Ideas <ArrowRight size={16} />
                                </Link>
                                <Link
                                    href="/admin/stats-results"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Bekijk Results <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    )
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
                },
                {
                    id: 'jobs',
                    label: 'Jobs',
                    content: <JobsDashboard />
                },
                {
                    id: 'cache-tools',
                    label: 'Cache',
                    content: <CacheToolsTab />
                }
            ]
        }
    ];


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
        <div className="flex flex-col p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
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
                    groups={groups}
                />
            </div>
        </div>
    );
}
