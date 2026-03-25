import { userHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = userHandler('update-last-active', async ({ uid }) => {
  const db = getServerFirebase();
  const userRef = db.collection('users').doc(uid);
  if (!(await userRef.get()).exists) throw new ApiError('User not found', 404);
  await userRef.update({ lastActiveAt: Timestamp.now() });
  return { success: true };
});
