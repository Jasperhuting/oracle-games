'use client'

import { AuthStatus } from "@/components/AuthStatus";
import { PasskeySetup } from "@/components/PasskeySetup";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function HomePage() {
    const { user, loading } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);

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
    return (
        <div className="flex flex-col min-h-screen p-8">
            <div className="max-w-4xl mx-auto w-full">
                <div className="flex flex-row border-b border-gray-200 pb-4 mb-8 items-center">
                    <div>
                        <img src="/logo.png" alt="" className="w-12 h-12" />
                    </div>
                    <div className="flex-1 whitespace-nowrap text-3xl ml-4">
                        Oracle Games
                    </div>
                    {user && (
                        <div className="flex gap-4">
                            {isAdmin && (
                                <Link href="/admin" className="text-sm text-purple-600 hover:text-purple-900 underline font-medium">
                                    Admin Dashboard
                                </Link>
                            )}
                            <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900 underline">
                                Mijn Account
                            </Link>
                        </div>
                    )}
                </div>

                <h1 className="text-2xl font-bold mb-6">Home</h1>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
                    <AuthStatus />
                </div>

                <div className="bg-gray-50 p-6 rounded-md">
                    <h2 className="text-xl font-semibold mb-4">Welkom bij Oracle Games!</h2>
                    <p className="text-gray-700">
                        Dit is de home pagina. Hier kun je zien of je ingelogd bent en je account informatie bekijken.
                    </p>
                </div>
            </div>
        </div>
    );
}
