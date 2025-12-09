import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { MessagesResponse, ApiErrorResponse, ClientMessage } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<MessagesResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get all messages for this user
    const messagesSnapshot = await adminDb
      .collection('messages')
      .where('recipientId', '==', userId)
      .orderBy('sentAt', 'desc')
      .get();

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
