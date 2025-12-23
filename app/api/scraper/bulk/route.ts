import { NextRequest } from 'next/server';
import { createJob } from '@/lib/firebase/job-queue';

export async function POST(request: NextRequest) {
  try {
    const { race, year, totalStages = 21 } = await request.json();

    if (!race || !year) {
      return Response.json(
        { error: 'Missing required fields: race, year' },
        { status: 400 }
      );
    }

    // Create job in Firestore
    const jobId = await createJob({
      type: 'bulk-scrape',
      status: 'pending',
      priority: 5,
      progress: {
        current: 0,
        total: totalStages,
        percentage: 0,
      },
      data: {
        race,
        year: Number(year),
        totalStages,
      },
    });

    // Trigger background processing
    // We'll call the process endpoint asynchronously (fire and forget)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3210';

    fetch(`${baseUrl}/api/jobs/process/${jobId}`, {
      method: 'POST',
      headers: {
        'x-internal-key': process.env.INTERNAL_API_KEY || 'dev-key',
      },
    }).catch((error) => {
      console.error('Failed to trigger job processing:', error);
    });

    return Response.json({
      success: true,
      jobId,
      message: 'Bulk scraping job started',
      totalStages,
      checkStatusUrl: `/api/jobs/${jobId}`,
    });
  } catch (_error) {
    return Response.json(
      {
        error: _error instanceof Error ? _error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');

  if (jobId) {
    // Redirect to new job endpoint
    return Response.redirect(`/api/jobs/${jobId}`);
  }

  return Response.json({
    message: 'Use /api/jobs/{jobId} to check job status',
  });
}