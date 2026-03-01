import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('[CRON] Unauthorized access to close-expired-chats');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Checking for expired chat rooms');

    const now = Timestamp.now();
    const snapshot = await db
      .collection('chat_rooms')
      .where('status', '==', 'open')
      .where('closesAt', '<=', now)
      .get();

    let closed = 0;
    for (const doc of snapshot.docs) {
      await doc.ref.update({ status: 'closed' });
      closed++;
      console.log(`[CRON] Closed chat room: ${doc.id} (${doc.data().title})`);
    }

    console.log(`[CRON] Closed ${closed} expired chat rooms`);
    return Response.json({ success: true, closed });
  } catch (error) {
    console.error('[CRON] Error closing expired chats:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
