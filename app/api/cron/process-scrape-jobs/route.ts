import { NextRequest } from 'next/server';
import { getJobs } from '@/lib/firebase/job-queue';

const MAX_RUN_MS = 240_000; // keep under maxDuration
const DEFAULT_MAX_JOBS_PER_RUN = 5;
const PER_JOB_TIMEOUT_MS = 10_000;

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
    const limitParam = request.nextUrl.searchParams.get('limit');
    const requestedLimit = limitParam ? Number(limitParam) : NaN;
    const maxJobs = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(50, Math.floor(requestedLimit))
      : DEFAULT_MAX_JOBS_PER_RUN;

    const pendingJobs = await getJobs({ type: 'scraper', status: 'pending', limit: maxJobs });
    const processed: Array<{ jobId: string; status: number }> = [];

    for (const job of pendingJobs) {
      if (Date.now() - runStartedAt > MAX_RUN_MS) break;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PER_JOB_TIMEOUT_MS);
      try {
        const response = await fetch(
          `${request.nextUrl.origin}/api/jobs/process/${job.id}`,
          { method: 'POST', signal: controller.signal }
        );
        processed.push({ jobId: job.id, status: response.status });
      } catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError';
        processed.push({ jobId: job.id, status: isAbort ? 408 : 500 });
      } finally {
        clearTimeout(timeout);
      }
    }

    return Response.json({
      success: true,
      processedCount: processed.length,
      requestedLimit: maxJobs,
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
