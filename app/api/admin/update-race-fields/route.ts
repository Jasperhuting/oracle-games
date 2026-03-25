import { adminHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';

export const POST = adminHandler('update-race-fields', async ({ uid, request }) => {
  const { raceId } = await request.json();

  if (!raceId) {
    throw new ApiError('Race ID is required', 400);
  }

  const db = getServerFirebase();

  // Get the race document
  const raceRef = db.collection('races').doc(raceId);
  const raceDoc = await raceRef.get();

  if (!raceDoc.exists) {
    throw new ApiError(`Race ${raceId} not found`, 404);
  }

  const raceData = raceDoc.data();

  // Add missing fields if they don't exist
  const updates: Record<string, unknown> = {};

  if (!raceData?.createdAt) {
    updates.createdAt = raceData?.scrapedAt || new Date().toISOString();
  }

  if (raceData?.active === undefined) {
    updates.active = true;
  }

  if (!raceData?.description) {
    updates.description = '';
  }

  if (!raceData?.createdBy) {
    updates.createdBy = uid;
  }

  if (Object.keys(updates).length > 0) {
    await raceRef.update(updates);
    return {
      success: true,
      message: `Race ${raceId} updated`,
      updates
    };
  }

  return {
    success: true,
    message: 'No updates needed - all fields already exist'
  };
});
