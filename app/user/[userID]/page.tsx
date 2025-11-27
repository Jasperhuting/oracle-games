'use client';

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, use } from "react";


export default function UserPage({ params }: { params: Promise<{ userID: string }> }) {

        const { userID } = use(params);
        const { user, loading } = useAuth();
        
        const [_isAdmin, setIsAdmin] = useState(false);
        const [_checking, setChecking] = useState(true);

        console.log(user);
    
        useEffect(() => {
            const checkAdminStatus = async () => {
                
    
                if (user) {
                    // Check if user is admin
                    try {
                        const response = await fetch(`/api/getUser?userId=${user.uid}`);
                        if (response.ok) {
                            const userData = await response.json();
                            if (userData.userType === 'admin') {
                                setIsAdmin(true);
                            } 
                        }
                    } catch (error) {
                        console.error('Error checking admin status:', error);
                        
                    } finally {
                        setChecking(false);
                    }
                }
            };
    
            checkAdminStatus();
        }, [user, loading]);



    return (
        <div>
            <h1>User Page {userID}</h1>
        </div>
    );
}