import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminHandler, ApiError } from '@/lib/api/handler';

export const dynamic = 'force-dynamic';

// POST: Mute a user (admin only)
export const POST = adminHandler('mute-user', async ({ uid, request, params }) => {
  const { roomId } = params;
  const { userId, durationMinutes, reason } = await request.json();

  if (!userId || !durationMinutes) throw new ApiError('Missing required fields: userId, durationMinutes', 400);

  const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

  await db.collection(`chat_rooms/${roomId}/muted_users`).add({
    userId,
    mutedBy: uid,  // from verified token, not body
    mutedUntil: Timestamp.fromDate(mutedUntil),
    reason: reason || null,
  });

  return { success: true, mutedUntil: mutedUntil.toISOString() };
});
