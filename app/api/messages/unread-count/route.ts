import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { UnreadMessagesCountResponse, ApiErrorResponse } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<UnreadMessagesCountResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Count unread messages for this user
    const unreadSnapshot = await adminDb
      .collection('messages')
      .where('recipientId', '==', userId)
      .where('read', '==', false)
      .get();

    return NextResponse.json({ 
      count: unreadSnapshot.size 
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}
