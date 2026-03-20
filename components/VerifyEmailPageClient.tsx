'use client'
import Image from 'next/image';

import { Button } from "@/components/Button";
import { auth } from "@/lib/firebase/client";
import { sendEmailVerification } from "firebase/auth";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function VerifyEmailPageClient({ heroImageSrc = "/homepage_picture_3.jpg" }: { heroImageSrc?: string }) {
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isResending, setIsResending] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');

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
                const actionCodeSettings = {
                    url: `${window.location.origin}/login`,
                    handleCodeInApp: false,
                };

                console.log('Attempting to send verification email to:', user.email);
                console.log('Action code settings:', actionCodeSettings);
                await sendEmailVerification(user, actionCodeSettings);
                console.log('Verification email sent successfully');
                setEmailSent(true);
            } else {
                console.error('No current user found');
                setError('No user found. Please log in again.');
            }
        } catch (error: unknown) {
            console.error('Error sending verification email:', error);

            // Type guard for Firebase Auth errors
            const isFirebaseError = (err: unknown): err is { code: string; message: string } => {
                return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
            };

            if (isFirebaseError(error)) {
                if (error.code === 'auth/too-many-requests') {
                    setError('Too many requests. Please wait a moment before trying again.');
                } else {
                    setError(`Something went wrong: ${error.message}`);
                }
            } else {
                setError('An unexpected error occurred. Please try again.');
            }
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden">
            <Image src={heroImageSrc} fill className="object-cover object-center" alt="" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.42),rgba(3,7,18,0.58))]" />
            <div className="relative z-10 flex min-h-screen items-center justify-center overflow-y-auto px-6 py-10">
                <div className="w-full max-w-[420px] rounded-[28px] border border-white/65 bg-white/88 px-8 py-10 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur">
                    <div className="mb-8 flex flex-row items-center border-b border-slate-200 pb-4">
                        <div>
                            <Image src="/logo.png" alt="" width={50} height={50} />
                        </div>
                        <div className="flex-1 whitespace-nowrap text-3xl font-medium text-slate-900">
                            Oracle Games
                        </div>
                    </div>
                
                    <div className="w-full">
                        <div className="bg-red-50 border border-yellow-200 rounded-md p-6 mb-6">
                            <div className="text-4xl mb-4 text-center">📧</div>
                            <h1 className="text-2xl font-bold mb-4 text-center text-slate-900">Verify your email address</h1>
                            <p className="text-slate-700 mb-4 text-center">
                                You must verify your email address before you can log in.
                            </p>
                            {userEmail && (
                                <p className="text-sm text-slate-600 mb-4 text-center">
                                    We have sent a verification email to <strong>{userEmail}</strong>
                                </p>
                            )}
                            <p className="text-sm text-slate-600 text-center">
                                Check your inbox and click on the verification link in the email.
                                Then you can log in.
                            </p>
                        </div>

                        {emailSent && (
                            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                                <p className="text-green-800 text-sm">
                                    ✓ Verification email re-sent! Check your inbox.
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
                                text={isResending ? "Busy sending..." : "Resend verification email"}
                                onClick={handleResendEmail}
                                disabled={isResending}
                            />

                            <Link href="/login">
                                <Button
                                    className="w-full justify-center py-2 bg-white text-primary hover:bg-primary hover:text-white"
                                    text="Back to login"
                                />
                            </Link>
                        </div>

                        <div className="mt-6 text-center text-xs text-slate-600">
                            <p>No email received? Check your spam folder.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
