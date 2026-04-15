import { userHandler } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

const ACTIVE_THRESHOLD_MINUTES = 10;

export const GET = userHandler('active-users', async () => {
  const db = getServerFirebase();
  const cutoff = Timestamp.fromMillis(Date.now() - ACTIVE_THRESHOLD_MINUTES * 60 * 1000);

  const snapshot = await db
    .collection('users')
    .where('lastActiveAt', '>=', cutoff)
    .get();

  const users = snapshot.docs
    .map(doc => {
      const data = doc.data();
      // Only include users who have not opted out of showing online status
      // Default is visible (showOnlineStatus === undefined or true)
      if (data.showOnlineStatus === false) return null;
      return {
        uid: doc.id,
        playername: data.playername as string,
        avatarUrl: data.avatarUrl as string | undefined,
      };
    })
    .filter(Boolean);

  return { users, total: snapshot.size };
});
