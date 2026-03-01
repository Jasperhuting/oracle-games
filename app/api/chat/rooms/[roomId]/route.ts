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

// GET: Single chat room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const doc = await db.collection('chat_rooms').doc(roomId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    const data = doc.data()!;
    const computedMessageCount = await getVisibleMessageCount(roomId);

    if ((data.messageCount || 0) !== computedMessageCount) {
      await db.collection('chat_rooms').doc(roomId).update({
        messageCount: computedMessageCount,
      });
    }

    return NextResponse.json({
      id: doc.id,
      title: data.title,
      description: data.description || null,
      gameType: data.gameType || null,
      closesAt: data.closesAt?.toDate?.()?.toISOString() || data.closesAt,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      createdBy: data.createdBy,
      status: data.status,
      messageCount: computedMessageCount,
    });
  } catch (error) {
    console.error('Error fetching chat room:', error);
    return NextResponse.json({ error: 'Failed to fetch chat room' }, { status: 500 });
  }
}

// PATCH: Update chat room (status, closesAt, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status !== undefined) updates.status = body.status;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.closesAt !== undefined) updates.closesAt = Timestamp.fromDate(new Date(body.closesAt));

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await db.collection('chat_rooms').doc(roomId).update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating chat room:', error);
    return NextResponse.json({ error: 'Failed to update chat room' }, { status: 500 });
  }
}

// DELETE: Delete chat room and all subcollections
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // Delete messages subcollection
    const messagesSnapshot = await db.collection(`chat_rooms/${roomId}/messages`).get();
    const batch = db.batch();
    messagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete muted_users subcollection
    const mutedSnapshot = await db.collection(`chat_rooms/${roomId}/muted_users`).get();
    mutedSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete the room itself
    batch.delete(db.collection('chat_rooms').doc(roomId));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat room:', error);
    return NextResponse.json({ error: 'Failed to delete chat room' }, { status: 500 });
  }
}
