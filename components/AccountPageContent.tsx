'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AccountInfoTab } from "./account/AccountInfoTab";
import { SecurityTab } from "./account/SecurityTab";
import { ScriptsTab } from "./account/ScriptsTab";
import { MyGamesStandings } from "./MyGamesStandings";

type TabType = 'account' | 'security' | 'scripts' | 'standings';

export function AccountPageContent() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('account');
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!user) return;
            try {
                const userResponse = await fetch(`/api/getUser?userId=${user.uid}`);
                if (userResponse.ok) {
                    const data = await userResponse.json();
                    setUserData(data);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [user]);

    if (!user) {
        return null;
    }

    const tabs: { id: TabType; label: string }[] = [
        { id: 'account', label: t('account.accountInformation') },
        { id: 'security', label: t('account.security') },
        { id: 'scripts', label: t('account.scripts') },
        { id: 'standings', label: t('account.standings') },
    ];

    return (
        <div className="flex flex-col min-h-screen p-8 mt-[36px] bg-gray-50">
            <div className="mx-auto container">
                <div className="flex flex-row border border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
                    <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        {t('global.backToHome')}
                    </Link>
                </div>

                <h1 className="text-3xl font-bold mb-6">{t('account.myAccount')}</h1>

                {/* Tabs */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="border-b border-gray-200">
                        <div className="flex overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                        activeTab === tab.id
                                            ? 'border-primary text-primary bg-primary/5'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {loading ? (
                            <div className="flex items-center justify-center p-8">
                                <div className="text-gray-600">{t('global.loading')}</div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'account' && (
                                    <AccountInfoTab
                                        userId={user.uid}
                                        email={user.email || ''}
                                        displayName={user.displayName || user.email?.split('@')[0] || 'User'}
                                        userData={userData}
                                        setUserData={setUserData}
                                    />
                                )}
                                {activeTab === 'security' && (
                                    <SecurityTab
                                        userId={user.uid}
                                        email={user.email || ''}
                                        displayName={userData?.playername || user.displayName || user.email?.split('@')[0] || 'User'}
                                    />
                                )}
                                {activeTab === 'scripts' && (
                                    <ScriptsTab userId={user.uid} />
                                )}
                                {activeTab === 'standings' && (
                                    <MyGamesStandings />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
