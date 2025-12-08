'use client'

import { useState } from "react";
import { Button } from "./Button";
import { authenticateWithPasskey, isPasskeySupported } from "@/lib/passkey";
import { useRouter } from "next/navigation";

export const PasskeyLogin = () => {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handlePasskeyLogin = async () => {
        if (!isPasskeySupported()) {
            setError('Your browser does not support passkeys. Use a modern browser like Chrome, Safari or Edge.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Authenticate with passkey (credential identifies the user)
            const passkeyData = await authenticateWithPasskey();
            const { signInWithCustomToken } = await import("firebase/auth");
            const { auth } = await import("@/lib/firebase/client");

            // Send to backend for verification
            const response = await fetch('/api/verifyPasskey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(passkeyData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Passkey verification failed');
            }

            const { token, userId } = await response.json();

            // Sign in with custom token
            await signInWithCustomToken(auth, token);

            // Update last login method
            await fetch('/api/updateLoginMethod', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId,
                    loginMethod: 'passkey',
                }),
            });

            console.log('Passkey login successful');
            router.push('/home');
        } catch (error: unknown) {
            console.error('Passkey login error:', error);
            setError(error instanceof Error ? error.message : 'Something went wrong logging in with passkey');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isPasskeySupported()) {
        return null; // Don't show button if not supported
    }

    return (
        <div>
            <Button
                className="w-full justify-center py-2 text-white "
                text={isLoading ? "Logging in..." : "Log in with Passkey 🔑"}
                onClick={handlePasskeyLogin}
                disabled={isLoading}
            />
            {error && <span className="text-red-500 text-xs mt-2 block">{error}</span>}
        </div>
    );
}
