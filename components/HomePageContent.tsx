'use client'

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Flag } from "./Flag";

export function HomePageContent() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [pageContent, setPageContent] = useState<string>('');
    const [loading, setLoading] = useState(true);



    useEffect(() => {
        const loadPageContent = async () => {
            try {
                const response = await fetch('/api/pages/home');
                if (response.ok) {
                    const data = await response.json();
                    setPageContent(data.content || '');
                }
            } catch (error) {
                console.error('Error loading page content:', error);
            } finally {
                setLoading(false);
            }
        };
        loadPageContent();
    }, []);

    return (
        <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px]">
            <div className="mx-auto container">
   
                <h1 className="text-2xl font-bold mb-6">Home</h1>

                <div className="bg-white p-3 sm:p-6 border border-gray-200 rounded-md">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-gray-500">{t('global.loading')}</div>
                        </div>
                    ) : pageContent ? (
                        <div
                            className="page-content"
                            dangerouslySetInnerHTML={{ __html: pageContent }}
                        />
                    ) : (
                        <>
                            <h2 className="text-xl font-semibold mb-4">
                                {t('home.backupTitle')}
                            </h2>
                            <p className="text-gray-700">
                                {t('home.backupDescription')}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}