"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { WK_2026_SEASON, Wk2026Participant, Wk2026SubLeague } from "./types";

export function useWk2026Participant(userId: string | null, season: number = WK_2026_SEASON) {
  const [participant, setParticipant] = useState<Wk2026Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setParticipant(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/wk-2026/join?season=${season}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const data = await response.json();

      if (!response.ok && response.status !== 401) {
        throw new Error(data.error || "Failed to fetch WK participant");
      }

      setParticipant(data.isParticipant ? (data.participant as Wk2026Participant) : null);
    } catch (err) {
      console.error("Error fetching WK participant:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch WK participant"));
      setParticipant(null);
    } finally {
      setLoading(false);
    }
  }, [season, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { participant, isParticipant: !!participant, loading, error, refresh };
}

export function useWk2026SubLeagues(userId: string | null, season: number = WK_2026_SEASON) {
  const [subLeagues, setSubLeagues] = useState<Wk2026SubLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSubLeagues([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/wk-2026/subleagues", {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const data = await response.json();

      if (!response.ok && response.status !== 401) {
        throw new Error(data.error || "Failed to fetch WK subpoules");
      }

      const nextSubLeagues = ((data.data || []) as Wk2026SubLeague[])
        .filter((league) => league.season === season)
        .sort((a, b) => a.name.localeCompare(b.name, "nl-NL"));

      setSubLeagues(nextSubLeagues);
    } catch (err) {
      console.error("Error fetching WK subleagues:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch WK subpoules"));
      setSubLeagues([]);
    } finally {
      setLoading(false);
    }
  }, [season, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { subLeagues, loading, error, refresh };
}
