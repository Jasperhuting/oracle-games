import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { createJob } from '@/lib/firebase/job-queue';
import { generateDocumentId, type ScraperDataKey } from '@/lib/firebase/scraper-service';
import { shouldExcludeRace } from '@/lib/utils/race-filters';
import { formatDateOnlyInAmsterdam, getCompletedRaceDates } from '@/lib/utils/scrape-window';

const TIME_ZONE = 'Europe/Amsterdam';
const MAX_RUN_MS = 240_000; // keep under maxDuration to avoid timeouts

type ScrapeOutcome = {
  raceSlug: string;
  raceName: string;
  type: 'stage' | 'result' | 'tour-gc';
  stage?: number;
  success: boolean;
  riderCount: number;
  message: string;
};

const formatDateOnly = (date: Date): string => formatDateOnlyInAmsterdam(date);

const parseDateOnly = (dateStr: string): string | null => {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateOnly(parsed);
};

const diffDays = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.floor((toUtc - fromUtc) / 86400000);
};


const parseMaybeJsonArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const truncate = (value: string, max = 1200): string =>
  value.length > max ? `${value.slice(0, max)}...` : value;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sendCronFailureAlert = async (context: {
  endpoint: string;
  message: string;
  details?: string;
  batchId?: string;
}) => {
  const safeDetails = context.details ? escapeHtml(truncate(context.details)) : null;
  const telegramMessage = [
    `🚨 <b>Cron Failure</b>`,
    ``,
    `🔗 <b>Endpoint:</b> ${context.endpoint}`,
    `❌ <b>Issue:</b> ${context.message}`,
    context.batchId ? `🆔 <b>Batch:</b> <code>${context.batchId}</code>` : '',
    safeDetails ? `📋 <b>Details:</b>\n<code>${safeDetails}</code>` : '',
    `⏰ ${new Date().toLocaleString('nl-NL', { timeZone: TIME_ZONE })}`,
  ].filter(Boolean).join('\n');

  await sendTelegramMessage(telegramMessage, { parse_mode: 'HTML' });
};

async function hasExistingScrape(db: ReturnType<typeof getServerFirebase>, key: ScraperDataKey): Promise<boolean> {
  const docId = generateDocumentId(key);
  const doc = await db.collection('scraper-data').doc(docId).get();

  if (!doc.exists) return false;
  const data = doc.data();
  if (!data) return false;

  const stageResults = parseMaybeJsonArray(data.stageResults);
  const generalClassification = parseMaybeJsonArray(data.generalClassification);
  const count = typeof data.count === 'number' ? data.count : 0;

  if (stageResults.length > 0 || generalClassification.length > 0 || count > 0) return true;

  // Empty marker saved when race had no results yet — skip re-queuing for 6 hours
  // to avoid hammering PCS every hour. After 6 hours, allow one retry.
  if (data._empty === true && data.updatedAt) {
    const updatedAt = new Date(data.updatedAt as string).getTime();
    return Date.now() - updatedAt < 6 * 60 * 60 * 1000;
  }

  return false;
}

/** Returns true if there's already a pending or running scraper job for this race/type/stage. */
async function hasPendingJob(
  db: ReturnType<typeof getServerFirebase>,
  race: string,
  year: number,
  type: string,
  stage?: number,
): Promise<boolean> {
  let query = db.collection('jobs')
    .where('type', '==', 'scraper')
    .where('data.race', '==', race)
    .where('data.year', '==', year)
    .where('data.type', '==', type) as FirebaseFirestore.Query;

  if (stage !== undefined) {
    query = query.where('data.stage', '==', stage);
  }

  const pendingSnap = await query.where('status', 'in', ['pending', 'running']).limit(1).get();
  return !pendingSnap.empty;
}

function isFatalScrapeFailure(error: string | undefined): boolean {
  if (!error) return false;

  return (
    error.includes('ScrapingBee error 401') ||
    error.includes('ScrapingBee error 402') ||
    error.includes('ScrapingBee error 403') ||
    error.includes('Monthly API calls limit reached') ||
    error.includes('Invalid API key') ||
    error.includes('invalid api key')
  );
}

