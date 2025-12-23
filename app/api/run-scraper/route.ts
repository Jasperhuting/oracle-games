import { NextRequest } from 'next/server';
import { KNOWN_RACE_SLUGS } from '@/lib/scraper';
import { createJob } from '@/lib/firebase/job-queue';

// Use races from the scraper module
const RACES = KNOWN_RACE_SLUGS;

export async function POST(request: NextRequest) {
  try {
    const { type, race, stage, year = new Date().getFullYear() } = await request.json();

    // Validation
    if (!type || !race) {
      return Response.json(
        { error: 'Missing required fields: type, race' },
        { status: 400 }
      );
    }

    if (!['startlist', 'stage-result'].includes(type)) {
      return Response.json(
        { error: 'Invalid type. Must be "startlist" or "stage-result"' },
        { status: 400 }
      );
    }

    if (!RACES.includes(race)) {
      return Response.json(
        { error: `Invalid race. Must be one of: ${RACES.join(', ')}` },
        { status: 400 }
      );
    }

    if (type === 'stage-result' && !stage) {
      return Response.json(
        { error: 'Stage number required for stage-result type' },
        { status: 400 }
      );
    }

    // Create job in Firestore
    const jobId = await createJob({
      type: 'scraper',
      status: 'pending',
      priority: 3,
      progress: {
        current: 0,
        total: 1,
        percentage: 0,
      },
      data: {
        type,
        race,
        stage,
        year: Number(year),
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

    return Response.json({
      jobId,
      message: 'Scraper job started',
      status: 'pending',
      checkStatusUrl: `/api/jobs/${jobId}`,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
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

  // Return available options
  return Response.json({
    message: 'Use POST to create a scraper job, then check /api/jobs/{jobId} for status',
    availableRaces: RACES,
    availableTypes: ['startlist', 'stage-result'],
  });
}

