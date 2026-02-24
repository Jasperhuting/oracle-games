import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { ForumReply, ForumTopic } from '@/lib/types/forum';

export async function GET(
  _request: NextRequest,
  { params }: { params: { topicId: string } }
): Promise<NextResponse> {
  try {
    const topicId = params.topicId;
    const topicDoc = await adminDb.collection('forum_topics').doc(topicId).get();
    if (!topicDoc.exists) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const topicData = topicDoc.data();
    if (topicData?.deleted) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const creatorIds = new Set<string>();
    if (topicData?.createdBy) creatorIds.add(topicData.createdBy);
    if (topicData?.lastReplyUserId) creatorIds.add(topicData.lastReplyUserId);

    const topic: ForumTopic = {
      id: topicDoc.id,
      categoryId: topicData?.categoryId,
      categorySlug: topicData?.categorySlug,
      gameId: topicData?.gameId,
      title: topicData?.title,
      body: topicData?.body,
      createdBy: topicData?.createdBy,
      createdByName: 'Onbekend',
      createdByAvatarUrl: null,
      lastReplyUserId: topicData?.lastReplyUserId ?? null,
      lastReplyUserName: 'Onbekend',
      lastReplyUserAvatarUrl: null,
      createdAt: topicData?.createdAt?.toDate?.().toISOString() ?? topicData?.createdAt,
      updatedAt: topicData?.updatedAt?.toDate?.().toISOString() ?? topicData?.updatedAt ?? null,
      replyCount: topicData?.replyCount ?? 0,
      lastReplyAt: topicData?.lastReplyAt?.toDate?.().toISOString() ?? topicData?.lastReplyAt ?? null,
      lastReplyPreview: topicData?.lastReplyPreview ?? null,
      pinned: topicData?.pinned ?? false,
      status: topicData?.status ?? 'open',
      deleted: topicData?.deleted ?? false,
    };

    const repliesSnapshot = await adminDb
      .collection('forum_replies')
      .where('topicId', '==', topicId)
      .get();

    const replies = repliesSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        if (data.createdBy) creatorIds.add(data.createdBy);
        return {
          id: doc.id,
          topicId: data.topicId,
          parentReplyId: data.parentReplyId ?? null,
          body: data.body,
          createdBy: data.createdBy,
          createdByName: 'Onbekend',
          createdByAvatarUrl: null,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt,
          updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? null,
          deleted: data.deleted ?? false,
        } as ForumReply;
      })
      .filter((reply) => !reply.deleted)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    const userDocs = await Promise.all(
      Array.from(creatorIds).map((id) => adminDb.collection('users').doc(id).get())
    );
    const userMap = new Map<string, { name: string; avatarUrl?: string | null }>();
    userDocs.forEach((doc) => {
      const data = doc.data();
      if (doc.exists && data) {
        userMap.set(doc.id, {
          name: data.playername || data.displayName || data.email || 'Onbekend',
          avatarUrl: data.avatarUrl || null,
        });
      }
    });

    if (topic.createdBy) {
      const info = userMap.get(topic.createdBy);
      topic.createdByName = info?.name || 'Onbekend';
      topic.createdByAvatarUrl = info?.avatarUrl ?? null;
    }

    if (topic.lastReplyUserId) {
      const info = userMap.get(topic.lastReplyUserId);
      topic.lastReplyUserName = info?.name || topic.createdByName || 'Onbekend';
      topic.lastReplyUserAvatarUrl = info?.avatarUrl ?? topic.createdByAvatarUrl ?? null;
    }
    replies.forEach((reply) => {
      const info = reply.createdBy ? userMap.get(reply.createdBy) : undefined;
      reply.createdByName = info?.name || 'Onbekend';
      reply.createdByAvatarUrl = info?.avatarUrl ?? null;
    });

    return NextResponse.json({ topic, replies });
  } catch (error) {
    console.error('Error fetching forum topic:', error);
    return NextResponse.json({ error: 'Failed to fetch topic' }, { status: 500 });
  }
}
