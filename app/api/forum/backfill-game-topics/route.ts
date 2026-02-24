import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

const FORUM_GAMES_CATEGORY = {
  id: 'spellen',
  name: 'Spellen',
  slug: 'spellen',
  order: 2,
};

async function ensureForumCategory(db: FirebaseFirestore.Firestore) {
  const categoryRef = db.collection('forum_categories').doc(FORUM_GAMES_CATEGORY.id);
  const existing = await categoryRef.get();
  if (!existing.exists) {
    await categoryRef.set({
      name: FORUM_GAMES_CATEGORY.name,
      slug: FORUM_GAMES_CATEGORY.slug,
      order: FORUM_GAMES_CATEGORY.order,
      isActive: true,
    });
  }
}

async function ensureGameTopic({
  db,
  gameId,
  gameName,
  createdBy,
}: {
  db: FirebaseFirestore.Firestore;
  gameId: string;
  gameName: string;
  createdBy: string;
}) {
  if (!gameName || gameName.toLowerCase().includes('test')) return false;

  await ensureForumCategory(db);

  const existingSnapshot = await db
    .collection('forum_topics')
    .where('gameId', '==', gameId)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) return false;

  const now = new Date();
  await db.collection('forum_topics').add({
    categoryId: FORUM_GAMES_CATEGORY.id,
    categorySlug: FORUM_GAMES_CATEGORY.slug,
    gameId,
    title: gameName,
    body: `Discussie over ${gameName}.`,
    createdBy,
    createdAt: now,
    updatedAt: now,
    replyCount: 0,
    lastReplyAt: now,
    pinned: false,
    status: 'open',
    deleted: false,
  });

  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { adminUserId } = body || {};

    if (!adminUserId) {
      return NextResponse.json({ error: 'Admin user ID is required' }, { status: 400 });
    }

    const db = getServerFirebase();

    const adminDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const gamesSnapshot = await db.collection('games').get();
    let created = 0;
    let skipped = 0;

    for (const doc of gamesSnapshot.docs) {
      const data = doc.data();
      const name = data.name as string | undefined;
      const isTest = Boolean(data.isTest) || (name ? name.toLowerCase().includes('test') : false);

      if (isTest) {
        skipped += 1;
        continue;
      }

      const createdTopic = await ensureGameTopic({
        db,
        gameId: doc.id,
        gameName: name || doc.id,
        createdBy: adminUserId,
      });

      if (createdTopic) {
        created += 1;
      } else {
        skipped += 1;
      }
    }

    // Backfill previews for existing topics without lastReplyPreview / lastReplyUserId
    const topicsSnapshot = await db.collection('forum_topics').get();
    for (const topicDoc of topicsSnapshot.docs) {
      const data = topicDoc.data();
      if (data.deleted) continue;
      const updates: Record<string, unknown> = {};
      if (!data.lastReplyPreview && data.body) {
        const preview = String(data.body).replace(/<[^>]*>/g, '').trim().slice(0, 140);
        updates.lastReplyPreview = preview || null;
      }
      if (!data.lastReplyUserId && data.createdBy) {
        updates.lastReplyUserId = data.createdBy;
      }
      if (Object.keys(updates).length > 0) {
        await topicDoc.ref.update(updates);
      }
    }

    return NextResponse.json({ success: true, created, skipped });
  } catch (error) {
    console.error('Error backfilling game topics:', error);
    return NextResponse.json({ error: 'Failed to backfill game topics' }, { status: 500 });
  }
}
