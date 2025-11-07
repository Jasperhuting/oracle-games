'use client'

import Link from "next/link";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { SubmitHandler, useForm } from "react-hook-form";
import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { PasskeyLogin } from "./PasskeyLogin";

interface LoginFormProps {
    email: string;
    password: string;
}

export const LoginForm = () => {
    const { register, handleSubmit } = useForm<LoginFormProps>();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const router = useRouter();

    const onSubmit: SubmitHandler<LoginFormProps> = async (data) => {
        if (isSubmitting) return;
        
        setIsSubmitting(true);
        setError(null);

        try {
            // Sign in with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
            const user = userCredential.user;
            
            // Check if email is verified
            if (!user.emailVerified) {
                console.log('Email not verified');
                // Store email for verify page
                localStorage.setItem('pendingVerificationEmail', data.email);
                // Sign out the user
                await auth.signOut();
                // Redirect to verify email page
                router.push('/verify-email');
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
        } catch (error: any) {
            console.error('Login error:', error.code, error.message);
            
            // User-friendly error messages in Dutch
            let errorMessage = 'Er is iets misgegaan bij het inloggen';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                errorMessage = 'Onjuist e-mailadres of wachtwoord';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'Geen account gevonden met dit e-mailadres';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Te veel mislukte pogingen. Probeer het later opnieuw';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Ongeldig e-mailadres';
            } else if (error.code === 'auth/user-disabled') {
                errorMessage = 'Dit account is geblokkeerd. Neem contact op met de beheerder.';
            }
            
            setError(errorMessage);
            setIsSubmitting(false);
        }
    }

    const handleGoogleLogin = async () => {
        setIsGoogleLoading(true);
        setError(null);

        try {
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
        } catch (error: any) {
            console.error('Google login error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                setError('Login geannuleerd');
            } else if (error.code === 'auth/popup-blocked') {
                setError('Pop-up geblokkeerd. Sta pop-ups toe voor deze site.');
            } else {
                setError('Er is iets misgegaan bij het inloggen met Google');
            }
            setIsGoogleLoading(false);
        }
    };

    const ensureUserExists = async (user: any) => {
        try {
            const response = await fetch('/api/createUser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    playername: user.displayName || user.email?.split('@')[0] || 'Speler',
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
        <div className="flex flex-col">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="flex flex-col">
                    <TextInput 
                        label="E-mailadres" 
                        placeholder="E-mailadres" 
                        {...register('email', { required: true })} 
                    />
                </div>
                <div className="flex flex-col">
                    <TextInput 
                        type="password" 
                        label="Wachtwoord" 
                        placeholder="Wachtwoord" 
                        {...register('password', { required: true })} 
                    />
                </div>
                {error && <span className="text-red-500 text-xs my-2">{error}</span>}
                <div className="text-xs self-end my-2">
                    <Link href="/reset-password" className="underline">Wachtwoord vergeten?</Link>
                </div>
                <Button 
                    className="w-full justify-center py-1 my-4" 
                    text={isSubmitting ? "Bezig met inloggen..." : "Inloggen"} 
                    type="submit" 
                    disabled={isSubmitting} 
                />
            </form>

            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Of log in met</span>
                </div>
            </div>

            <div className="space-y-3">
                <PasskeyLogin />
                
                <Button
                    className="w-full justify-center py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                    text={isGoogleLoading ? "Bezig..." : "Inloggen met Google"}
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading || isSubmitting}
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
                <span className="text-xs">Nog geen account? Ga naar de <Link className="underline" href="/register">registratiepagina</Link></span>
            </div>
        </div>
    );
}
