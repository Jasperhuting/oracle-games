import { unstable_cache } from 'next/cache';
import { getServerFirebase } from '@/lib/firebase/server';
import type { Firestore } from 'firebase-admin/firestore';

export interface RiderReferenceData {
  points: number;
  country?: string;
  rank?: number;
  teamName?: string;
  jerseyImageTeam?: string;
}

export interface RiderReferenceCacheData {
  ridersById: Map<string, RiderReferenceData>;
  teamsByPath: Map<string, { name: string; jerseyImageTeam?: string; teamImage?: string }>;
}

// Plain-object version for JSON-safe caching
type SerializableRiderReferenceCacheData = {
  ridersById: Record<string, RiderReferenceData>;
  teamsByPath: Record<string, { name: string; jerseyImageTeam?: string; teamImage?: string }>;
};

export const normalizeTeamKey = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Fetches all riders and teams from Firestore and returns plain objects.
 * Wrapped in unstable_cache so the result is shared across all serverless
 * function instances — only one cold-start read per 5-minute window instead
 * of one per instance.
 */
const fetchRiderReferenceData = unstable_cache(
  async (): Promise<SerializableRiderReferenceCacheData> => {
    const db = getServerFirebase();

    const [rankingsSnapshot, teamsSnapshot] = await Promise.all([
      db.collection('rankings_2026').get(),
      db.collection('teams').get(),
    ]);

    const teamsByPath: Record<string, { name: string; jerseyImageTeam?: string; teamImage?: string }> = {};
    const teamsById: Record<string, { name: string; jerseyImageTeam?: string; teamImage?: string }> = {};
    const teamImageByName = new Map<string, string>();

    teamsSnapshot.forEach((doc) => {
      const data = doc.data();
      const team = {
        name: String(data.name || ''),
        jerseyImageTeam: data.jerseyImageTeam || undefined,
        teamImage: data.teamImage || undefined,
      };
      teamsById[doc.id] = team;
      teamsByPath[doc.ref.path] = team;

      const preferredImage = team.jerseyImageTeam || team.teamImage;
      if (team.name && preferredImage) {
        teamImageByName.set(normalizeTeamKey(team.name), preferredImage);
      }
    });

    const ridersById: Record<string, RiderReferenceData> = {};

    rankingsSnapshot.forEach((doc) => {
      const rider = doc.data();
      const riderId = String(rider.nameID || rider.id || doc.id);
      if (!riderId) return;

      let teamName: string | undefined;
      let jerseyImageTeam: string | undefined;

      if (typeof rider.team === 'string') {
        teamName = rider.team;
        jerseyImageTeam = teamImageByName.get(normalizeTeamKey(rider.team));
      } else if (rider.team && typeof rider.team === 'object') {
        const teamPath = typeof (rider.team as { path?: string }).path === 'string'
          ? (rider.team as { path: string }).path
          : undefined;
        const teamId = typeof (rider.team as { id?: string }).id === 'string'
          ? (rider.team as { id: string }).id
          : undefined;
        const embeddedName = typeof (rider.team as { name?: string }).name === 'string'
          ? (rider.team as { name: string }).name
          : undefined;

        const teamFromPath = teamPath ? teamsByPath[teamPath] : undefined;
        const teamFromId = teamId ? teamsById[teamId] : undefined;

        teamName = embeddedName || teamFromPath?.name || teamFromId?.name;

        if (teamName) {
          jerseyImageTeam = teamImageByName.get(normalizeTeamKey(teamName));
        }

        if (!jerseyImageTeam) {
          jerseyImageTeam =
            teamFromPath?.jerseyImageTeam ||
            teamFromPath?.teamImage ||
            teamFromId?.jerseyImageTeam ||
            teamFromId?.teamImage ||
            (rider.team as { jerseyImageTeam?: string }).jerseyImageTeam;
        }
      }

      ridersById[riderId] = {
        points: Number(rider.points || 0),
        country: rider.country || undefined,
        rank: rider.rank || undefined,
        teamName,
        jerseyImageTeam,
      };
    });

    return { ridersById, teamsByPath };
  },
  ['rider-reference-data'],
  { revalidate: 300 }, // 5 minutes — matches the old in-memory TTL
);

/**
 * Returns rider reference data with Map interfaces preserved for callers.
 * The `db` parameter is kept for backward compatibility but is no longer used;
 * the cache function calls getServerFirebase() internally.
 */
export async function getRiderReferenceDataCached(_db: Firestore): Promise<RiderReferenceCacheData> {
  const data = await fetchRiderReferenceData();
  return {
    ridersById: new Map(Object.entries(data.ridersById)),
    teamsByPath: new Map(Object.entries(data.teamsByPath)),
  };
}
