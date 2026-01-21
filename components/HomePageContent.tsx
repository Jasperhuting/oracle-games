'use client'

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SiteStats } from "./SiteStats";

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
        <div className="flex flex-col min-h-screen">

            <div style={{background: `url('/homepage_picture_6.jpg') center/cover no-repeat`}} className="h-screen aspect-video z-0 relative mb-5">
                <div className="absolute -z-10 inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black"></div>
                <div className="mx-auto container z-20 ralative text-white">

                    <h1 className="text-4xl mb-6 text-center p-20 font-lato font-black">ORACLE GAMES</h1>
   
                <div className="p-6 backdrop-blur-xs w-fit mx-auto rounded-full">
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
            <SiteStats />
            </div>

            
        </div>
    );
}
