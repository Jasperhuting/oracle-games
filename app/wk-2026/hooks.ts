"use client";

import { auth } from "@/lib/firebase/client";
import { WK_2026_SEASON, Wk2026Participant, Wk2026SubLeague } from "./types";
import { useFetchHook } from "@/hooks/useFetchHook";
import type { PullQueryResult } from "@/lib/data-fetching/types";

// ---------------------------------------------------------------------------
// useWk2026Participant
// ---------------------------------------------------------------------------

type ParticipantResult = PullQueryResult<Wk2026Participant | null> & {
  isParticipant: boolean;
};

export function useWk2026Participant(
  userId: string | null,
  season: number = WK_2026_SEASON,
): ParticipantResult {
  const result = useFetchHook<Wk2026Participant | null>(
    async () => {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/wk-2026/join?season=${season}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const data = await response.json();
      if (!response.ok && response.status !== 401) {
        throw new Error(data.error || "Failed to fetch WK participant");
      }
      return data.isParticipant ? (data.participant as Wk2026Participant) : null;
    },
    null,
    [season, userId],
    !!userId,
  );

  return { ...result, isParticipant: !!result.data };
}

// ---------------------------------------------------------------------------
// useWk2026SubLeagues
// ---------------------------------------------------------------------------

type SubLeaguesResult = PullQueryResult<Wk2026SubLeague[]> & {
  /** @deprecated Use `data` instead. Kept for backward compatibility. */
  subLeagues: Wk2026SubLeague[];
};

export function useWk2026SubLeagues(
  userId: string | null,
  season: number = WK_2026_SEASON,
): SubLeaguesResult {
  const result = useFetchHook<Wk2026SubLeague[]>(
    async () => {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/wk-2026/subleagues", {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const data = await response.json();
      if (!response.ok && response.status !== 401) {
        throw new Error(data.error || "Failed to fetch WK subleagues");
      }
      return ((data.data || []) as Wk2026SubLeague[])
        .filter((league) => league.season === season)
        .sort((a, b) => a.name.localeCompare(b.name, "nl-NL"));
    },
    [],
    [season, userId],
    !!userId,
  );

  return { ...result, subLeagues: result.data };
}
