import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { createJob } from '@/lib/firebase/job-queue';

const TIME_ZONE = 'Europe/Amsterdam';
const MAX_RUN_MS = 240_000; // keep under maxDuration to avoid timeouts

type ScrapeOutcome = {
  raceSlug: string;
  raceName: string;
  type: 'stage' | 'result';
  stage?: number;
  success: boolean;
  riderCount: number;
  message: string;
};

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

export async function GET(request: NextRequest) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = request.headers.get('authorization');

  if (!authHeader || authHeader !== expectedAuth) {
    console.error('[CRON] Unauthorized access attempt to scrape-todays-races');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const notifyOnly = request.nextUrl.searchParams.get('notifyOnly') === 'true';
  const todayStr = formatDateOnly(new Date());

  const runStartedAt = Date.now();

  try {
    const db = getServerFirebase();
    const batchRef = db.collection('scrapeJobBatches').doc();
    const batchId = batchRef.id;
    const racesSnapshot = await db.collection('races').get();

    const outcomes: ScrapeOutcome[] = [];
    const skipped: string[] = [];
    let queuedJobs = 0;

    for (const raceDoc of racesSnapshot.docs) {
      if (Date.now() - runStartedAt > MAX_RUN_MS) {
        skipped.push('Stopped early due to time budget');
        break;
      }
      const raceData = raceDoc.data();
      const raceSlug = raceData.slug || raceDoc.id;
      const raceName = raceData.name || raceSlug;

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

      if (todayStr < startStr || todayStr > endStr) {
        continue;
      }

      const isSingleDay = !!raceData.isSingleDay || startStr === endStr;

      if (isSingleDay) {
        const year = raceData.year || new Date().getFullYear();
        if (dryRun || notifyOnly) {
          outcomes.push({
            raceSlug,
            raceName,
            type: 'result',
            success: true,
            riderCount: 0,
            message: notifyOnly ? 'NOTIFY-ONLY: skipped scrape (result)' : 'DRY-RUN: would queue result',
          });
          continue;
        }

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
      } else {
        const stageOffset = diffDays(startStr, todayStr);
        const stageNumber = stageOffset + 1;
        const year = raceData.year || new Date().getFullYear();

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
    }

    const successCount = outcomes.filter(o => o.success).length;
    const failedCount = outcomes.filter(o => !o.success).length;

    const summaryLines = outcomes.map((o) => {
      const label = o.type === 'result' ? 'Result' : `Stage ${o.stage}`;
      const status = o.success ? '✅' : '❌';
      const countInfo = o.riderCount > 0 ? ` (${o.riderCount} riders)` : '';
      return `${status} <b>${o.raceName}</b> — ${label}${countInfo}\n${o.message}`;
    });

    const telegramMessage = [
      `🕛 <b>Daily Race Scrape</b> (${todayStr})`,
      '',
      `✅ Success: ${successCount}`,
      `❌ Failed: ${failedCount}`,
      '',
      summaryLines.length > 0 ? summaryLines.join('\n\n') : 'No races scheduled for today.',
      skipped.length > 0 ? `\n\n⚠️ Skipped:\n${skipped.slice(0, 10).join('\n')}` : '',
    ].join('\n');

    if (notifyOnly || dryRun || queuedJobs === 0) {
      await sendTelegramMessage(telegramMessage, { parse_mode: 'HTML' });
    }

    return Response.json({
      success: true,
      date: todayStr,
      dryRun,
      outcomes,
      skipped,
    });
  } catch (error) {
    console.error('[CRON] Error in scrape-todays-races:', error);
    return Response.json(
      { error: 'Failed to scrape today races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
