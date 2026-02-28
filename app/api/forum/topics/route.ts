import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { ForumTopic } from '@/lib/types/forum';

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const gameId = searchParams.get('gameId');
    const gameIdsParam = searchParams.get('gameIds');
    const requestedGameIds = (gameIdsParam || '')
      .split(',')
      .map((id) => id.trim())
      .filter(isValidDocId);
    const sort = searchParams.get('sort') || 'active';
    const mainOnly = searchParams.get('mainOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!categoryId && !gameId && requestedGameIds.length === 0) {
      return NextResponse.json({ error: 'gameId, gameIds or categoryId is required' }, { status: 400 });
    }

    let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (requestedGameIds.length > 0) {
      const snapshots = await Promise.all(
        requestedGameIds.map((id) =>
          adminDb.collection('forum_topics').where('gameId', '==', id).get()
        )
      );

      const byId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((doc) => {
          byId.set(doc.id, doc);
        });
      });
      docs = Array.from(byId.values());
    } else {
      let query = adminDb.collection('forum_topics') as FirebaseFirestore.Query;
      if (gameId) {
        query = query.where('gameId', '==', gameId);
      } else if (categoryId) {
        query = query.where('categoryId', '==', categoryId);
      }
      const snapshot = await query.get();
      docs = snapshot.docs;
    }

    const creatorIds = Array.from(
      new Set(
        docs.flatMap((doc) => {
          const data = doc.data();
          const ids = [String(data.createdBy || '')];
          if (data.lastReplyUserId) ids.push(String(data.lastReplyUserId));
          return ids.filter(Boolean);
        })
      )
    ).filter(isValidDocId);

    const referencedGameIds = Array.from(
      new Set(
        docs
          .map((doc) => String(doc.data().gameId || ''))
          .filter(isValidDocId)
      )
    );

    const [userDocs, gameDocs] = await Promise.all([
      Promise.all(
        creatorIds.map(async (id) => {
          try {
            return await adminDb.collection('users').doc(id).get();
          } catch {
            return null;
          }
        })
      ),
      Promise.all(
        referencedGameIds.map(async (id) => {
          try {
            return await adminDb.collection('games').doc(id).get();
          } catch {
            return null;
          }
        })
      ),
    ]);

    const userMap = new Map<string, { name: string; avatarUrl?: string | null }>();
    userDocs.forEach((doc) => {
      if (!doc) return;
      const data = doc.data();
      if (doc.exists && data) {
        userMap.set(doc.id, {
          name: data.playername || data.displayName || data.email || 'Onbekend',
          avatarUrl: data.avatarUrl || null,
        });
      }
    });

    const gameMap = new Map<string, { name: string; division?: string | null; divisionLevel?: number | null }>();
    gameDocs.forEach((doc) => {
      if (!doc) return;
      const data = doc.data();
      if (doc.exists && data?.name) {
        gameMap.set(doc.id, {
          name: String(data.name),
          division: data.division || null,
          divisionLevel: typeof data.divisionLevel === 'number' ? data.divisionLevel : null,
        });
      }
    });

    const rawTopics = docs
      .map((doc) => {
        const data = doc.data();
        const createdBy = String(data.createdBy || '');
        const createdByInfo = userMap.get(createdBy);
        const lastReplyUserId = data.lastReplyUserId ? String(data.lastReplyUserId) : createdBy || null;
        const lastReplyInfo = lastReplyUserId ? userMap.get(lastReplyUserId) : undefined;

        const gameInfo = data.gameId ? gameMap.get(String(data.gameId)) : undefined;

        return {
          id: doc.id,
          categoryId: data.categoryId,
          categorySlug: data.categorySlug,
          gameId: data.gameId,
          gameName: gameInfo?.name,
          gameDivision: gameInfo?.division ?? null,
          gameDivisionLevel: gameInfo?.divisionLevel ?? null,
          title: data.title,
          isMainTopic: isMainTopicTitle(String(data.title || '')),
          body: data.body,
          createdBy,
          createdByName: createdByInfo?.name || 'Onbekend',
          createdByAvatarUrl: createdByInfo?.avatarUrl ?? null,
          lastReplyUserId,
          lastReplyUserName: lastReplyInfo?.name || createdByInfo?.name || 'Onbekend',
          lastReplyUserAvatarUrl: lastReplyInfo?.avatarUrl ?? createdByInfo?.avatarUrl ?? null,
          createdAt: toIso(data.createdAt) || new Date(0).toISOString(),
          updatedAt: toIso(data.updatedAt),
          replyCount: data.replyCount ?? 0,
          lastReplyAt: toIso(data.lastReplyAt),
          lastReplyPreview: data.lastReplyPreview ?? null,
          pinned: data.pinned ?? false,
          status: data.status ?? 'open',
          deleted: data.deleted ?? false,
        } as ForumTopic;
      })
      .filter((topic) => !topic.deleted);

    const baseTopics = mainOnly ? rawTopics.filter((topic) => topic.isMainTopic) : rawTopics;

    const sortedTopics = baseTopics.sort((a, b) => {
      if ((a.pinned ?? false) !== (b.pinned ?? false)) {
        return a.pinned ? -1 : 1;
      }

      if (sort === 'new') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }

      return (b.lastReplyAt || b.createdAt || '').localeCompare(a.lastReplyAt || a.createdAt || '');
    });

    const topics = sortedTopics.slice(0, limit);

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Error fetching forum topics:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch topics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { categoryId, categorySlug, gameId, title, content, userId } = body || {};

    if (!title || !content || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!gameId && !categoryId) {
      return NextResponse.json({ error: 'gameId or categoryId is required' }, { status: 400 });
    }

    if (gameId) {
      const gameDoc = await adminDb.collection('games').doc(String(gameId)).get();
      if (!gameDoc.exists) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }
    }

    const now = new Date();
    const plainPreview = String(content || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
    const docRef = await adminDb.collection('forum_topics').add({
      categoryId: categoryId ?? null,
      categorySlug: categorySlug ?? null,
      gameId: gameId ?? null,
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
