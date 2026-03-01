import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// GET: List all chat rooms
export async function GET() {
  try {
    const snapshot = await db.collection('chat_rooms').orderBy('createdAt', 'desc').get();
    const rooms = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description || null,
        gameType: data.gameType || null,
        closesAt: data.closesAt?.toDate?.()?.toISOString() || data.closesAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        createdBy: data.createdBy,
        status: data.status,
        messageCount: data.messageCount || 0,
      };
    });
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch chat rooms' }, { status: 500 });
  }
}

// POST: Create a new chat room (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, gameType, closesAt, createdBy } = body;

    if (!title || !closesAt || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields: title, closesAt, createdBy' },
        { status: 400 }
      );
    }

    const roomData = {
      title,
      description: description || null,
      gameType: gameType || null,
      closesAt: Timestamp.fromDate(new Date(closesAt)),
      createdAt: Timestamp.now(),
      createdBy,
      status: 'open',
      messageCount: 0,
    };

    const docRef = await db.collection('chat_rooms').add(roomData);
    return NextResponse.json({ id: docRef.id });
  } catch (error) {
    console.error('Error creating chat room:', error);
    return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
  }
}
