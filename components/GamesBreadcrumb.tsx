'use client'

import Link from "next/link";
import { ArrowRight } from "tabler-icons-react";
import { useTranslation } from "react-i18next";

export function GamesBreadcrumb() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-row border border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
            <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
                {t('global.backToHome')}
            </Link>
            <ArrowRight className="mx-2" size={16} />
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
                {t('games.games')}
            </Link>
        </div>
    );
}
