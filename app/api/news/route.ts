import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/server';
import { normalizeNewsInput, serializeNewsItem, sortNewsItems } from '@/lib/news';
import { NewsItem, NewsUpsertInput } from '@/lib/types/news';

export const dynamic = 'force-dynamic';

async function verifyAdminUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const userDoc = await adminDb.collection('users').doc(userId).get();
  return userDoc.exists && userDoc.data()?.userType === 'admin';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts = searchParams.get('includeDrafts') === 'true';
    const userId = searchParams.get('userId');

    if (includeDrafts) {
      const isAdmin = await verifyAdminUser(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
      }
    }

    const snapshot = await adminDb.collection('newsItems').get();
    const items = snapshot.docs.map((doc) => serializeNewsItem(doc.id, doc.data()));
    const filteredItems = includeDrafts ? items : items.filter((item) => item.status === 'published');

    return NextResponse.json({ items: sortNewsItems(filteredItems) satisfies NewsItem[] });
  } catch (error) {
    console.error('[NEWS] Failed to fetch items:', error);
    return NextResponse.json({ error: 'Failed to fetch news items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isAdmin = await verifyAdminUser(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const body = (await request.json()) as NewsUpsertInput;
    const normalized = normalizeNewsInput(body);
    const now = Timestamp.now();
    const docRef = adminDb.collection('newsItems').doc();

    await docRef.set({
      ...normalized,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    });

    return NextResponse.json({
      success: true,
      item: serializeNewsItem(docRef.id, {
        ...normalized,
        viewCount: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      }),
    });
  } catch (error) {
    console.error('[NEWS] Failed to create item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create news item' },
      { status: 500 }
    );
  }
}
