import { NextRequest, NextResponse } from 'next/server';
import { adminDb, getServerFirebase } from '@/lib/firebase/server';
import type { ForumReply, ForumTopic, ForumTopicStatus } from '@/lib/types/forum';

function isValidDocId(value: string): boolean {
  return Boolean(value) && !value.includes('/');
}

function normalizeTopicTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isMainTopicTitle(value: string): boolean {
  const normalized = normalizeTopicTitle(value);
  return normalized === 'algemeen' || normalized === 'vragen hulp' || normalized === 'vragen en hulp';
}

function toIso(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') return value;

  if (typeof value === 'object' && value !== null) {
    const obj = value as { toDate?: () => Date; _seconds?: number };
    if (typeof obj.toDate === 'function') {
      return obj.toDate().toISOString();
    }
    if (typeof obj._seconds === 'number') {
      return new Date(obj._seconds * 1000).toISOString();
    }
  }

  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ topicId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
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
    if (topicData?.createdBy) creatorIds.add(String(topicData.createdBy));
    if (topicData?.lastReplyUserId) creatorIds.add(String(topicData.lastReplyUserId));

    const topic: ForumTopic = {
      id: topicDoc.id,
      categoryId: topicData?.categoryId,
      categorySlug: topicData?.categorySlug,
      gameId: topicData?.gameId,
      title: topicData?.title,
      isMainTopic: isMainTopicTitle(String(topicData?.title || '')),
      body: topicData?.body,
      createdBy: topicData?.createdBy,
      createdByName: 'Onbekend',
      createdByAvatarUrl: null,
      lastReplyUserId: topicData?.lastReplyUserId ?? null,
      lastReplyUserName: 'Onbekend',
      lastReplyUserAvatarUrl: null,
      createdAt: toIso(topicData?.createdAt) || new Date(0).toISOString(),
      updatedAt: toIso(topicData?.updatedAt),
      replyCount: topicData?.replyCount ?? 0,
      lastReplyAt: toIso(topicData?.lastReplyAt),
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
        if (data.createdBy) creatorIds.add(String(data.createdBy));
        return {
          id: doc.id,
          topicId: data.topicId,
          parentReplyId: data.parentReplyId ?? null,
          body: data.body,
          createdBy: data.createdBy,
          createdByName: 'Onbekend',
          createdByAvatarUrl: null,
          createdAt: toIso(data.createdAt) || new Date(0).toISOString(),
          updatedAt: toIso(data.updatedAt),
          deleted: data.deleted ?? false,
        } as ForumReply;
      })
      .filter((reply) => !reply.deleted)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    const gameId = topic.gameId ? String(topic.gameId) : '';

    const [userDocs, gameDoc] = await Promise.all([
      Promise.all(Array.from(creatorIds).map((id) => adminDb.collection('users').doc(id).get())),
      gameId && isValidDocId(gameId)
        ? adminDb.collection('games').doc(gameId).get()
        : Promise.resolve(null),
    ]);

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
      const info = userMap.get(String(topic.createdBy));
      topic.createdByName = info?.name || 'Onbekend';
      topic.createdByAvatarUrl = info?.avatarUrl ?? null;
    }

    if (topic.lastReplyUserId) {
      const info = userMap.get(String(topic.lastReplyUserId));
      topic.lastReplyUserName = info?.name || topic.createdByName || 'Onbekend';
      topic.lastReplyUserAvatarUrl = info?.avatarUrl ?? topic.createdByAvatarUrl ?? null;
    }

    if (gameDoc?.exists) {
      const gameData = gameDoc.data();
      topic.gameName = String(gameData?.name || '');
      topic.gameDivision = gameData?.division || null;
      topic.gameDivisionLevel =
        typeof gameData?.divisionLevel === 'number' ? gameData.divisionLevel : null;
    }

    replies.forEach((reply) => {
      const info = reply.createdBy ? userMap.get(String(reply.createdBy)) : undefined;
      reply.createdByName = info?.name || 'Onbekend';
      reply.createdByAvatarUrl = info?.avatarUrl ?? null;
    });

    return NextResponse.json({ topic, replies });
  } catch (error) {
    console.error('Error fetching forum topic:', error);
    return NextResponse.json({ error: 'Failed to fetch topic' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ topicId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const topicId = params.topicId;
    const body = await request.json();
    const { userId, pinned, status } = body || {};

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = getServerFirebase();
    const adminDoc = await db.collection('users').doc(String(userId)).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const topicRef = db.collection('forum_topics').doc(topicId);
    const topicDoc = await topicRef.get();
    if (!topicDoc.exists || topicDoc.data()?.deleted) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof pinned === 'boolean') {
      updates.pinned = pinned;
    }

    if (status === 'open' || status === 'locked') {
      updates.status = status as ForumTopicStatus;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No valid changes provided' }, { status: 400 });
    }

    await topicRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating forum topic:', error);
    return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ topicId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const topicId = params.topicId;
    const body = await request.json().catch(() => ({}));
    const { userId } = body || {};

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = getServerFirebase();
    const adminDoc = await db.collection('users').doc(String(userId)).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const topicRef = db.collection('forum_topics').doc(topicId);
    const topicDoc = await topicRef.get();
    if (!topicDoc.exists || topicDoc.data()?.deleted) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const repliesSnapshot = await db
      .collection('forum_replies')
      .where('topicId', '==', topicId)
      .get();

    const now = new Date();
    const replyRefs = repliesSnapshot.docs.map((doc) => doc.ref);

    let index = 0;
    while (index < replyRefs.length || index === 0) {
      const batch = db.batch();
      if (index === 0) {
        batch.update(topicRef, {
          deleted: true,
          updatedAt: now,
        });
      }

      const limit = index === 0 ? 499 : 500;
      const slice = replyRefs.slice(index, index + limit);
      for (const ref of slice) {
        batch.update(ref, {
          deleted: true,
          updatedAt: now,
        });
      }

      await batch.commit();
      index += slice.length;
      if (slice.length === 0) break;
    }

    return NextResponse.json({
      success: true,
      deletedTopicId: topicId,
      deletedReplies: repliesSnapshot.size,
    });
  } catch (error) {
    console.error('Error deleting forum topic:', error);
    return NextResponse.json(
      { error: 'Failed to delete topic', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
