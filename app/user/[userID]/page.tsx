'use client';

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { CarriereCard } from "@/components/account/CarriereCard";
import { ActiveGamesCard } from "@/components/account/ActiveGamesCard";
import { AvailableGamesCard } from "@/components/account/AvailableGamesCard";
import { GameRulesCard } from "@/components/account/GameRulesCard";
import { CalendarCard } from "@/components/account/CalendarCard";
import { InboxPreview } from "@/components/account/InboxPreview";

interface UserProfileData {
    uid?: string;
    email?: string;
    playername?: string;
    firstName?: string;
    dateOfBirth?: string;
    avatarUrl?: string;
}

export default function UserPage({ params }: { params: Promise<{ userID: string }> }) {
    const { userID } = use(params);
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                setNotFound(false);

                const response = await fetch(`/api/getUser?userId=${userID}`);
                if (response.status === 404) {
                    setNotFound(true);
                    setProfile(null);
                    return;
                }

                if (!response.ok) {
                    setProfile(null);
                    return;
                }

                const data = await response.json();
                setProfile(data);
            } catch (error) {
                console.error('Error fetching user profile:', error);
                setProfile(null);
            } finally {
                setLoading(false);
            }
        };

        if (userID) {
            fetchProfile();
        }
    }, [userID]);

    const isOwnProfile = user?.uid === userID;
    const playername = profile?.playername || profile?.firstName || profile?.email?.split('@')[0] || 'Gebruiker';

    if (authLoading || loading) {
        return (
            <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
                <div className="mx-auto container max-w-7xl">
                    <div className="flex items-center justify-center p-8">
                        <div className="text-gray-600">Laden...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (notFound || !profile) {
        return (
            <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
                <div className="mx-auto container max-w-7xl">
                    <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="text-sm text-gray-600 hover:text-gray-900 underline"
                        >
                            Terug
                        </button>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-700">
                        Gebruiker niet gevonden.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen p-4 md:p-8 mt-[36px] bg-gray-50">
            <div className="mx-auto container max-w-7xl">
                <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-sm text-gray-600 hover:text-gray-900 underline"
                    >
                        Terug
                    </button>
                </div>

                <h1 className="text-3xl font-bold mb-6">
                    {isOwnProfile ? 'Mijn account' : `Profiel van ${playername}`}
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <CarriereCard
                            userId={userID}
                            playername={playername}
                            dateOfBirth={profile?.dateOfBirth}
                            avatarUrl={profile?.avatarUrl}
                            readOnly={!isOwnProfile}
                        />
                        {isOwnProfile && <InboxPreview />}
                    </div>

                    <div className="space-y-6">
                        <ActiveGamesCard userId={userID} />
                        <AvailableGamesCard userId={userID} />
                        <GameRulesCard />
                        <CalendarCard userId={userID} />
                    </div>
                </div>
            </div>
        </div>
    );
}
