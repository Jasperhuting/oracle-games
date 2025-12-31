import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const body = await request.json();
    const { content, title } = body;

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    if (content === undefined) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // TODO: Add authentication check here to ensure only admins can edit pages
    // For now, we'll proceed without authentication

    const pageData = {
      title: title || pageId,
      content,
      updatedAt: Timestamp.now(),
      // When you add authentication, add: updatedBy: userId
    };

    await adminDb.collection('pages').doc(pageId).set(pageData, { merge: true });

    return NextResponse.json({
      success: true,
      id: pageId,
      title: pageData.title,
      content: pageData.content,
      updatedAt: pageData.updatedAt.toDate().toISOString(),
    });
  } catch (error) {
    console.error('Error saving page:', error);
    return NextResponse.json(
      { error: 'Failed to save page' },
      { status: 500 }
    );
  }
}
