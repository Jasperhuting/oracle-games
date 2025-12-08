'use client'

import Link from "next/link";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { SubmitHandler, useForm } from "react-hook-form";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { FirebaseError } from "firebase/app";

interface ResetPasswordFormProps {
    email: string;
}

export const ResetPasswordForm = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormProps>();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const onSubmit: SubmitHandler<ResetPasswordFormProps> = async (data) => {
        if (isSubmitting) return;
        
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);

        try {
            await sendPasswordResetEmail(auth, data.email, {
                url: window.location.origin + '/login',
                handleCodeInApp: false,
            });
            
            setSuccess(true);
            console.log('Password reset email sent to:', data.email);
        } catch (error: unknown) {
            let errorMessage = 'Something went wrong sending the reset email';
            if (error instanceof FirebaseError) {
                console.error('Password reset error:', error.code, error.message);
            
            
            // User-friendly error messages in English
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Try again later';
            }
        }
            
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (success) {
        return (
            <div className="flex flex-col max-w-[300px]">
                <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-green-800">
                                Email sent!
                            </h3>
                            <div className="mt-2 text-sm text-green-700">
                                <p>
                                    We have sent an email with instructions to reset your password. 
                                    Check your inbox and spam folder.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <Link href="/login">
                    <Button 
                        className="w-full justify-center py-2" 
                        text="Back to login" 
                    />
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col max-w-[300px]">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="flex flex-col mb-4">
                    <TextInput 
                        label="Email" 
                        placeholder="Email" 
                        {...register('email', { 
                            required: 'Email is Mandatory',
                            pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: 'Invalid email address'
                            }
                        })} 
                    />
                    {errors.email && (
                        <span className="text-red-500 text-xs mt-1">{errors.email.message}</span>
                    )}
                </div>
                
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                        <span className="text-red-700 text-sm">{error}</span>
                    </div>
                )}
                
                <Button 
                    className="w-full justify-center py-2 mb-4" 
                    text={isSubmitting ? "Sending..." : "Send reset link"} 
                    type="submit" 
                    disabled={isSubmitting} 
                />
            </form>

            <div className="text-center">
                <Link href="/login" className="text-xs underline text-gray-600 hover:text-gray-900">
                    Back to login
                </Link>
            </div>
        </div>
    );
}
