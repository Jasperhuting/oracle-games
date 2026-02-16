import { NextRequest } from 'next/server';
import { getJobs } from '@/lib/firebase/job-queue';

const MAX_RUN_MS = 240_000; // keep under maxDuration
const MAX_JOBS_PER_RUN = 20;

export async function GET(request: NextRequest) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');

  const isAuthorized = (authHeader && authHeader === expectedAuth) || vercelCronHeader === '1';

  if (!isAuthorized) {
    console.error('[CRON] Unauthorized access attempt to process-scrape-jobs');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runStartedAt = Date.now();

  try {
    const pendingJobs = await getJobs({ type: 'scraper', status: 'pending', limit: MAX_JOBS_PER_RUN });
    const processed: Array<{ jobId: string; status: number }> = [];

    for (const job of pendingJobs) {
      if (Date.now() - runStartedAt > MAX_RUN_MS) break;

      const response = await fetch(
        `${request.nextUrl.origin}/api/jobs/process/${job.id}`,
        { method: 'POST' }
      );

      processed.push({ jobId: job.id, status: response.status });
    }

    return Response.json({
      success: true,
      processedCount: processed.length,
      processed,
    });
  } catch (error) {
    console.error('[CRON] Error in process-scrape-jobs:', error);
    return Response.json(
      { error: 'Failed to process scrape jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
