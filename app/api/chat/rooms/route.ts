import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

async function getVisibleMessageCount(roomId: string): Promise<number> {
  const messagesRef = db.collection(`chat_rooms/${roomId}/messages`);
  const [totalSnapshot, deletedSnapshot] = await Promise.all([
    messagesRef.count().get(),
    messagesRef.where('deleted', '==', true).count().get(),
  ]);

  const total = totalSnapshot.data().count || 0;
  const deleted = deletedSnapshot.data().count || 0;
  return Math.max(0, total - deleted);
}

// GET: List all chat rooms
export async function GET() {
  try {
    const snapshot = await db.collection('chat_rooms').orderBy('createdAt', 'desc').get();
    const rooms = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const computedMessageCount = await getVisibleMessageCount(doc.id);

      if ((data.messageCount || 0) !== computedMessageCount) {
        await db.collection('chat_rooms').doc(doc.id).update({
          messageCount: computedMessageCount,
        });
      }

      return {
        id: doc.id,
        title: data.title,
        description: data.description || null,
        gameType: data.gameType || null,
        closesAt: data.closesAt?.toDate?.()?.toISOString() || data.closesAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        createdBy: data.createdBy,
        status: data.status,
        messageCount: computedMessageCount,
      };
    }));
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
