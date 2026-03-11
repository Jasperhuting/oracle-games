import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ newsId: string }> }
) {
  try {
    const { newsId } = await params;
    const docRef = adminDb.collection('newsItems').doc(newsId);
    const existingDoc = await docRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 });
    }

    if (existingDoc.data()?.status !== 'published') {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 });
    }

    await docRef.set({ viewCount: FieldValue.increment(1) }, { merge: true });
    const updatedDoc = await docRef.get();

    return NextResponse.json({
      success: true,
      viewCount: typeof updatedDoc.data()?.viewCount === 'number' ? updatedDoc.data()?.viewCount : 0,
    });
  } catch (error) {
    console.error('[NEWS] Failed to track view:', error);
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
  }
}
