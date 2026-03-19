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
const TELEGRAM_BUFFER_COLLECTION = 'telegramBuffer';
const TELEGRAM_BUFFER_DOC = 'scrapeNotifications';

/** Returns the current hour (0-23) in Amsterdam time. */
function getAmsterdamHour(): number {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: TIME_ZONE, hour: '2-digit', hour12: false }),
    10,
  );
}

const truncate = (value: string, max = 1200): string =>
  value.length > max ? `${value.slice(0, max)}...` : value;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    context.details ? `📋 <b>Details:</b>\n<code>${escapeHtml(truncate(context.details))}</code>` : '',
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
  const internalKeyHeader = request.headers.get('x-internal-key');

  const hasValidBearer =
    !!process.env.CRON_SECRET && !!authHeader && authHeader === expectedAuth;
  const hasValidVercelCronHeader = vercelCronHeader === '1';
  const hasValidInternalKey =
    !!process.env.INTERNAL_API_KEY &&
    !!internalKeyHeader &&
    internalKeyHeader === process.env.INTERNAL_API_KEY;

  const isAuthorized = hasValidBearer || hasValidVercelCronHeader || hasValidInternalKey;

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
        if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
          headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
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

    // Send Telegram notification — buffer during quiet hours (before 09:00 Amsterdam),
    // flush buffer on first daytime run.
    try {
      const db = getServerFirebase();
      const bufferRef = db.collection(TELEGRAM_BUFFER_COLLECTION).doc(TELEGRAM_BUFFER_DOC);
      const isQuiet = getAmsterdamHour() < 9;

      // Build lines for current run (may be empty if no jobs were processed)
      const buildLines = () =>
        pendingJobs
          .map(job => {
            const result = processed.find(p => p.jobId === job.id);
            if (!result) return null;
            const ok = result.status < 400;
            const dataType = job.data?.type as string | undefined;
            const label =
              dataType === 'result' ? 'Result' :
              dataType === 'tour-gc' ? 'Tour GC' :
              `Stage ${job.data?.stage ?? '?'}`;
            const name = (job.data?.raceName as string | undefined) || (job.data?.race as string | undefined) || '?';
            const icon = ok ? '✅' : '❌';
            return `${icon} <b>${name}</b> — ${label}${result.error ? `\n   <code>${result.error.slice(0, 120)}</code>` : ''}`;
          })
          .filter((l): l is string => l !== null);

      if (isQuiet) {
        // Night: buffer results (only when jobs were actually processed)
        if (processed.length > 0) {
          const currentLines = buildLines();
          const existing = (await bufferRef.get()).data() ?? {};
          await bufferRef.set({
            lines: [...((existing.lines as string[]) ?? []), ...currentLines],
            successCount: ((existing.successCount as number) ?? 0) + processed.filter(p => p.status < 400).length,
            failCount: ((existing.failCount as number) ?? 0) + processed.filter(p => p.status >= 400).length,
            bufferedSince: (existing.bufferedSince as string) ?? new Date().toISOString(),
            lastBufferedAt: new Date().toISOString(),
          });
        }
      } else {
        // Day: check for buffered night results and combine with current run
        const bufferSnap = await bufferRef.get();
        const buffer = bufferSnap.exists ? bufferSnap.data()! : null;
        const hasBuffer = !!(buffer && ((buffer.lines as string[])?.length > 0 || (buffer.successCount as number) > 0));

        const currentLines = processed.length > 0 ? buildLines() : [];
        const currentSuccess = processed.filter(p => p.status < 400).length;
        const currentFail = processed.filter(p => p.status >= 400).length;

        const allLines = hasBuffer ? [...((buffer!.lines as string[]) ?? []), ...currentLines] : currentLines;
        const allSuccess = currentSuccess + (hasBuffer ? ((buffer!.successCount as number) ?? 0) : 0);
        const allFail = currentFail + (hasBuffer ? ((buffer!.failCount as number) ?? 0) : 0);

        // Send if there is anything to report (new jobs or buffered night results)
        if (allLines.length > 0 || allSuccess > 0 || allFail > 0) {
          const title = hasBuffer && currentLines.length === 0
            ? `🌅 <b>Nacht Scrape Overzicht</b>`
            : hasBuffer
              ? `🌅 <b>Scrape Overzicht (inclusief nacht)</b>`
              : `🔄 <b>Scrape Jobs Verwerkt</b>`;

          const message = [
            title,
            '',
            `✅ Geslaagd: ${allSuccess}`,
            allFail > 0 ? `❌ Mislukt: ${allFail}` : null,
            hasBuffer
              ? `📦 Nacht: ${new Date(buffer!.bufferedSince as string).toLocaleString('nl-NL', { timeZone: TIME_ZONE })} → ${new Date(buffer!.lastBufferedAt as string).toLocaleString('nl-NL', { timeZone: TIME_ZONE })}`
              : null,
            '',
            ...allLines.slice(0, 20),
            allLines.length > 20 ? `<i>...en ${allLines.length - 20} meer</i>` : null,
            '',
            `⏰ ${new Date().toLocaleString('nl-NL', { timeZone: TIME_ZONE })}`,
          ].filter((l): l is string => l !== null).join('\n');

          await sendTelegramMessage(message, { parse_mode: 'HTML' });

          if (hasBuffer) {
            await bufferRef.delete();
          }
        }
      }
    } catch (telegramError) {
      console.error('[CRON] Failed to send Telegram notification:', telegramError);
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
