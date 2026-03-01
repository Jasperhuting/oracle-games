import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// PATCH: Update message (soft delete or toggle reaction)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; messageId: string }> }
) {
  try {
    const { roomId, messageId } = await params;
    const body = await request.json();
    const msgRef = db.doc(`chat_rooms/${roomId}/messages/${messageId}`);
    const roomRef = db.collection('chat_rooms').doc(roomId);

    // Soft delete (admin only — enforced by caller)
    if (body.deleted === true) {
      let notFound = false;
      await db.runTransaction(async (tx) => {
        const msgDoc = await tx.get(msgRef);
        if (!msgDoc.exists) {
          notFound = true;
          return;
        }

        const wasDeleted = msgDoc.data()?.deleted === true;
        if (wasDeleted) return;

        tx.update(msgRef, { deleted: true });
        tx.update(roomRef, {
          messageCount: FieldValue.increment(-1),
        });
      });

      if (notFound) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // Edit message (only by the author)
    if (body.editText !== undefined && body.userId) {
      const newText = body.editText.trim();
      if (!newText) {
        return NextResponse.json({ error: 'Text cannot be empty' }, { status: 400 });
      }
      const msgDoc = await msgRef.get();
      if (!msgDoc.exists) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      const msgData = msgDoc.data()!;
      if (msgData.userId !== body.userId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      // Push old text to edit history
      await msgRef.update({
        text: newText,
        editedAt: Timestamp.now(),
        editHistory: FieldValue.arrayUnion({
          text: msgData.text,
          editedAt: Timestamp.now(),
        }),
      });
      return NextResponse.json({ success: true });
    }

    // Toggle reaction
    if (body.reaction && body.userId) {
      const { reaction, userId } = body;
      const msgDoc = await msgRef.get();
      if (!msgDoc.exists) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      const reactions = msgDoc.data()!.reactions || {};
      const users: string[] = reactions[reaction] || [];

      if (users.includes(userId)) {
        // Remove reaction
        await msgRef.update({
          [`reactions.${reaction}`]: FieldValue.arrayRemove(userId),
        });
      } else {
        // Add reaction
        await msgRef.update({
          [`reactions.${reaction}`]: FieldValue.arrayUnion(userId),
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No valid action provided' }, { status: 400 });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
