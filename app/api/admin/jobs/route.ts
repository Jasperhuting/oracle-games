import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const jobsSnapshot = await db
      .collection('jobs')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const batchesSnapshot = await db
      .collection('scrapeJobBatches')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const jobs = jobsSnapshot.docs.map((doc) => doc.data());
    const batches = batchesSnapshot.docs.map((doc) => doc.data());

    return NextResponse.json({ success: true, jobs, batches });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
