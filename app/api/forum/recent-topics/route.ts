import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as { toDate?: () => Date; _seconds?: number };
    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
    if (typeof obj._seconds === 'number') return new Date(obj._seconds * 1000).toISOString();
  }
  return null;
}

function isValidDocId(value: string): boolean {
  return Boolean(value) && !value.includes('/');
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const snapshot = await adminDb
      .collection('forum_topics')
      .orderBy('lastReplyAt', 'desc')
      .limit(50)
      .get();

    const docs = snapshot.docs.filter((doc) => !doc.data().deleted);

    if (docs.length === 0) {
      return NextResponse.json({ topics: [] });
    }

    const creatorIds = Array.from(
      new Set(
        docs.flatMap((doc) => {
          const data = doc.data();
          return [
            String(data.createdBy || ''),
            data.lastReplyUserId ? String(data.lastReplyUserId) : '',
          ].filter(Boolean);
        })
      )
    ).filter(isValidDocId);

    const gameIds = Array.from(
      new Set(docs.map((doc) => String(doc.data().gameId || '')).filter(isValidDocId))
    );

    const categoryIds = Array.from(
      new Set(docs.map((doc) => String(doc.data().categoryId || '')).filter(isValidDocId))
    );

    const [userDocs, gameDocs, categoryDocs] = await Promise.all([
      Promise.all(
        creatorIds.map((id) =>
          adminDb
            .collection('users')
            .doc(id)
            .get()
            .catch(() => null)
        )
      ),
      Promise.all(
        gameIds.map((id) =>
          adminDb
            .collection('games')
            .doc(id)
            .get()
            .catch(() => null)
        )
      ),
      categoryIds.length > 0
        ? adminDb
            .collection('forum_categories')
            .where('__name__', 'in', categoryIds)
            .get()
            .then((s) => s.docs)
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const userMap = new Map<string, { name: string; avatarUrl?: string | null }>();
    userDocs.forEach((doc) => {
      if (!doc?.exists) return;
      const data = doc.data()!;
      userMap.set(doc.id, {
        name: data.playername || data.displayName || data.email || 'Onbekend',
        avatarUrl: data.avatarUrl || null,
      });
    });

    const gameMap = new Map<string, { name: string; division?: string | null }>();
    gameDocs.forEach((doc) => {
      if (!doc?.exists) return;
      const data = doc.data()!;
      if (data.name) gameMap.set(doc.id, { name: String(data.name), division: data.division || null });
    });

    const categoryMap = new Map<string, string>();
    categoryDocs.forEach((doc) => {
      const data = doc.data();
      if (data?.name) categoryMap.set(doc.id, String(data.name));
    });

    const topics = docs.map((doc) => {
      const data = doc.data();
      const createdBy = String(data.createdBy || '');
      const lastReplyUserId = data.lastReplyUserId ? String(data.lastReplyUserId) : createdBy || null;
      const creatorInfo = userMap.get(createdBy);
      const lastReplyInfo = lastReplyUserId ? userMap.get(lastReplyUserId) : undefined;
      const gameInfo = data.gameId ? gameMap.get(String(data.gameId)) : undefined;
      const categoryName = data.categoryId ? categoryMap.get(String(data.categoryId)) : undefined;

      return {
        id: doc.id,
        categoryId: data.categoryId ?? null,
        categorySlug: data.categorySlug ?? null,
        categoryName: categoryName ?? null,
        gameId: data.gameId ?? null,
        gameName: gameInfo?.name ?? null,
        gameDivision: gameInfo?.division ?? null,
        title: String(data.title || ''),
        body: String(data.body || ''),
        createdBy,
        createdByName: creatorInfo?.name || 'Onbekend',
        createdByAvatarUrl: creatorInfo?.avatarUrl ?? null,
        lastReplyUserId,
        lastReplyUserName: lastReplyInfo?.name || creatorInfo?.name || 'Onbekend',
        lastReplyUserAvatarUrl: lastReplyInfo?.avatarUrl ?? creatorInfo?.avatarUrl ?? null,
        lastReplyPreview: data.lastReplyPreview ?? null,
        createdAt: toIso(data.createdAt) || new Date(0).toISOString(),
        lastReplyAt: toIso(data.lastReplyAt),
        replyCount: data.replyCount ?? 0,
        pinned: data.pinned ?? false,
        status: data.status ?? 'open',
      };
    });

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Error fetching recent forum topics:', error);
    return NextResponse.json({ error: 'Failed to fetch recent topics' }, { status: 500 });
  }
}
