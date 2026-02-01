'use client'

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function HistoryPage() {
    const { user } = useAuth();
    const { t } = useTranslation();

    if (!user) {
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

    return (
        <div className="flex flex-col min-h-screen p-4 md:p-8 mt-[36px] bg-gray-50">
            <div className="mx-auto container max-w-4xl">
                {/* Header */}
                <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
                    <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        ← Terug naar account
                    </Link>
                </div>

                {/* Coming Soon Content */}
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                    <div className="max-w-md mx-auto">
                        <div className="text-6xl mb-6">📜</div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Geschiedenis</h1>
                        <p className="text-lg text-gray-600 mb-6">
                            Deze pagina is momenteel in ontwikkeling
                        </p>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                            <p className="text-purple-800">
                                Binnenkun kun je hier je volledige geschiedenis bekijken van alle deelnames aan Oracle Games spellen.
                            </p>
                        </div>
                        <Link 
                            href="/account" 
                            className="inline-block mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            Terug naar account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
