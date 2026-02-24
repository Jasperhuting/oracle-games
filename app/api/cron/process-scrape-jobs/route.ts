import { NextRequest } from 'next/server';
import { getJobs, updateJob } from '@/lib/firebase/job-queue';
import { getServerFirebase } from '@/lib/firebase/server';
import { sendTelegramMessage } from '@/lib/telegram';

const MAX_RUN_MS = 240_000; // keep under maxDuration
const DEFAULT_MAX_JOBS_PER_RUN = 10;
const PER_JOB_TIMEOUT_MS = 270_000;
const STALE_RUNNING_MS = 15 * 60 * 1000;
const PROGRESS_NOTIFY_MIN_INTERVAL_MS = 4 * 60 * 1000;

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
    // Recover scraper jobs that were left in "running" state (e.g. aborted HTTP caller).
    const runningJobs = await getJobs({ type: 'scraper', status: 'running', limit: 200 });
    const now = Date.now();
    let recoveredRunningJobs = 0;

    for (const job of runningJobs) {
      const startedAt = job.startedAt ? Date.parse(job.startedAt) : NaN;
      if (!Number.isFinite(startedAt)) continue;
      if (now - startedAt < STALE_RUNNING_MS) continue;

      await updateJob(job.id, {
        status: 'pending',
        error: `Recovered stale running job on ${new Date(now).toISOString()}`,
      });
      recoveredRunningJobs++;
    }

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

    // Send periodic progress notifications for running batches
    try {
      const db = getServerFirebase();
      const runningBatches = await db
        .collection('scrapeJobBatches')
        .where('status', '==', 'running')
        .limit(10)
        .get();

      const now = Date.now();
      for (const batchDoc of runningBatches.docs) {
        const batch = batchDoc.data() as {
          date?: string;
          totalJobs?: number;
          completedJobs?: number;
          failedJobs?: number;
          outcomes?: string[];
          lastProgressTelegramAt?: string;
        };

        const lastProgressAt = batch.lastProgressTelegramAt ? Date.parse(batch.lastProgressTelegramAt) : NaN;
        if (Number.isFinite(lastProgressAt) && now - lastProgressAt < PROGRESS_NOTIFY_MIN_INTERVAL_MS) {
          continue;
        }

        const totalJobs = typeof batch.totalJobs === 'number' ? batch.totalJobs : 0;
        const completedJobs = typeof batch.completedJobs === 'number' ? batch.completedJobs : 0;
        const failedJobs = typeof batch.failedJobs === 'number' ? batch.failedJobs : 0;
        const remainingJobs = Math.max(0, totalJobs - completedJobs - failedJobs);

        if (totalJobs <= 0 || remainingJobs <= 0) continue;

        const outcomes = Array.isArray(batch.outcomes) ? batch.outcomes : [];
        const recentOutcomes = outcomes.slice(-5);

        const message = [
          `🕛 <b>Daily Race Scrape Progress</b> (${batch.date || ''})`,
          '',
          `🆔 Batch: <code>${batchDoc.id}</code>`,
          `✅ Executed: ${completedJobs}`,
          `❌ Failed: ${failedJobs}`,
          `🕒 Remaining: ${remainingJobs}`,
          `📦 Total: ${totalJobs}`,
          '',
          recentOutcomes.length > 0 ? `Laatste outcomes:\n${recentOutcomes.join('\n')}` : 'Nog geen afgeronde jobs in deze batch.',
          '',
          `🔗 <a href="https://oracle-games.online/admin/jobs">Bekijk jobs</a>`,
        ].join('\n');

        await sendTelegramMessage(message, { parse_mode: 'HTML' });
        await batchDoc.ref.set({
          lastProgressTelegramAt: new Date(now).toISOString(),
        }, { merge: true });
      }
    } catch (error) {
      console.error('[CRON] Failed to send scrape progress update:', error);
    }

    return Response.json({
      success: true,
      recoveredRunningJobs,
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
