import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { MessagesResponse, ApiErrorResponse, ClientMessage } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<MessagesResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type'); // 'inbox' or 'outbox'

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get messages based on type
    let messagesSnapshot;
    if (type === 'outbox') {
      // Get sent messages
      messagesSnapshot = await adminDb
        .collection('messages')
        .where('senderId', '==', userId)
        .orderBy('sentAt', 'desc')
        .get();
    } else {
      // Default to inbox (received messages)
      messagesSnapshot = await adminDb
        .collection('messages')
        .where('recipientId', '==', userId)
        .orderBy('sentAt', 'desc')
        .get();
    }

    const messages = messagesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        sentAt: data.sentAt?.toDate().toISOString(),
        readAt: data.readAt?.toDate().toISOString(),
      } as ClientMessage;
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