async function hasRecentFatalFailedJob(
  db: ReturnType<typeof getServerFirebase>,
  race: string,
  year: number,
  type: string,
  stage?: number,
): Promise<boolean> {
  let query = db.collection('jobs')
    .where('type', '==', 'scraper')
    .where('status', '==', 'failed')
    .where('data.race', '==', race)
    .where('data.year', '==', year)
    .where('data.type', '==', type) as FirebaseFirestore.Query;

  if (stage !== undefined) {
    query = query.where('data.stage', '==', stage);
  }

  const failedSnap = await query.limit(5).get();
  return failedSnap.docs.some((doc) => {
    const data = doc.data() as { error?: string; completedAt?: string };
    if (!isFatalScrapeFailure(data.error)) return false;

    const completedAtMs = data.completedAt ? Date.parse(data.completedAt) : NaN;
    return !Number.isFinite(completedAtMs) || Date.now() - completedAtMs < 24 * 60 * 60 * 1000;
  });
}

export async function GET(request: NextRequest) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');

  const isAuthorized = (authHeader && authHeader === expectedAuth) || vercelCronHeader === '1';

  if (!isAuthorized) {
    console.error('[CRON] Unauthorized access attempt to scrape-todays-races');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const notifyOnly = request.nextUrl.searchParams.get('notifyOnly') === 'true';
  const todayStr = formatDateOnly(new Date());
  const todayYear = Number(todayStr.split('-')[0]);
  const targetDates = getCompletedRaceDates(new Date(), 3);

  // Current time in Amsterdam (HH:MM) for scrapeAfter comparisons
  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const nowHH = nowParts.find(p => p.type === 'hour')?.value ?? '00';
  const nowAmsterdam = `${nowHH}:${nowParts.find(p => p.type === 'minute')?.value ?? '00'}`;
  // The midnight run (00:xx Amsterdam) triggers a one-time nightly re-scrape for scrapeAfter races
  const isMidnightRun = parseInt(nowHH, 10) === 0;

  const runStartedAt = Date.now();

  try {
    const db = getServerFirebase();
    const batchRef = db.collection('scrapeJobBatches').doc();
    const batchId = batchRef.id;
    let racesSnapshot = await db.collection('races').where('year', '==', todayYear).get();
    if (racesSnapshot.empty) {
      racesSnapshot = await db.collection('races').get();
    }

    const outcomes: ScrapeOutcome[] = [];
    const skipped: string[] = [];
    let queuedJobs = 0;
    let excludedByFlag = 0;
    let stoppedEarly = false;

    for (const raceDoc of racesSnapshot.docs) {
      if (Date.now() - runStartedAt > MAX_RUN_MS) {
        stoppedEarly = true;
        skipped.push('Stopped early due to time budget');
        break;
      }
      const raceData = raceDoc.data();
      const raceSlug = raceData.slug || raceDoc.id;
      const raceName = raceData.name || raceSlug;
      const classification = raceData.classification || null;

      const excludeFromScraping = raceData.excludeFromScraping === true;
      if (shouldExcludeRace(raceName, classification, raceSlug, excludeFromScraping)) {
        if (excludeFromScraping) excludedByFlag++;
        skipped.push(`${raceSlug} (excluded by filters)`);
        continue;
      }

      const startDateRaw = raceData.startDate;
      const endDateRaw = raceData.endDate || raceData.startDate;

      if (!startDateRaw) {
        skipped.push(`${raceSlug} (missing startDate)`);
        continue;
      }

      const startStr = parseDateOnly(startDateRaw);
      const endStr = parseDateOnly(endDateRaw);

      if (!startStr || !endStr) {
        skipped.push(`${raceSlug} (invalid date)`);
        continue;
      }

      const windowStart = targetDates[targetDates.length - 1];
      const windowEnd = targetDates[0];
      const isToday = startStr === todayStr && endStr === todayStr;
      const isInPastWindow = endStr >= windowStart && startStr <= windowEnd;

      if (!isToday && !isInPastWindow) {
        continue;
      }

      const isSingleDay = raceData.isSingleDay === true || startStr === endStr;
      const hasPrologue = raceData.hasPrologue === true;

      if (isSingleDay) {
        const year = raceData.year || new Date().getFullYear();

        // For today's races: only proceed if scrapeAfter time has been reached
        if (isToday) {
          const scrapeAfter: string = raceData.scrapeAfter || '';
          if (!scrapeAfter || nowAmsterdam < scrapeAfter) {
            skipped.push(`${raceSlug} (today, scrapeAfter ${scrapeAfter || 'not set'}, now ${nowAmsterdam})`);
            continue;
          }
        }

        if (isToday || targetDates.some(dateStr => dateStr >= startStr && dateStr <= endStr)) {
          const alreadyScraped = await hasExistingScrape(db, {
            race: raceSlug,
            year,
            type: 'result',
          });
          // For scrapeAfter races: re-scrape once at midnight for safety / late result changes.
          // For all other races: skip if already done.
          const allowNightlyRescrape = !!raceData.scrapeAfter && !isToday && isMidnightRun;
          if (alreadyScraped && !allowNightlyRescrape) {
            skipped.push(`${raceSlug} (result already scraped)`);
            continue;
          }
          if (!dryRun && !notifyOnly && await hasPendingJob(db, raceSlug, year, 'result')) {
            skipped.push(`${raceSlug} (result job already queued)`);
            continue;
          }
          if (!dryRun && !notifyOnly && await hasRecentFatalFailedJob(db, raceSlug, year, 'result')) {
            skipped.push(`${raceSlug} (recent fatal result failure, not re-queuing)`);
            continue;
          }
          if (dryRun || notifyOnly) {
            outcomes.push({
              raceSlug,
              raceName,
              type: 'result',
              success: true,
              riderCount: 0,
              message: notifyOnly ? 'NOTIFY-ONLY: skipped scrape (result)' : 'DRY-RUN: would queue result',
            });
          } else {
            await createJob({
              type: 'scraper',
              status: 'pending',
              priority: 1,
              progress: { current: 0, total: 1, percentage: 0 },
              data: {
                type: 'result',
                race: raceSlug,
                year,
                batchId,
                raceName,
              },
            });
            queuedJobs++;
            outcomes.push({
              raceSlug,
              raceName,
              type: 'result',
              success: true,
              riderCount: 0,
              message: 'Queued result scrape',
            });
          }
        }
      } else {
        const year = raceData.year || new Date().getFullYear();

        for (const targetDate of targetDates) {
          if (Date.now() - runStartedAt > MAX_RUN_MS) {
            stoppedEarly = true;
            skipped.push('Stopped early due to time budget');
            break;
          }

          if (targetDate < startStr || targetDate > endStr) {
            continue;
          }

          // Primary: look up exact stage date in 'stages' subcollection
          let stageNumberOrNull: number | null = null;
          const stagesSubSnap = await raceDoc.ref.collection('stages').get();
          for (const stageDoc of stagesSubSnap.docs) {
            const stageData = stageDoc.data();
            const rawDate: string =
              stageData.date ?? stageData.stageDate ?? stageData.raceDate ?? stageData.startDate ?? '';
            const stageDate = rawDate ? parseDateOnly(rawDate) : null;
            if (stageDate === targetDate && typeof stageData.stage === 'number') {
              stageNumberOrNull = stageData.stage as number;
              break;
            }
          }

          // Fallback: date-offset formula with prologue awareness
          const stageNumber = stageNumberOrNull !== null
            ? stageNumberOrNull
            : (hasPrologue ? diffDays(startStr, targetDate) : diffDays(startStr, targetDate) + 1);

          const alreadyScraped = await hasExistingScrape(db, {
            race: raceSlug,
            year,
            type: 'stage',
            stage: stageNumber,
          });
          if (alreadyScraped) {
            skipped.push(`${raceSlug} (stage ${stageNumber} already scraped)`);
            continue;
          }
          if (!dryRun && !notifyOnly && await hasPendingJob(db, raceSlug, year, 'stage', stageNumber)) {
            skipped.push(`${raceSlug} (stage ${stageNumber} job already queued)`);
            continue;
          }
          if (!dryRun && !notifyOnly && await hasRecentFatalFailedJob(db, raceSlug, year, 'stage', stageNumber)) {
            skipped.push(`${raceSlug} (stage ${stageNumber} recent fatal failure, not re-queuing)`);
            continue;
          }

          if (dryRun || notifyOnly) {
            outcomes.push({
              raceSlug,
              raceName,
              type: 'stage',
              stage: stageNumber,
              success: true,
              riderCount: 0,
              message: notifyOnly ? `NOTIFY-ONLY: skipped scrape (stage ${stageNumber})` : `DRY-RUN: would queue stage ${stageNumber}`,
            });
            continue;
          }

          await createJob({
            type: 'scraper',
            status: 'pending',
            priority: 1,
            progress: { current: 0, total: 1, percentage: 0 },
            data: {
              type: 'stage',
              race: raceSlug,
              year,
              stage: stageNumber,
              batchId,
              raceName,
            },
          });
          queuedJobs++;
          outcomes.push({
            raceSlug,
            raceName,
            type: 'stage',
            stage: stageNumber,
            success: true,
            riderCount: 0,
            message: `Queued stage ${stageNumber} scrape`,
          });
        }
        if (stoppedEarly) {
          break;
        }

        if (targetDates.includes(endStr)) {
          const alreadyScraped = await hasExistingScrape(db, {
            race: raceSlug,
            year,
            type: 'tour-gc',
          });
          if (alreadyScraped) {
            skipped.push(`${raceSlug} (tour-gc already scraped)`);
            continue;
          }
          if (!dryRun && !notifyOnly && await hasPendingJob(db, raceSlug, year, 'tour-gc')) {
            skipped.push(`${raceSlug} (tour-gc job already queued)`);
            continue;
          }
          if (dryRun || notifyOnly) {
            outcomes.push({
              raceSlug,
              raceName,
              type: 'tour-gc',
              success: true,
              riderCount: 0,
              message: notifyOnly ? 'NOTIFY-ONLY: skipped scrape (tour-gc)' : 'DRY-RUN: would queue tour-gc',
            });
            continue;
          }

          await createJob({
            type: 'scraper',
            status: 'pending',
            priority: 1,
            progress: { current: 0, total: 1, percentage: 0 },
            data: {
              type: 'tour-gc',
              race: raceSlug,
              year,
              batchId,
              raceName,
            },
          });
          queuedJobs++;
          outcomes.push({
            raceSlug,
            raceName,
            type: 'tour-gc',
            success: true,
            riderCount: 0,
            message: 'Queued tour-gc scrape',
          });
        }
      }
    }

    if (!dryRun && !notifyOnly) {
      await batchRef.set({
        id: batchId,
        createdAt: new Date().toISOString(),
        date: todayStr,
        totalJobs: queuedJobs,
        completedJobs: 0,
        failedJobs: 0,
        status: queuedJobs > 0 ? 'running' : 'completed',
        outcomes: [],
        telegramSent: false,
      });

      if (queuedJobs > 0) {
        try {
          // Use the production URL to avoid Vercel SSO protection on deployment-specific URLs.
          // VERCEL_PROJECT_PRODUCTION_URL is set automatically by Vercel on all deployments.
          const baseOrigin =
            process.env.APP_URL ||
            (process.env.VERCEL_PROJECT_PRODUCTION_URL
              ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
              : null) ||
            request.nextUrl.origin;
          const processUrl = new URL('/api/cron/process-scrape-jobs', baseOrigin);
          processUrl.searchParams.set('limit', '20');
          const headers: HeadersInit = {};
          if (process.env.INTERNAL_API_KEY) {
            headers['x-internal-key'] = process.env.INTERNAL_API_KEY;
          }
          if (process.env.CRON_SECRET) {
            headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
          } else {
            // Fallback for environments without CRON_SECRET so queue processing is still attempted.
            headers['x-vercel-cron'] = '1';
          }

          const processResponse = await fetch(processUrl.toString(), {
            method: 'GET',
            headers,
          });

          if (!processResponse.ok) {
            const errorText = await processResponse.text();
            console.error('[CRON] process-scrape-jobs trigger failed:', processResponse.status, errorText);
            await sendCronFailureAlert({
              endpoint: '/api/cron/scrape-todays-races',
              message: `process-scrape-jobs trigger failed (${processResponse.status})`,
              details: errorText,
              batchId,
            });
          }
        } catch (error) {
          console.error('[CRON] Failed to trigger process-scrape-jobs:', error);
          await sendCronFailureAlert({
            endpoint: '/api/cron/scrape-todays-races',
            message: 'Failed to trigger process-scrape-jobs',
            details: error instanceof Error ? error.message : 'Unknown error',
            batchId,
          });
        }
      }
    }

    const totalFound = outcomes.length;

    const summaryLines = outcomes.map((o) => {
      const label = o.type === 'result' ? 'Result' : o.type === 'tour-gc' ? 'Tour GC' : `Stage ${o.stage}`;
      const status = o.success ? '🕒' : '❌';
      const countInfo = o.riderCount > 0 ? ` (${o.riderCount} riders)` : '';
      return `${status} <b>${o.raceName}</b> — ${label}${countInfo}\n${o.message}`;
    });

    const elapsedMs = Date.now() - runStartedAt;
    const elapsedSeconds = Math.round(elapsedMs / 1000);
    const skippedCount = skipped.length;
    const alreadyScraped = skipped.filter((entry) => entry.includes('already scraped'));
    const otherSkipped = skipped.filter((entry) => !entry.includes('already scraped'));
    const shownSkipped = [...alreadyScraped, ...otherSkipped].slice(0, 10);
    const skippedSummary =
      skippedCount > 0
        ? `\n\n⚠️ Skipped (${skippedCount}):\n${shownSkipped.join('\n')}${skippedCount > shownSkipped.length ? '\n…' : ''}`
        : '';

    const shouldSendTelegramSummary =
      summaryLines.length > 0 || queuedJobs > 0 || stoppedEarly;

    if (!shouldSendTelegramSummary) {
      return Response.json({
        success: true,
        date: todayStr,
        dryRun,
        stoppedEarly,
        outcomes,
        skipped,
        telegramSkipped: true,
      });
    }

    const telegramMessage = [
      `🕛 <b>Daily Race Scrape Queue</b> (${todayStr})`,
      '',
      `ℹ️ Dit bericht toont wat in de queue is gezet, niet wat al klaar is.`,
      `🆔 Batch: <code>${dryRun || notifyOnly ? 'n/a' : batchId}</code>`,
      `📋 Gevonden: ${totalFound}`,
      `📦 Jobs aangemaakt: ${queuedJobs}`,
      `🏃 Uitgevoerd nu: 0`,
      `⏱️ Duration: ${elapsedSeconds}s`,
      `🧭 Window: ${targetDates[targetDates.length - 1]} → ${targetDates[0]}`,
      `🧾 Te verwerken: ${summaryLines.length}`,
      `🧹 Uitgesloten via vlag: ${excludedByFlag}`,
      '',
      summaryLines.length > 0 ? summaryLines.join('\n\n') : 'No races scheduled for today.',
      skippedSummary,
      stoppedEarly ? '\n\n⚠️ Stopped early due to time budget.' : '',
    ].join('\n');

    await sendTelegramMessage(telegramMessage, { parse_mode: 'HTML' });

    return Response.json({
      success: true,
      date: todayStr,
      dryRun,
      stoppedEarly,
      outcomes,
      skipped,
    });
  } catch (error) {
    console.error('[CRON] Error in scrape-todays-races:', error);
    await sendCronFailureAlert({
      endpoint: '/api/cron/scrape-todays-races',
      message: 'Unhandled exception',
      details: error instanceof Error ? `${error.message}\n${error.stack || ''}` : 'Unknown error',
    });
    return Response.json(
      { error: 'Failed to scrape today races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
