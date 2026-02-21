import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId as string | undefined;
    const jobId = body.jobId as string | undefined;

    if (!userId || !jobId) {
      return NextResponse.json(
        { error: 'User ID and job ID are required' },
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

    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const jobData = jobSnap.data() as any;
    const total = jobData?.progress?.total ?? 1;

    await jobRef.update({
      status: 'pending',
      startedAt: null,
      completedAt: null,
      error: null,
      nextRunAt: null,
      progress: {
        current: 0,
        total,
        percentage: 0,
      },
    });

    const processUrl = new URL(`/api/jobs/process/${jobId}`, request.nextUrl.origin);
    const headers: Record<string, string> = {};
    if (process.env.INTERNAL_API_KEY) {
      headers['x-internal-key'] = process.env.INTERNAL_API_KEY;
    }

    const response = await fetch(processUrl.toString(), {
      method: 'POST',
      headers,
    });

    const result = await response.json().catch(() => ({}));
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      result,
    }, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error('Error retrying job:', error);
    return NextResponse.json(
      { error: 'Failed to retry job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
