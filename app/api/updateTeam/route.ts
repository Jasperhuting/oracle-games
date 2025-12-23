import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/firebase/job-queue';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, teamName } = body;

    if (!year || !teamName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: year, teamName',
        },
        { status: 400 }
      );
    }

    // Create job in Firestore
    const jobId = await createJob({
      type: 'team-update',
      status: 'pending',
      priority: 2,
      progress: {
        current: 0,
        total: 4,
        percentage: 0,
      },
      data: {
        year: Number(year),
        teamName,
      },
    });

    // Trigger background processing
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

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Team update job started',
    });
  } catch (error) {
    console.error('Error creating team update job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}