import { adminHandler } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

// This endpoint initializes the existing races in the database
export const POST = adminHandler('initialize-races', async ({ uid, request }) => {
  const db = getServerFirebase();

  const existingRaces = [
    {
      slug: 'giro-d-italia_2025',
      name: 'Giro d\'Italia',
      year: 2025,
      description: 'De Giro d\'Italia 2025',
    },
    {
      slug: 'tour-de-france_2025',
      name: 'Tour de France',
      year: 2025,
      description: 'De Tour de France 2025',
    },
    {
      slug: 'vuelta-a-espana_2025',
      name: 'Vuelta a España',
      year: 2025,
      description: 'De Vuelta a España 2025',
    },
  ];

  const batch = db.batch();
  const timestamp = new Date().toISOString();

  for (const race of existingRaces) {
    const raceRef = db.collection('races').doc(race.slug);
    const existingRace = await raceRef.get();

    // Only create if doesn't exist
    if (!existingRace.exists) {
      batch.set(raceRef, {
        ...race,
        createdAt: timestamp,
        createdBy: uid,
        updatedAt: timestamp,
        active: true,
      });
    }
  }

  await batch.commit();

  // Log the activity
  const adminDoc = await db.collection('users').doc(uid).get();
  const adminData = adminDoc.data();
  await db.collection('activityLogs').add({
    action: 'RACES_INITIALIZED',
    userId: uid,
    userEmail: adminData?.email,
    userName: adminData?.playername || adminData?.email,
    details: {
      racesCount: existingRaces.length,
    },
    timestamp: Timestamp.now(),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  });

  return {
    success: true,
    message: 'Races initialized successfully'
  };
});
