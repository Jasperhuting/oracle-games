import { adminHandler, ApiError, publicHandler } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

// GET race lineup
export const GET = publicHandler('race-lineups-get', async ({ params }) => {
  const { raceSlug } = params;
  const db = getServerFirebase();

  const lineupDoc = await db.collection('raceLineups').doc(raceSlug).get();

  if (!lineupDoc.exists) {
    throw new ApiError('Race lineup not found', 404);
  }

  const data = lineupDoc.data();

  return {
    success: true,
    lineup: {
      id: lineupDoc.id,
      ...data,
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt,
      raceRef: data?.raceRef?.path || data?.raceRef,
    },
  };
});

// CREATE or UPDATE race lineup (admin only)
export const PUT = adminHandler('race-lineups-put', async ({ uid, request, params }) => {
  const { raceSlug } = params;
  const { year, teams } = await request.json();

  if (!teams || !Array.isArray(teams)) {
    throw new ApiError('Teams array is required', 400);
  }

  const db = getServerFirebase();

  // Get race reference
  const raceRef = db.collection('races').doc(raceSlug);
  const raceDoc = await raceRef.get();

  if (!raceDoc.exists) {
    throw new ApiError('Race not found', 404);
  }

  const raceData = raceDoc.data();

  // Create or update lineup
  const lineup = {
    raceRef: raceRef,
    year: year || raceData?.year || new Date().getFullYear(),
    updatedAt: new Date(),
    updatedBy: uid,
    teams,
  };

  await db.collection('raceLineups').doc(raceSlug).set(lineup, { merge: true });

  // Extract all rider nameIds and team slugs
  interface TeamWithRiders {
    teamSlug: string;
    riders?: Array<{ nameId: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }
  const eligibleTeams = (teams as TeamWithRiders[]).map((t) => t.teamSlug);
  const eligibleRiders = (teams as TeamWithRiders[]).flatMap((t) =>
    t.riders?.map((r) => r.nameId) || []
  );

  // Log the activity
  const adminDoc = await db.collection('users').doc(uid).get();
  const adminData = adminDoc.data();
  await db.collection('activityLogs').add({
    action: 'RACE_LINEUP_UPDATED',
    userId: uid,
    userEmail: adminData?.email,
    userName: adminData?.playername || adminData?.email,
    details: {
      raceSlug,
      raceName: raceData?.name,
      teamsCount: teams.length,
      ridersCount: eligibleRiders.length,
    },
    timestamp: Timestamp.now(),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  });

  return {
    success: true,
    lineup: {
      id: raceSlug,
      ...lineup,
      updatedAt: lineup.updatedAt.toISOString(),
      raceRef: raceRef.path,
    },
    eligibleTeams,
    eligibleRiders,
  };
});
