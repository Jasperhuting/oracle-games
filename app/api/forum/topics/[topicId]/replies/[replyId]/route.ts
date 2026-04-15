import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ topicId: string; replyId: string }> }
): Promise<NextResponse> {
  try {
    const { topicId, replyId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { userId } = body || {};

    if (!userId || !replyId || !topicId) {
      return NextResponse.json({ error: 'userId, topicId en replyId zijn verplicht' }, { status: 400 });
    }

    const userDoc = await adminDb.collection('users').doc(String(userId)).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });
    }
    const isAdmin = userDoc.data()?.userType === 'admin';

    const replyRef = adminDb.collection('forum_replies').doc(replyId);
    const replyDoc = await replyRef.get();
    if (!replyDoc.exists || replyDoc.data()?.deleted) {
      return NextResponse.json({ error: 'Reactie niet gevonden' }, { status: 404 });
    }

    const replyData = replyDoc.data();
    const isOwner = String(replyData?.createdBy || '') === String(userId);

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    if (replyData?.topicId !== topicId) {
      return NextResponse.json({ error: 'Reactie hoort niet bij dit topic' }, { status: 400 });
    }

    const now = new Date();

    await replyRef.update({ deleted: true, updatedAt: now });

    // Decrement topic reply count
    const topicRef = adminDb.collection('forum_topics').doc(topicId);
    const topicDoc = await topicRef.get();
    if (topicDoc.exists && !topicDoc.data()?.deleted) {
      const currentCount = topicDoc.data()?.replyCount ?? 0;
      await topicRef.update({
        replyCount: Math.max(0, currentCount - 1),
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting forum reply:', error);
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
