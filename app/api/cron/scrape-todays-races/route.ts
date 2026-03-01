import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { createJob } from '@/lib/firebase/job-queue';
import { generateDocumentId, type ScraperDataKey } from '@/lib/firebase/scraper-service';

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

// Classifications to exclude (youth, U23, women categories)
const UNWANTED_CLASSIFICATIONS = ['MJ', 'MU', 'WJ', 'WU', 'WE', 'WWT'];

const WOMEN_NAME_KEYWORDS = [
  'WOMEN',
  'WOMAN',
  'FEMINA',
  'FEMINAS',
  'FEMENINA',
  'FEMENINO',
  'FEMME',
  'FEMMES',
  'DAMES',
  'LADIES',
  'FEMALE',
];

// Race slugs to explicitly exclude (women's races with incorrect classification, etc.)
const EXCLUDED_RACE_SLUGS: Set<string> = new Set([
  'vuelta-el-salvador',
  'trofeo-felanitx-femina',
  'grand-prix-el-salvador',
  'grand-prix-san-salvador',
  'trofeo-palma-femina',
  'trofeo-binissalem-andratx',
  'race-torquay',
  'grand-prix-de-oriente',
  'pionera-race-we',
]);

/**
 * Check if a race should be excluded based on classification, name, or slug
 * Mirrors the logic from /api/admin/race-status
 */
function shouldExcludeRace(name: string, classification: string | null, slug?: string): boolean {
  if (slug && EXCLUDED_RACE_SLUGS.has(slug)) {
    return true;
  }

  const cls = (classification || '').trim();
  const nameUpper = name.toUpperCase();
  const clsUpper = cls.toUpperCase();
  const slugUpper = (slug || '').toUpperCase();

  const hasUnwantedInName = UNWANTED_CLASSIFICATIONS.some(
    unwanted => nameUpper.includes(unwanted) || nameUpper.includes(`${unwanted} -`)
  );

  const hasUnwantedInClassification = UNWANTED_CLASSIFICATIONS.some(
    unwanted => clsUpper.includes(unwanted)
  );

  const hasWomenInName = WOMEN_NAME_KEYWORDS.some(keyword => nameUpper.includes(keyword));
  const hasWomenInSlug = WOMEN_NAME_KEYWORDS.some(keyword => slugUpper.includes(keyword));
  const hasWWTInClassification = clsUpper.includes('WWT');

  return (
    hasUnwantedInName ||
    hasUnwantedInClassification ||
    hasWomenInName ||
    hasWomenInSlug ||
    hasWWTInClassification
  );
}

const formatDateOnly = (date: Date): string =>
  date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

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

const addDays = (dateStr: string, days: number): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  return formatDateOnly(new Date(utc));
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

const sendCronFailureAlert = async (context: {
  endpoint: string;
  message: string;
  details?: string;
  batchId?: string;
}) => {
  const telegramMessage = [
    `🚨 <b>Cron Failure</b>`,
    ``,
    `🔗 <b>Endpoint:</b> ${context.endpoint}`,
    `❌ <b>Issue:</b> ${context.message}`,
    context.batchId ? `🆔 <b>Batch:</b> <code>${context.batchId}</code>` : '',
    context.details ? `📋 <b>Details:</b>\n<code>${truncate(context.details)}</code>` : '',
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

  return stageResults.length > 0 || generalClassification.length > 0 || count > 0;
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
  const targetDates = [0, 1, 2].map((offsetDays) =>
    formatDateOnly(new Date(Date.now() - offsetDays * 86400000))
  );

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

      if (shouldExcludeRace(raceName, classification, raceSlug)) {
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
      if (endStr < windowStart || startStr > windowEnd) {
        continue;
      }

      const isSingleDay = !!raceData.isSingleDay || startStr === endStr;

      if (isSingleDay) {
        const year = raceData.year || new Date().getFullYear();
        if (targetDates.some(dateStr => dateStr >= startStr && dateStr <= endStr)) {
          const alreadyScraped = await hasExistingScrape(db, {
            race: raceSlug,
            year,
            type: 'result',
          });
          if (alreadyScraped) {
            skipped.push(`${raceSlug} (result already scraped)`);
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

          const stageOffset = diffDays(startStr, targetDate);
          const stageNumber = stageOffset + 1;

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

        const dayAfterEnd = addDays(endStr, 1);
        if (targetDates.includes(dayAfterEnd)) {
          const alreadyScraped = await hasExistingScrape(db, {
            race: raceSlug,
            year,
            type: 'tour-gc',
          });
          if (alreadyScraped) {
            skipped.push(`${raceSlug} (tour-gc already scraped)`);
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
          const processUrl = new URL('/api/cron/process-scrape-jobs', request.nextUrl.origin);
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
      `🧹 Excluded slugs: ${EXCLUDED_RACE_SLUGS.size}`,
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
