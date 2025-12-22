'use client'

import { useTranslation } from "react-i18next";

export default function MaintenancePageClient() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-3xl font-bold mb-4">{t('maintenance.title')}</h1>
            <p className="text-lg">{t('maintenance.description')}</p>
        </div>
    );
}
