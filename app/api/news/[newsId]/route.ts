import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/server';
import { normalizeNewsInput, serializeNewsItem } from '@/lib/news';
import { NewsUpsertInput } from '@/lib/types/news';

export const dynamic = 'force-dynamic';

async function verifyAdminUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const userDoc = await adminDb.collection('users').doc(userId).get();
  return userDoc.exists && userDoc.data()?.userType === 'admin';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  try {
    const { newsId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const doc = await adminDb.collection('newsItems').doc(newsId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 });
    }

    const item = serializeNewsItem(doc.id, doc.data());
    if (item.status !== 'published') {
      const isAdmin = await verifyAdminUser(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'News item not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('[NEWS] Failed to fetch item:', error);
    return NextResponse.json({ error: 'Failed to fetch news item' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  try {
    const { newsId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isAdmin = await verifyAdminUser(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const docRef = adminDb.collection('newsItems').doc(newsId);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 });
    }

    const body = (await request.json()) as NewsUpsertInput;
    const normalized = normalizeNewsInput(body);
    const updateData = {
      ...normalized,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    await docRef.set(updateData, { merge: true });

    const savedDoc = await docRef.get();
    return NextResponse.json({
      success: true,
      item: serializeNewsItem(savedDoc.id, savedDoc.data()),
    });
  } catch (error) {
    console.error('[NEWS] Failed to update item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update news item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  try {
    const { newsId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isAdmin = await verifyAdminUser(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    await adminDb.collection('newsItems').doc(newsId).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NEWS] Failed to delete item:', error);
    return NextResponse.json({ error: 'Failed to delete news item' }, { status: 500 });
  }
}
