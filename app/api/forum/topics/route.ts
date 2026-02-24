import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { ForumTopic } from '@/lib/types/forum';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const categorySlug = searchParams.get('categorySlug');
    const sort = searchParams.get('sort') || 'active';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!categoryId || !categorySlug) {
      return NextResponse.json({ error: 'categoryId and categorySlug are required' }, { status: 400 });
    }

    const snapshot = await adminDb
      .collection('forum_topics')
      .where('categoryId', '==', categoryId)
      .get();

    const creatorIds = Array.from(
      new Set(snapshot.docs.map((doc) => String(doc.data().createdBy || '')).filter(Boolean))
    );

    const userDocs = await Promise.all(
      creatorIds.map((id) => adminDb.collection('users').doc(id).get())
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

    const rawTopics = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const createdBy = data.createdBy;
        const createdByInfo = userMap.get(createdBy);
        const lastReplyUserId = data.lastReplyUserId ?? createdBy ?? null;
        const lastReplyInfo = lastReplyUserId ? userMap.get(lastReplyUserId) : undefined;
        return {
          id: doc.id,
          categoryId: data.categoryId,
          categorySlug: data.categorySlug,
          gameId: data.gameId,
          title: data.title,
          body: data.body,
          createdBy,
          createdByName: createdByInfo?.name || 'Onbekend',
          createdByAvatarUrl: createdByInfo?.avatarUrl ?? null,
          lastReplyUserId,
          lastReplyUserName: lastReplyInfo?.name || createdByInfo?.name || 'Onbekend',
          lastReplyUserAvatarUrl: lastReplyInfo?.avatarUrl ?? createdByInfo?.avatarUrl ?? null,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt,
          updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? null,
          replyCount: data.replyCount ?? 0,
          lastReplyAt: data.lastReplyAt?.toDate?.().toISOString() ?? data.lastReplyAt ?? null,
          lastReplyPreview: data.lastReplyPreview ?? null,
          pinned: data.pinned ?? false,
          status: data.status ?? 'open',
          deleted: data.deleted ?? false,
        } as ForumTopic;
      })
      .filter((topic) => !topic.deleted);

    const sortedTopics = rawTopics.sort((a, b) => {
      if (sort === 'new') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      return (b.lastReplyAt || '').localeCompare(a.lastReplyAt || '');
    });

    const topics = sortedTopics.slice(0, limit);

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Error fetching forum topics:', error);
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { categoryId, categorySlug, title, content, userId } = body || {};

    if (!categoryId || !categorySlug || !title || !content || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const now = new Date();
    const plainPreview = String(content || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
    const docRef = await adminDb.collection('forum_topics').add({
      categoryId,
      categorySlug,
      title,
      body: content,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      replyCount: 0,
      lastReplyAt: now,
      lastReplyPreview: plainPreview || null,
      lastReplyUserId: userId,
      pinned: false,
      status: 'open',
      deleted: false,
    });

    return NextResponse.json({ id: docRef.id });
  } catch (error) {
    console.error('Error creating forum topic:', error);
    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 });
  }
}
