import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Soft delete (admin only — enforced by caller)
    if (body.deleted === true) {
      await msgRef.update({ deleted: true });
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
