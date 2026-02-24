import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { topicId: string } }
): Promise<NextResponse> {
  try {
    const topicId = params.topicId;
    const body = await request.json();
    const { content, userId, parentReplyId } = body || {};

    if (!topicId || !content || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const topicDocRef = adminDb.collection('forum_topics').doc(topicId);
    const topicDoc = await topicDocRef.get();
    if (!topicDoc.exists || topicDoc.data()?.deleted) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const now = new Date();
    const replyRef = await adminDb.collection('forum_replies').add({
      topicId,
      parentReplyId: parentReplyId ?? null,
      body: content,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });

    const preview = String(content || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
    await topicDocRef.update({
      replyCount: (topicDoc.data()?.replyCount ?? 0) + 1,
      lastReplyAt: now,
      lastReplyPreview: preview || null,
      lastReplyUserId: userId,
      updatedAt: now,
    });

    return NextResponse.json({ id: replyRef.id });
  } catch (error) {
    console.error('Error creating forum reply:', error);
    return NextResponse.json({ error: 'Failed to create reply' }, { status: 500 });
  }
}
