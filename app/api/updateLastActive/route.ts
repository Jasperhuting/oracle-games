import { userHandler } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = userHandler('update-last-active', async ({ uid }) => {
  const db = getServerFirebase();
  await db.collection('users').doc(uid).set({ lastActiveAt: Timestamp.now() }, { merge: true });
  return { success: true };
});
