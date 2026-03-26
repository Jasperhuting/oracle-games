import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { getSessionUserRole } from '@/lib/auth/session-user';

type UnreadSummaryResponse = {
  count: number;
  latestMessage: {
    id: string;
    subject: string;
    senderName: string;
    sentAt: string;
  } | null;
};

export async function GET(request: NextRequest): Promise<NextResponse<UnreadSummaryResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify session — only the authenticated user may fetch their own unread count
    const { uid } = await getSessionUserRole();
    if (!uid || uid !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseQuery = adminDb
      .collection('messages')
      .where('recipientId', '==', userId)
      .where('read', '==', false)
      .where('deletedByRecipient', '!=', true);

    // Run count and latest-message fetch in parallel — 2 reads total regardless of message count
    const [countResult, latestSnapshot] = await Promise.all([
      baseQuery.count().get(),
      baseQuery.orderBy('sentAt', 'desc').limit(3).get(),
    ]);

    // Filter for first non-deleted message (deletedAt check in memory)
    const latestDoc = latestSnapshot.docs.find((doc) => !doc.data().deletedAt) ?? null;

    return NextResponse.json({
      count: countResult.data().count,
      latestMessage: latestDoc
        ? {
            id: latestDoc.id,
            subject: latestDoc.data().subject ?? '',
            senderName: latestDoc.data().senderName ?? 'Onbekend',
            sentAt: latestDoc.data().sentAt?.toDate?.()?.toISOString?.() ?? '',
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching unread summary:', error);
    return NextResponse.json({ error: 'Failed to fetch unread summary' }, { status: 500 });
  }
}
