'use client'
import Image from 'next/image';

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [pageContent, setPageContent] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (user) {
                try {
                    const response = await fetch(`/api/getUser?userId=${user.uid}`);
                    if (response.ok) {
                        const userData = await response.json();
                        setIsAdmin(userData.userType === 'admin');
                    }
                } catch (error) {
                    console.error('Error checking admin status:', error);
                }
            }
        };
        checkAdminStatus();
    }, [user]);

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

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen p-8 mt-[36px]">
            <div className="mx-auto container">
                {isAdmin && (<div className="flex flex-row border-b border-gray-200 pb-4 mb-8 items-center">
                    {user && (
                        <div className="flex gap-4">
                            {isAdmin && (
                                <Link href="/admin" className="text-sm text-primary hover:text-primary underline font-medium">
                                    Admin Dashboard
                                </Link>
                            )}
                        </div>
                    )}
                </div>)}

                <h1 className="text-2xl font-bold mb-6">Home</h1>

                <div className="bg-white p-6 border border-gray-200 rounded-md">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    ) : pageContent ? (
                        <>
                            <style jsx global>{`
                                .page-content h1 {
                                    font-size: 2em;
                                    font-weight: 700;
                                    margin-top: 0.67em;
                                    margin-bottom: 0.67em;
                                    line-height: 1.2;
                                }
                                .page-content h2 {
                                    font-size: 1.5em;
                                    font-weight: 600;
                                    margin-top: 0.83em;
                                    margin-bottom: 0.83em;
                                    line-height: 1.3;
                                }
                                .page-content h3 {
                                    font-size: 1.17em;
                                    font-weight: 600;
                                    margin-top: 1em;
                                    margin-bottom: 1em;
                                    line-height: 1.4;
                                }
                                .page-content ul {
                                    list-style-type: disc;
                                    margin-left: 1.5em;
                                    margin-top: 1em;
                                    margin-bottom: 1em;
                                    padding-left: 0.5em;
                                }
                                .page-content ol {
                                    list-style-type: decimal;
                                    margin-left: 1.5em;
                                    margin-top: 1em;
                                    margin-bottom: 1em;
                                    padding-left: 0.5em;
                                }
                                .page-content li {
                                    margin-top: 0.25em;
                                    margin-bottom: 0.25em;
                                }
                                .page-content ul ul,
                                .page-content ol ul {
                                    list-style-type: circle;
                                }
                                .page-content ol ol,
                                .page-content ul ol {
                                    list-style-type: lower-latin;
                                }
                                .page-content p {
                                    margin-top: 1em;
                                    margin-bottom: 1em;
                                }
                                .page-content blockquote {
                                    border-left: 4px solid #e5e7eb;
                                    padding-left: 1em;
                                    margin-left: 0;
                                    margin-top: 1em;
                                    margin-bottom: 1em;
                                    font-style: italic;
                                    color: #6b7280;
                                }
                                .page-content pre {
                                    background-color: #f3f4f6;
                                    border-radius: 0.375rem;
                                    padding: 1em;
                                    margin-top: 1em;
                                    margin-bottom: 1em;
                                    overflow-x: auto;
                                }
                                .page-content code {
                                    background-color: #f3f4f6;
                                    padding: 0.2em 0.4em;
                                    border-radius: 0.25rem;
                                    font-size: 0.875em;
                                }
                                .page-content pre code {
                                    background-color: transparent;
                                    padding: 0;
                                }
                                .page-content hr {
                                    border: none;
                                    border-top: 2px solid #e5e7eb;
                                    margin: 2em 0;
                                }
                                .page-content strong {
                                    font-weight: 700;
                                }
                                .page-content em {
                                    font-style: italic;
                                }
                                .page-content u {
                                    text-decoration: underline;
                                }
                                .page-content s {
                                    text-decoration: line-through;
                                }
                                .page-content a {
                                    color: #3b82f6;
                                    text-decoration: underline;
                                }
                            `}</style>
                            <div
                                className="page-content"
                                dangerouslySetInnerHTML={{ __html: pageContent }}
                            />
                        </>
                    ) : (
                        <>
                            <h2 className="text-xl font-semibold mb-4">
                                Welcome to Oracle Games!
                            </h2>
                            <p className="text-gray-700">
                                Welcome to the Oracle Games homepage. This page is only visible to logged-in users.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
