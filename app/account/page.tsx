'use client'

import { AccountSettings } from "@/components/AccountSettings";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function AccountPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600">Laden...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen p-8 bg-gray-50">
            <div className="max-w-4xl mx-auto w-full">
                <div className="flex flex-row border-b border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
                    <Link href="/home">
                        <img src="/logo.png" alt="" className="w-12 h-12 cursor-pointer hover:opacity-80 transition-opacity" />
                    </Link>
                    <div className="flex-1 whitespace-nowrap text-3xl ml-4">
                        Oracle Games
                    </div>
                    <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
                        Terug naar home
                    </Link>
                </div>

                <h1 className="text-3xl font-bold mb-6">Mijn Account</h1>

                <AccountSettings 
                    userId={user.uid} 
                    email={user.email || ''} 
                    displayName={user.displayName || user.email?.split('@')[0] || 'Gebruiker'} 
                />
            </div>
        </div>
    );
}
