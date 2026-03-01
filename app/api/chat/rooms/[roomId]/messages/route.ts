import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// POST: Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { text, userId, userName, userAvatar, replyTo } = body;

    if (!text?.trim() || !userId || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields: text, userId, userName' },
        { status: 400 }
      );
    }

    // Check room is open
    const roomDoc = await db.collection('chat_rooms').doc(roomId).get();
    if (!roomDoc.exists) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    const roomData = roomDoc.data()!;
    if (roomData.status === 'closed') {
      return NextResponse.json({ error: 'Chat is closed' }, { status: 403 });
    }
    const closesAt = roomData.closesAt?.toDate?.() || new Date(roomData.closesAt);
    if (closesAt <= new Date()) {
      return NextResponse.json({ error: 'Chat has expired' }, { status: 403 });
    }

    // Check if user is muted
    const mutedSnapshot = await db
      .collection(`chat_rooms/${roomId}/muted_users`)
      .where('userId', '==', userId)
      .where('mutedUntil', '>', Timestamp.now())
      .limit(1)
      .get();
    if (!mutedSnapshot.empty) {
      return NextResponse.json({ error: 'You are muted' }, { status: 403 });
    }

    const messageData = {
      text: text.trim(),
      userId,
      userName,
      userAvatar: userAvatar || null,
      replyTo: replyTo || null,
      reactions: {},
      deleted: false,
      createdAt: Timestamp.now(),
    };

    const docRef = await db.collection(`chat_rooms/${roomId}/messages`).add(messageData);

    // Increment message count
    await db.collection('chat_rooms').doc(roomId).update({
      messageCount: FieldValue.increment(1),
    });

    return NextResponse.json({ id: docRef.id });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
