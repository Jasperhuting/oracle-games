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
      console.error('[CRON] Unauthorized access to open-scheduled-chats');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Checking for scheduled chat rooms to open');

    const now = new Date();
    const snapshot = await db
      .collection('chat_rooms')
      .where('status', '==', 'scheduled')
      .get();

    const batch = db.batch();
    let opened = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const opensAtRaw = data.opensAt;

      // No opensAt means open immediately
      if (!opensAtRaw) {
        batch.update(doc.ref, { status: 'open' });
        opened++;
        console.log(`[CRON] Opened chat room (no opensAt): ${doc.id} (${data.title})`);
        continue;
      }

      const opensAt =
        opensAtRaw instanceof Timestamp
          ? opensAtRaw.toDate()
          : new Date(opensAtRaw);

      if (!(opensAt instanceof Date) || Number.isNaN(opensAt.getTime())) {
        console.warn(`[CRON] Skipping chat room with invalid opensAt: ${doc.id}`);
        continue;
      }

      if (opensAt > now) {
        continue;
      }

      batch.update(doc.ref, { status: 'open' });
      opened++;
      console.log(`[CRON] Opened scheduled chat room: ${doc.id} (${data.title})`);
    }

    if (opened > 0) {
      await batch.commit();
    }

    console.log(`[CRON] Opened ${opened} scheduled chat rooms`);
    return Response.json({ success: true, opened });
  } catch (error) {
    console.error('[CRON] Error opening scheduled chats:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
