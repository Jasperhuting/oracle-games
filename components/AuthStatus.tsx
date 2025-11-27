'use client'

import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "./Button";
import { useRouter } from "next/navigation";

export const AuthStatus = () => {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    if (loading) {
        return <div className="p-4 border rounded-md">Laden...</div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="p-4 border rounded-md bg-red-50">
                <p className="font-bold mb-2">Niet ingelogd</p>
                <p className="text-sm mb-4">Je bent momenteel niet ingelogd.</p>
                <Button 
                    text="Naar login" 
                    onClick={() => router.push('/login')}
                />
            </div>
        );
    }

    return (
        <div className="p-4 border rounded-md bg-green-50">
            <p className="font-bold mb-2">✓ Logged in</p>
            <div className="text-sm space-y-1 mb-4">
                <p><strong>Email:</strong> {user?.email}</p>
                <p><strong>User ID:</strong> {user?.uid}</p>
                <p><strong>Email Verified:</strong> {user?.emailVerified ? 'Yes' : 'No'}</p>
            </div>
            <Button 
                text="Log out" 
                onClick={handleLogout}
            />
        </div>
    );
}
