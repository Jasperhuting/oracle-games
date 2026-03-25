import { getServerFirebase } from "@/lib/firebase/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminHandler, ApiError } from "@/lib/api/handler";

export const POST = adminHandler('update-rider-team', async ({ uid, request }) => {
  const { riderId, teamSlug, year } = await request.json();

  if (!riderId || !teamSlug || !year) {
    throw new ApiError('Missing riderId, teamSlug, or year', 400);
  }

  const db = getServerFirebase();

  // Get team reference
  const teamDoc = await db.collection('teams').doc(teamSlug).get();

  if (!teamDoc.exists) {
    throw new ApiError('Team not found', 404);
  }

  // Update rider's team reference
  await db.collection(`rankings_${year}`).doc(riderId).update({
    team: teamDoc.ref,
    updatedBy: uid,
    updatedAt: Timestamp.now(),
  });

  // Increment cache version to invalidate client caches
  const configRef = db.collection('config').doc('cache');
  const configDoc = await configRef.get();
  const currentVersion = configDoc.exists ? (configDoc.data()?.version || 1) : 1;
  await configRef.set({
    version: currentVersion + 1,
    updatedAt: Timestamp.now()
  }, { merge: true });

  return { success: true, team: teamDoc.data() };
});
