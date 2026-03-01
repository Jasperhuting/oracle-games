import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { sendChatSummaryNotification } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('[CRON] Unauthorized access to chat-telegram-summary');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Checking for new chat messages to summarize');

    // Get messages from the last 15 minutes
    const fifteenMinutesAgo = Timestamp.fromDate(
      new Date(Date.now() - 15 * 60 * 1000)
    );

    // Find all open chat rooms
    const roomsSnapshot = await db
      .collection('chat_rooms')
      .where('status', '==', 'open')
      .get();

    let totalSent = 0;

    for (const roomDoc of roomsSnapshot.docs) {
      const roomData = roomDoc.data();

      // Get recent non-deleted messages
      const messagesSnapshot = await db
        .collection(`chat_rooms/${roomDoc.id}/messages`)
        .where('createdAt', '>=', fifteenMinutesAgo)
        .where('deleted', '==', false)
        .orderBy('createdAt', 'asc')
        .get();

      if (messagesSnapshot.empty) continue;

      const messages = messagesSnapshot.docs.map((doc) => ({
        userName: doc.data().userName,
        text: doc.data().text,
      }));

      const sent = await sendChatSummaryNotification(
        roomData.title,
        messages,
        roomDoc.id
      );

      if (sent) {
        totalSent++;
        console.log(
          `[CRON] Sent summary for "${roomData.title}" (${messages.length} messages)`
        );
      }
    }

    console.log(`[CRON] Sent ${totalSent} chat summaries`);
    return Response.json({ success: true, summariesSent: totalSent });
  } catch (error) {
    console.error('[CRON] Error sending chat summaries:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
