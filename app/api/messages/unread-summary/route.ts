import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

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

    const baseQuery = adminDb
      .collection('messages')
      .where('recipientId', '==', userId)
      .where('read', '==', false);

    const unreadSnapshot = await baseQuery.orderBy('sentAt', 'desc').get();
    const visibleUnreadDocs = unreadSnapshot.docs.filter((doc) => {
      const data = doc.data();
      return !data.deletedAt && !data.deletedByRecipient;
    });
    const latestDoc = visibleUnreadDocs[0];

    return NextResponse.json({
      count: visibleUnreadDocs.length,
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
