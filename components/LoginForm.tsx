'use client'


import Link from "next/link";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { SubmitHandler, useForm } from "react-hook-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { User } from "firebase/auth";
import { LoginFormProps } from "@/lib/types/component-props";

const PasskeyLogin = dynamic(
  () => import("./PasskeyLogin").then(mod => mod.PasskeyLogin),
  { ssr: false }
);

export const LoginForm = () => {
    const { register, handleSubmit } = useForm<LoginFormProps>();
    const [error, setError] = useState<string | null>(null);
    const [showVerifyLink, setShowVerifyLink] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResendingVerification, setIsResendingVerification] = useState(false);
    const [verificationEmailSent, setVerificationEmailSent] = useState(false);
    const [pendingUserCredentials, setPendingUserCredentials] = useState<{ email: string; password: string } | null>(null);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [stayLoggedIn, setStayLoggedIn] = useState(true);
    const router = useRouter();

    const onSubmit: SubmitHandler<LoginFormProps> = async (data) => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        setError(null);
        setShowVerifyLink(false);

        try {
            const { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } = await import ("firebase/auth");
            const { auth } = await import ("@/lib/firebase/client");

            // Set persistence based on "Stay logged in" checkbox
            const persistenceMode = stayLoggedIn ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistenceMode);
            console.log('Firebase persistence set to:', stayLoggedIn ? 'LOCAL (stays logged in)' : 'SESSION (logs out when browser closes)');

            // Sign in with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
            const user = userCredential.user;
            
            // Check if email is verified
            if (!user.emailVerified) {
                console.log('Email not verified');
                // Store email for verify page
                localStorage.setItem('pendingVerificationEmail', data.email);
                // Store credentials for resend functionality
                setPendingUserCredentials({ email: data.email, password: data.password });
                // Sign out the user
                await auth.signOut();
                // Show error message with resend button
                setError('Je email is nog niet geverifieerd. Controleer je inbox (en spam folder) voor de verificatie link.');
                setShowVerifyLink(true);
                setIsSubmitting(false);
                return;
            }
            
            console.log('User logged in successfully');
            
            // Update last login method
            await fetch('/api/updateLoginMethod', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.uid,
                    loginMethod: 'email',
                }),
            });
            
            // Redirect to home page
            router.push('/home');
        } catch (error: unknown) {
            console.error('Login error:', error);

            // User-friendly error messages in English
            let errorMessage = 'Something went wrong logging in';
            if (error && typeof error === 'object' && 'code' in error) {
                const firebaseError = error as { code: string };
                if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/wrong-password') {
                    errorMessage = 'Invalid email or password';
                } else if (firebaseError.code === 'auth/user-not-found') {
                    errorMessage = 'No account found with this email address';
                } else if (firebaseError.code === 'auth/too-many-requests') {
                    errorMessage = 'Too many failed attempts. Try again later';
                } else if (firebaseError.code === 'auth/invalid-email') {
                    errorMessage = 'Invalid email address';
                } else if (firebaseError.code === 'auth/user-disabled') {
                    errorMessage = 'This account is disabled. Contact the administrator.';
                } else if (firebaseError.code === 'auth/network-request-failed') {
                    errorMessage = 'Network error. Please check your connection and try disabling browser extensions (ad blockers).';
                }
            } else if (error instanceof Error && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
                errorMessage = 'Connection blocked by browser extension. Please disable your ad blocker or try in incognito mode.';
            }

            setError(errorMessage);
            setIsSubmitting(false);
        }
    }

    const handleGoogleLogin = async () => {
        setIsGoogleLoading(true);
        setError(null);
        setShowVerifyLink(false);

        try {
            const { GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence, browserSessionPersistence } = await import("firebase/auth");
            const { auth } = await import("@/lib/firebase/client");

            // Set persistence based on "Stay logged in" checkbox
            const persistenceMode = stayLoggedIn ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistenceMode);
            console.log('Firebase persistence set to:', stayLoggedIn ? 'LOCAL (stays logged in)' : 'SESSION (logs out when browser closes)');

            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if email is verified (Google accounts are pre-verified)
            console.log('Google login successful:', user.email);
            
            // Check if user exists in Firestore, if not create
            await ensureUserExists(user);
            
            // Update last login method
            await fetch('/api/updateLoginMethod', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.uid,
                    loginMethod: 'google',
                }),
            });
            
            router.push('/home');
        } catch (error: unknown) {
            console.error('Google login error:', error);
            if (error && typeof error === 'object' && 'code' in error) {
                const firebaseError = error as { code: string };
                if (firebaseError.code === 'auth/popup-closed-by-user') {
                    setError('Login cancelled');
                } else if (firebaseError.code === 'auth/popup-blocked') {
                    setError('Pop-up blocked. Enable pop-ups for this site.');
                } else if (firebaseError.code === 'auth/network-request-failed') {
                    setError('Network error. Please check your connection and try disabling browser extensions (ad blockers).');
                } else {
                    setError('Something went wrong logging in with Google');
                }
            } else if (error instanceof Error && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
                setError('Connection blocked by browser extension. Please disable your ad blocker or try in incognito mode.');
            } else {
                setError('Something went wrong logging in with Google');
            }
            setIsGoogleLoading(false);
        }
    };

    const handleResendVerificationEmail = async () => {
        if (!pendingUserCredentials) return;

        setIsResendingVerification(true);
        setVerificationEmailSent(false);

        try {
            const { signInWithEmailAndPassword, sendEmailVerification } = await import("firebase/auth");
            const { auth } = await import("@/lib/firebase/client");

            // Temporarily sign in to send verification email
            const userCredential = await signInWithEmailAndPassword(
                auth,
                pendingUserCredentials.email,
                pendingUserCredentials.password
            );

            const actionCodeSettings = {
                url: `${window.location.origin}/login`,
                handleCodeInApp: false,
            };

            await sendEmailVerification(userCredential.user, actionCodeSettings);

            // Sign out again
            await auth.signOut();

            setVerificationEmailSent(true);
            setError(null);
        } catch (error: unknown) {
            console.error('Error resending verification email:', error);
            if (error && typeof error === 'object' && 'code' in error) {
                const firebaseError = error as { code: string };
                if (firebaseError.code === 'auth/too-many-requests') {
                    setError('Te veel verzoeken. Wacht even voordat je het opnieuw probeert.');
                } else {
                    setError('Er ging iets mis bij het versturen van de email. Probeer het later opnieuw.');
                }
            } else {
                setError('Er ging iets mis bij het versturen van de email.');
            }
        } finally {
            setIsResendingVerification(false);
        }
    };

    const ensureUserExists = async (user: User) => {
        try {
            const response = await fetch('/api/createUser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    playername: user.displayName || user.email?.split('@')[0] || 'Player',
                    userType: 'user',
                    authMethod: 'google',
                }),
            });

            if (!response.ok && response.status !== 409) { // 409 = user already exists
                console.error('Failed to create user document');
            }
        } catch (error) {
            console.error('Error ensuring user exists:', error);
        }
    };

    return (
        <div className="flex flex-col" data-testid="login-form">
            <form onSubmit={handleSubmit(onSubmit)} data-testid="login-form-element">
                <div className="flex flex-col">
                    <TextInput
                        label="Email"
                        placeholder="Email"
                        data-testid="login-email-input"
                        {...register('email', { required: true })}
                    />
                </div>
                <div className="flex flex-col">
                    <TextInput
                        type="password"
                        label="Password"
                        placeholder="Password"
                        data-testid="login-password-input"
                        {...register('password', { required: true })}
                    />
                </div>
                {verificationEmailSent && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 my-2" data-testid="verification-success-message">
                        <p className="text-green-800 text-xs">
                            ✓ Verificatie email verstuurd! Controleer je inbox.
                        </p>
                    </div>
                )}
                {error && (
                    <div className="text-red-500 text-xs my-2" data-testid="login-error-message">
                        <span>{error}</span>
                        {showVerifyLink && pendingUserCredentials && (
                            <button
                                type="button"
                                onClick={handleResendVerificationEmail}
                                disabled={isResendingVerification}
                                className="block mt-2 underline text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isResendingVerification ? 'Bezig met versturen...' : 'Verificatie email opnieuw versturen'}
                            </button>
                        )}
                    </div>
                )}
                <div className="flex justify-between items-center my-2">
                    <label className="flex items-center text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={stayLoggedIn}
                            onChange={(e) => setStayLoggedIn(e.target.checked)}
                            className="mr-2 cursor-pointer"
                            data-testid="stay-logged-in-checkbox"
                        />
                        Stay logged in
                    </label>
                    <div className="text-xs">
                        <Link href="/reset-password" className="underline">Forgot password?</Link>
                    </div>
                </div>
                <Button
                    className="w-full justify-center py-1 my-4"
                    text={isSubmitting ? "Loading..." : "Log in"}
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="login-submit-button"
                />
            </form>

            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-50 text-gray-500">Or log in with</span>
                </div>
            </div>

            <div className="space-y-3">
                <PasskeyLogin />

                <Button
                    className="w-full justify-center py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                    text={isGoogleLoading ? "Loading..." : "Log in with Google"}
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading || isSubmitting}
                    data-testid="google-login-button"
                    startIcon={
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                    }
                />
            </div>

            <div className="mt-4 text-center">
                <span className="text-xs">Don&apos;t have an account? Go to the <Link className="underline" href="/register">registration page</Link></span>
            </div>
        </div>
    );
}
