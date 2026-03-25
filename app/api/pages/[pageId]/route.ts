import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminHandler, ApiError } from '@/lib/api/handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    const pageDoc = await adminDb.collection('pages').doc(pageId).get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { content: '', title: pageId },
        { status: 200 }
      );
    }

    const pageData = pageDoc.data();
    return NextResponse.json({
      id: pageId,
      title: pageData?.title || pageId,
      content: pageData?.content || '',
      updatedAt: pageData?.updatedAt?.toDate?.()?.toISOString() || pageData?.updatedAt || null,
      updatedBy: pageData?.updatedBy || null,
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page' },
      { status: 500 }
    );
  }
}

export const POST = adminHandler('save-page', async ({ uid, request, params }) => {
  const { pageId } = params;
  const { content, title } = await request.json();

  if (content === undefined) throw new ApiError('Content is required', 400);

  await adminDb.collection('pages').doc(pageId).set({
    title: title || pageId,
    content,
    updatedAt: Timestamp.now(),
    updatedBy: uid,
  }, { merge: true });

  return { success: true, id: pageId, title: title || pageId, content };
});
