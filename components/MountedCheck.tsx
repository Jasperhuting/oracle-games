'use client'

import { useEffect, useState } from 'react';

interface MountedCheckProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function MountedCheck({ children, fallback }: MountedCheckProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <>{fallback || (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Loading...</h1>
                </div>
            </div>
        )}</>;
    }

    return <>{children}</>;
}
