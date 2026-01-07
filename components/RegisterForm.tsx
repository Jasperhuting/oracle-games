'use client'

import Link from "next/link";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { SubmitHandler, useForm } from "react-hook-form";
import { useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup, GoogleAuthProvider, User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { RegisterFormProps } from "@/lib/types/component-props";

export const RegisterForm = () => {


    const { register, handleSubmit } = useForm<RegisterFormProps>();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const router = useRouter();

    const onSubmit: SubmitHandler<RegisterFormProps> = async (data) => {
        if (isSubmitting) return;
        
        setIsSubmitting(true);
        setError(null);

        try {
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const user = userCredential.user;

            // Create user document in Firestore via API (server-side)
            const payload = {
                uid: user.uid,
                email: data.email,
                playername: data.playername,
                userType: 'user',
                authMethod: 'email',
            };
            
            const response = await fetch('/api/createUser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                // If playername is taken, delete the Firebase Auth user and show error
                if (response.status === 409 && errorData.error.includes('spelersnaam')) {
                    await user.delete();
                    throw new Error(errorData.error);
                }
                throw new Error(errorData.error || 'Failed to create user document');
            }

            console.log('User created successfully:', user.uid);
            
            // Send email verification
            try {
                const actionCodeSettings = {
                    url: `${window.location.origin}/login`,
                    handleCodeInApp: false,
                };

                console.log('Sending verification email with settings:', actionCodeSettings);
                await sendEmailVerification(user, actionCodeSettings);
                console.log('Verification email sent successfully to:', data.email);
            } catch (emailError: unknown) { 
                if (emailError instanceof FirebaseError) {
                    console.error('Error sending verification email:', emailError);
                    console.error('Error code:', emailError.code);
                    console.error('Error message:', emailError.message);
                    console.error('Full error:', emailError);
                }
                // Continue anyway - user can resend from verify page
            }
            
            // Store email for verify page
            localStorage.setItem('pendingVerificationEmail', data.email);
            
            // Sign out user and redirect to verify email page
            await auth.signOut();
            router.push('/verify-email');
        } catch (error: unknown) {
            console.error('Registration error:', error);
            setError(error instanceof Error ? error.message : 'Something went wrong registering');
            setIsSubmitting(false);
        }
    }

    const handleGoogleSignup = async () => {
        setIsGoogleLoading(true);
        setError(null);

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            console.log('Google signup successful:', user.email);
            
            // Create user in Firestore
            await ensureUserExists(user);
            
            // Google accounts are pre-verified, go directly to home
            router.push('/home');
        } catch (error: unknown) {
            console.error('Google signup error:', error);
            if (error && typeof error === 'object' && 'code' in error) {
                const firebaseError = error as { code: string };
                if (firebaseError.code === 'auth/popup-closed-by-user') {
                    setError('Registration cancelled');
                } else if (firebaseError.code === 'auth/popup-blocked') {
                    setError('Pop-up blocked. Enable pop-ups for this site.');
                } else if (firebaseError.code === 'auth/account-exists-with-different-credential') {
                    setError('There is already an account with this email address');
                } else {
                    setError('Something went wrong registering with Google');
                }
            } else {
                setError('Something went wrong registering with Google');
            }
            setIsGoogleLoading(false);
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
                    playername: user.displayName || user.email?.split('@')[0] || 'Speler',
                    userType: 'user',
                    authMethod: 'google',
                }),
            });

            if (!response.ok && response.status !== 409) {
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
                <TextInput label="Email" placeholder="Email" {...register('email')} />
            </div>
            <div className="flex flex-col">
                <TextInput type="password" label="Password" placeholder="Password" {...register('password')} />
            </div>
            <div className="flex flex-col">
                <TextInput type="password" label="Confirm Password" placeholder="Confirm Password" {...register('password_confirmation')} />
            </div>
             <div className="flex flex-col">
                <TextInput label="Player Name" placeholder="Player Name" {...register('playername')} />
                {error && <span className="text-red-500 max-w-[200px] text-xs my-2">{error}</span>}
            </div>
            <Button className="w-full justify-center py-1 my-4" text={isSubmitting ? "Registering..." : "Register"} type="submit" disabled={isSubmitting} />
            </form>

            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-50 text-gray-500">Or register with</span>
                </div>
            </div>

            <div className="space-y-3">
                <Button
                    className="w-full cursor-pointer justify-center py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                    text={isGoogleLoading ? "Loading..." : "Register with Google"}
                    onClick={handleGoogleSignup}
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
                <span className="text-xs">Already have an account? Go to the <Link className="underline" href="/login">login page</Link></span>
            </div>
        </div>
    );
}