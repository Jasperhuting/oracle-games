import { NextRequest } from 'next/server';
import { getJobs, updateJob } from '@/lib/firebase/job-queue';
import { getServerFirebase } from '@/lib/firebase/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { createHash } from 'crypto';

const MAX_RUN_MS = 240_000; // keep under maxDuration
const DEFAULT_MAX_JOBS_PER_RUN = 10;
const PER_JOB_TIMEOUT_MS = 270_000;
const STALE_RUNNING_MS = 15 * 60 * 1000;
const PROGRESS_NOTIFY_MIN_INTERVAL_MS = 4 * 60 * 1000;
const TIME_ZONE = 'Europe/Amsterdam';
const CRON_ALERT_DEDUP_COLLECTION = 'cronAlertState';

const truncate = (value: string, max = 1200): string =>
  value.length > max ? `${value.slice(0, max)}...` : value;

const sendCronFailureAlert = async (context: {
  endpoint: string;
  message: string;
  details?: string;
}) => {
  const db = getServerFirebase();
  const dedupKey = createHash('sha256').update(context.endpoint).digest('hex');
  const fingerprint = createHash('sha256')
    .update(`${context.endpoint}\n${context.message}\n${context.details || ''}`)
    .digest('hex');

  const dedupRef = db.collection(CRON_ALERT_DEDUP_COLLECTION).doc(dedupKey);
  const dedupSnapshot = await dedupRef.get();
  const lastFingerprint = dedupSnapshot.data()?.lastFingerprint as string | undefined;

  if (lastFingerprint === fingerprint) {
    await dedupRef.set(
      {
        endpoint: context.endpoint,
        lastFingerprint: fingerprint,
        duplicateCount: (dedupSnapshot.data()?.duplicateCount || 0) + 1,
        lastDuplicateAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return;
  }

  const telegramMessage = [
    `🚨 <b>Cron Failure</b>`,
    ``,
    `🔗 <b>Endpoint:</b> ${context.endpoint}`,
    `❌ <b>Issue:</b> ${context.message}`,
    context.details ? `📋 <b>Details:</b>\n<code>${truncate(context.details)}</code>` : '',
    `⏰ ${new Date().toLocaleString('nl-NL', { timeZone: TIME_ZONE })}`,
  ].filter(Boolean).join('\n');

  const sent = await sendTelegramMessage(telegramMessage, { parse_mode: 'HTML' });
  if (sent) {
    await dedupRef.set(
      {
        endpoint: context.endpoint,
        lastFingerprint: fingerprint,
        duplicateCount: 0,
        lastSentAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
};

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
    const processed: Array<{ jobId: string; status: number; error?: string }> = [];

    for (const job of pendingJobs) {
      if (Date.now() - runStartedAt > MAX_RUN_MS) break;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PER_JOB_TIMEOUT_MS);
      try {
        const headers: HeadersInit = {};
        if (process.env.INTERNAL_API_KEY) {
          headers['x-internal-key'] = process.env.INTERNAL_API_KEY;
        }
        if (process.env.CRON_SECRET) {
          headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
        }

        const response = await fetch(
          `${request.nextUrl.origin}/api/jobs/process/${job.id}`,
          { method: 'POST', signal: controller.signal, headers }
        );

        if (!response.ok) {
          const responseBody = await response.text().catch(() => '');
          processed.push({
            jobId: job.id,
            status: response.status,
            error: truncate(responseBody || `HTTP ${response.status}`, 250),
          });
        } else {
          processed.push({ jobId: job.id, status: response.status });
        }
      } catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError';
        processed.push({ jobId: job.id, status: isAbort ? 408 : 500 });
      } finally {
        clearTimeout(timeout);
      }
    }

    const failedProcessedJobs = processed.filter((entry) => entry.status >= 400);
    if (failedProcessedJobs.length > 0) {
      await sendCronFailureAlert({
        endpoint: '/api/cron/process-scrape-jobs',
        message: `${failedProcessedJobs.length} job(s) returned error status`,
        details: failedProcessedJobs
          .map((entry) => `jobId=${entry.jobId}, status=${entry.status}${entry.error ? `, error=${entry.error}` : ''}`)
          .join('\n'),
      });
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
          lastNotifiedCompletedJobs?: number;
          lastNotifiedFailedJobs?: number;
        };

        const lastProgressAt = batch.lastProgressTelegramAt ? Date.parse(batch.lastProgressTelegramAt) : NaN;
        if (Number.isFinite(lastProgressAt) && now - lastProgressAt < PROGRESS_NOTIFY_MIN_INTERVAL_MS) {
          continue;
        }

        const totalJobs = Number.isFinite(Number(batch.totalJobs)) ? Number(batch.totalJobs) : 0;
        const completedJobs = Number.isFinite(Number(batch.completedJobs)) ? Number(batch.completedJobs) : 0;
        const failedJobs = Number.isFinite(Number(batch.failedJobs)) ? Number(batch.failedJobs) : 0;
        const lastNotifiedCompletedJobs = Number.isFinite(Number(batch.lastNotifiedCompletedJobs)) ? Number(batch.lastNotifiedCompletedJobs) : 0;
        const lastNotifiedFailedJobs = Number.isFinite(Number(batch.lastNotifiedFailedJobs)) ? Number(batch.lastNotifiedFailedJobs) : 0;
        const resolvedJobs = completedJobs + failedJobs;
        const remainingJobs = Math.max(0, totalJobs - completedJobs - failedJobs);

        // Only notify on real progress (executed/failed increased since last Telegram update).
        const hasNewCompleted = completedJobs > lastNotifiedCompletedJobs;
        const hasNewFailed = failedJobs > lastNotifiedFailedJobs;

        if (!hasNewCompleted && !hasNewFailed) continue;
        if (completedJobs <= 0 && failedJobs <= 0) continue;
        if (totalJobs <= 0 || remainingJobs <= 0 || resolvedJobs <= 0) continue;

        const outcomes = Array.isArray(batch.outcomes) ? batch.outcomes : [];
        const recentOutcomes = outcomes.slice(-5);

        const message = [
          `🕛 <b>Daily Race Scrape Progress</b> (${batch.date || ''})`,
          '',
          `🆔 Batch: <code>${batchDoc.id}</code>`,
          `✅ Executed: ${completedJobs}`,
          `❌ Failed: ${failedJobs}`,
          '',
          recentOutcomes.length > 0 ? `Laatste outcomes:\n${recentOutcomes.join('\n')}` : 'Nog geen outcomes beschikbaar.',
          '',
          `🔗 <a href="https://oracle-games.online/admin/jobs">Bekijk jobs</a>`,
        ].join('\n');

        await sendTelegramMessage(message, { parse_mode: 'HTML' });
        await batchDoc.ref.set({
          lastProgressTelegramAt: new Date(now).toISOString(),
          lastNotifiedCompletedJobs: completedJobs,
          lastNotifiedFailedJobs: failedJobs,
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
    await sendCronFailureAlert({
      endpoint: '/api/cron/process-scrape-jobs',
      message: 'Unhandled exception',
      details: error instanceof Error ? `${error.message}\n${error.stack || ''}` : 'Unknown error',
    });
    return Response.json(
      { error: 'Failed to process scrape jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
