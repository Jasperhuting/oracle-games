import { userHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = userHandler('account-preferences', async ({ request, uid }) => {
  const body = await request.json();
  const { userId, sportInterests, gameReminders, emailMarketing, showOnlineStatus } = body;

  if (uid !== userId) {
    throw new ApiError('Forbidden', 403);
  }

  if (!userId) {
    throw new ApiError('User ID is required', 400);
  }

  if (sportInterests !== undefined && !Array.isArray(sportInterests)) {
    throw new ApiError('sportInterests must be an array', 400);
  }

  const db = getServerFirebase();

  const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() };
  if (sportInterests !== undefined) updateData.sportInterests = sportInterests;
  if (gameReminders !== undefined) updateData.gameReminders = Boolean(gameReminders);
  if (emailMarketing !== undefined) updateData.emailMarketing = Boolean(emailMarketing);
  if (showOnlineStatus !== undefined) updateData.showOnlineStatus = Boolean(showOnlineStatus);

  await db.collection('users').doc(userId).update(updateData);

  return { success: true };
});
