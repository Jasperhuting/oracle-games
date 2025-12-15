'use client'

import { JoinableGamesTab } from "@/components/JoinableGamesTab";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "tabler-icons-react";
import { useTranslation } from "react-i18next";



export default function GamesPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600">{t('global.loading')}</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen p-8 bg-gray-50">
            <div className="mx-auto container">
                <div className="flex flex-row border border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
                    <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        {t('global.backToHome')}
                    </Link>
                    <ArrowRight className="mx-2" size={16} />
                    <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        {t('games.games')}
                    </Link>
                </div>

                <JoinableGamesTab />
            </div>
        </div>
    );
}
