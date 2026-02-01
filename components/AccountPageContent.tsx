'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { CarriereCard } from "./account/CarriereCard";
import { InboxPreview } from "./account/InboxPreview";
import { ActiveGamesCard } from "./account/ActiveGamesCard";
import { AvailableGamesCard } from "./account/AvailableGamesCard";
import { GameRulesCard } from "./account/GameRulesCard";
import { CalendarCard } from "./account/CalendarCard";

export function AccountPageContent() {
    const { user } = useAuth();
    const { t } = useTranslation();
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

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen p-8 mt-[36px] bg-gray-50">
                <div className="mx-auto container">
                    <div className="flex items-center justify-center p-8">
                        <div className="text-gray-600">{t('global.loading')}</div>
                    </div>
                </div>
            </div>
        );
    }

    const playername = userData?.playername || user.displayName || user.email?.split('@')[0] || 'User';
    const dateOfBirth = userData?.dateOfBirth;
    const avatarUrl = userData?.avatarUrl;

    return (
        <div className="flex flex-col min-h-screen p-4 md:p-8 mt-[36px] bg-gray-50">
            <div className="mx-auto container max-w-7xl">
                {/* Header */}
                <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
                    <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        {t('global.backToHome')}
                    </Link>
                </div>

                <h1 className="text-3xl font-bold mb-6">{t('account.myAccount')}</h1>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Carriere */}
                        <CarriereCard
                            userId={user.uid}
                            playername={playername}
                            dateOfBirth={dateOfBirth}
                            avatarUrl={avatarUrl}
                            onAvatarUpdate={(newUrl) => setUserData({ ...userData, avatarUrl: newUrl })}
                        />

                        {/* Inbox */}
                        <InboxPreview />
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Actieve spellen */}
                        <ActiveGamesCard userId={user.uid} />

                        {/* Beschikbare spellen */}
                        <AvailableGamesCard userId={user.uid} />

                        {/* Spelregels */}
                        <GameRulesCard />

                        {/* Kalender */}
                        <CalendarCard userId={user.uid} />
                    </div>
                </div>
            </div>
        </div>
    );
}
