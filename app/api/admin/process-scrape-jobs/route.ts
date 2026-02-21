import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId as string | undefined;
    const limit = typeof body.limit === 'number' ? body.limit : undefined;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    if (!process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured' },
        { status: 500 }
      );
    }

    const processUrl = new URL('/api/cron/process-scrape-jobs', request.nextUrl.origin);
    if (limit && Number.isFinite(limit) && limit > 0) {
      processUrl.searchParams.set('limit', Math.min(50, Math.floor(limit)).toString());
    }

    const response = await fetch(processUrl.toString(), {
      method: 'GET',
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const result = await response.json().catch(() => ({}));
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      result,
    }, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error('Error triggering process-scrape-jobs:', error);
    return NextResponse.json(
      { error: 'Failed to trigger process-scrape-jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
