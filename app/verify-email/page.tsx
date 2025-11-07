'use client'

import { Button } from "@/components/Button";
import { auth } from "@/lib/firebase/client";
import { sendEmailVerification } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function VerifyEmailPage() {
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isResending, setIsResending] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');
    const router = useRouter();

    useEffect(() => {
        // Get the last attempted login email from localStorage or auth
        const email = localStorage.getItem('pendingVerificationEmail');
        if (email) {
            setUserEmail(email);
        }
    }, []);

    const handleResendEmail = async () => {
        setIsResending(true);
        setError(null);

        try {
            const user = auth.currentUser;
            if (user) {
                console.log('Attempting to send verification email to:', user.email);
                await sendEmailVerification(user, {
                    url: window.location.origin + '/login',
                    handleCodeInApp: false,
                });
                console.log('Verification email sent successfully');
                setEmailSent(true);
            } else {
                console.error('No current user found');
                setError('Geen gebruiker gevonden. Log opnieuw in.');
            }
        } catch (error: any) {
            console.error('Error sending verification email:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            if (error.code === 'auth/too-many-requests') {
                setError('Te veel verzoeken. Wacht even voordat je het opnieuw probeert.');
            } else {
                setError(`Er is iets misgegaan: ${error.message}`);
            }
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="flex flex-row h-screen">
            <div className="w-full md:w-full xl:w-[600px] md:max-w-[600px] flex flex-col items-center content-center justify-center px-8">
                
                <div className="flex flex-row border-b border-gray-200 pb-4 max-w-[300px] items-center mb-8">
                    <div>
                        <img src="/logo.png" alt="" />
                    </div>
                    <div className="flex-1 whitespace-nowrap text-3xl">
                        Oracle Games
                    </div>
                </div>

                <div className="max-w-[400px] w-full">
                    <div className="bg-red-50 border border-yellow-200 rounded-md p-6 mb-6">
                        <div className="text-4xl mb-4 text-center">📧</div>
                        <h1 className="text-2xl font-bold mb-4 text-center">Verifieer je e-mailadres</h1>
                        <p className="text-gray-700 mb-4 text-center">
                            Je moet je e-mailadres verifiëren voordat je kunt inloggen.
                        </p>
                        {userEmail && (
                            <p className="text-sm text-gray-600 mb-4 text-center">
                                We hebben een verificatie email gestuurd naar <strong>{userEmail}</strong>
                            </p>
                        )}
                        <p className="text-sm text-gray-600 text-center">
                            Controleer je inbox en klik op de verificatielink in de email. 
                            Daarna kun je inloggen.
                        </p>
                    </div>

                    {emailSent && (
                        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                            <p className="text-green-800 text-sm">
                                ✓ Verificatie email opnieuw verstuurd! Controleer je inbox.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <Button 
                            className="w-full justify-center py-2" 
                            text={isResending ? "Bezig met versturen..." : "Verificatie email opnieuw versturen"}
                            onClick={handleResendEmail}
                            disabled={isResending}
                        />
                        
                        <Link href="/login">
                            <Button 
                                className="w-full justify-center py-2 bg-white text-primary hover:bg-primary hover:text-white" 
                                text="Terug naar login"
                            />
                        </Link>
                    </div>

                    <div className="mt-6 text-center text-xs text-gray-600">
                        <p>Geen email ontvangen? Controleer je spam folder.</p>
                    </div>
                </div>
            </div>
            <div className="w-0 md:flex-1 bg-red-500">
                rechterkant
            </div>
        </div>
    );
}
