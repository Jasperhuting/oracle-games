import type { Firestore } from 'firebase-admin/firestore';

const CACHE_TTL_MS = 5 * 60 * 1000;

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

let cachedData: RiderReferenceCacheData | null = null;
let cachedAt = 0;
let inFlight: Promise<RiderReferenceCacheData> | null = null;

export const normalizeTeamKey = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function loadRiderReferenceData(db: Firestore): Promise<RiderReferenceCacheData> {
  const [rankingsSnapshot, teamsSnapshot] = await Promise.all([
    db.collection('rankings_2026').get(),
    db.collection('teams').get(),
  ]);

  const teamsByPath = new Map<string, { name: string; jerseyImageTeam?: string; teamImage?: string }>();
  const teamsById = new Map<string, { name: string; jerseyImageTeam?: string; teamImage?: string }>();
  const teamImageByName = new Map<string, string>();

  teamsSnapshot.forEach((doc) => {
    const data = doc.data();
    const team = {
      name: String(data.name || ''),
      jerseyImageTeam: data.jerseyImageTeam || undefined,
      teamImage: data.teamImage || undefined,
    };
    teamsById.set(doc.id, team);
    teamsByPath.set(doc.ref.path, team);

    const preferredImage = team.jerseyImageTeam || team.teamImage;
    if (team.name && preferredImage) {
      teamImageByName.set(normalizeTeamKey(team.name), preferredImage);
    }
  });

  const ridersById = new Map<string, RiderReferenceData>();

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

      const teamFromPath = teamPath ? teamsByPath.get(teamPath) : undefined;
      const teamFromId = teamId ? teamsById.get(teamId) : undefined;

      teamName = embeddedName || teamFromPath?.name || teamFromId?.name;

      if (teamName) {
        jerseyImageTeam = teamImageByName.get(normalizeTeamKey(teamName));
      }

      if (!jerseyImageTeam) {
        jerseyImageTeam = teamFromPath?.jerseyImageTeam ||
          teamFromPath?.teamImage ||
          teamFromId?.jerseyImageTeam ||
          teamFromId?.teamImage ||
          (rider.team as { jerseyImageTeam?: string }).jerseyImageTeam;
      }
    }

    ridersById.set(riderId, {
      points: Number(rider.points || 0),
      country: rider.country || undefined,
      rank: rider.rank || undefined,
      teamName,
      jerseyImageTeam,
    });
  });

  return {
    ridersById,
    teamsByPath,
  };
}

export async function getRiderReferenceDataCached(db: Firestore): Promise<RiderReferenceCacheData> {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) {
    return cachedData;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = loadRiderReferenceData(db)
    .then((data) => {
      cachedData = data;
      cachedAt = Date.now();
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
