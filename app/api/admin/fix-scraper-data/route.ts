import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * POST /api/admin/fix-scraper-data
 *
 * Updates a specific field in a scraper-data document
 * Body: { userId, docId, field, value }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, docId, field, value } = await request.json();

    if (!userId || !docId || !field) {
      return NextResponse.json(
        { error: 'userId, docId, and field are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if requesting user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get the scraper-data document
    const scraperDocRef = db.collection('scraper-data').doc(docId);
    const scraperDoc = await scraperDocRef.get();

    if (!scraperDoc.exists) {
      return NextResponse.json(
        { error: `Document ${docId} not found in scraper-data collection` },
        { status: 404 }
      );
    }

    // Update the field
    await scraperDocRef.update({
      [field]: value,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[FIX_SCRAPER_DATA] Updated ${docId}.${field}`);

    return NextResponse.json({
      success: true,
      message: `Updated ${field} in ${docId}`,
      docId,
      field,
    });

  } catch (error) {
    console.error('[FIX_SCRAPER_DATA] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fix scraper data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
