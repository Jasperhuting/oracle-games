'use client'

import { AccountSettings } from "@/components/AccountSettings";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export function AccountPageContent() {
    const { user } = useAuth();
    const { t } = useTranslation();

    if (!user) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen p-8 mt-[36px] bg-gray-50">
            <div className="mx-auto container">
                <div className="flex flex-row border border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
                    <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        {t('global.backToHome')}
                    </Link>
                </div>

                <h1 className="text-3xl font-bold mb-6">{t('account.myAccount')}</h1>

                <AccountSettings
                    userId={user.uid}
                    email={user.email || ''}
                    displayName={user.displayName || user.email?.split('@')[0] || 'User'}
                />
            </div>
        </div>
    );
}
