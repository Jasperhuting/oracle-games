'use client'
import Image from 'next/image';

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function HomePage() {
    const { user } = useAuth();
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
        <div className="flex flex-col min-h-screen p-8 mt-[36px]">
            <div className="mx-auto container">
                {isAdmin && (<div className="flex flex-row border-b border-gray-200 pb-4 mb-8 items-center">
                    {user && (
                        <div className="flex gap-4">
                            {isAdmin && (
                                <Link href="/admin" className="text-sm text-primary hover:text-primary underline font-medium">
                                    Admin Dashboard
                                </Link>
                            )}
                        </div>
                    )}
                </div>)}
                

                <h1 className="text-2xl font-bold mb-6">Home</h1>
              
                <div className="bg-white p-6 border border-gray-200 rounded-md">
                    <h2 className="text-xl font-semibold mb-4">                        
                        Welcome to Oracle Games!
                    </h2>
                    <p className="text-gray-700">

                        
                        Welcome to the Oracle Games homepage. This page is only visible to logged-in users.                    
                    </p>
                </div>
            </div>
        </div>
    );
}
