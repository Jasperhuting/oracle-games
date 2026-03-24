"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { authorizedFetch } from '@/lib/auth/token-service';
import type { AdminProfile } from "@/lib/stats/types";

interface StatsAdminGuardProps {
  children: React.ReactNode;
}

export function StatsAdminGuard({ children }: StatsAdminGuardProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validateAccess() {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const response = await authorizedFetch("/api/admin/stats/access");

        if (!response.ok) {
          if (!cancelled) {
            setAllowed(false);
            router.push("/account");
          }
          return;
        }

        const payload = (await response.json()) as {
          ok: boolean;
          adminProfile?: AdminProfile;
        };

        if (!cancelled) {
          setAllowed(Boolean(payload.ok && payload.adminProfile?.enabled));
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
          router.push("/account");
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    if (!loading) {
      void validateAccess();
    }

    return () => {
      cancelled = true;
    };
  }, [loading, router, user]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="text-sm text-gray-600">Stats Lab access controleren...</div>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
