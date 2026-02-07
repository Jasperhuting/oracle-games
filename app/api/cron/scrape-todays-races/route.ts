import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getStageResult, getRaceResult } from '@/lib/scraper';
import { saveScraperDataValidated, type ScraperDataKey } from '@/lib/firebase/scraper-service';
import { sendTelegramMessage } from '@/lib/telegram';

const TIME_ZONE = 'Europe/Amsterdam';

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

  try {
    const db = getServerFirebase();
    const racesSnapshot = await db.collection('races').get();

    const outcomes: ScrapeOutcome[] = [];
    const skipped: string[] = [];

    for (const raceDoc of racesSnapshot.docs) {
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
        const key: ScraperDataKey = {
          race: raceSlug,
          year: raceData.year || new Date().getFullYear(),
          type: 'result',
        };

      if (dryRun || notifyOnly) {
        outcomes.push({
          raceSlug,
          raceName,
          type: 'result',
          success: true,
          riderCount: 0,
          message: notifyOnly ? 'NOTIFY-ONLY: skipped scrape (result)' : 'DRY-RUN: would scrape result',
        });
        continue;
      }

        try {
          const result = await getRaceResult({
            race: raceSlug,
            year: key.year,
          });
          const save = await saveScraperDataValidated(key, result);
          const riderCount = 'stageResults' in result ? result.stageResults.length : 0;

          outcomes.push({
            raceSlug,
            raceName,
            type: 'result',
            success: save.success,
            riderCount,
            message: save.success ? 'Scraped result' : (save.error || 'Validation failed'),
          });
        } catch (error) {
          outcomes.push({
            raceSlug,
            raceName,
            type: 'result',
            success: false,
            riderCount: 0,
            message: error instanceof Error ? error.message : 'Scrape failed',
          });
        }
      } else {
        const stageOffset = diffDays(startStr, todayStr);
        const stageNumber = stageOffset + 1;

        const key: ScraperDataKey = {
          race: raceSlug,
          year: raceData.year || new Date().getFullYear(),
          type: 'stage',
          stage: stageNumber,
        };

        if (dryRun || notifyOnly) {
          outcomes.push({
            raceSlug,
            raceName,
            type: 'stage',
            stage: stageNumber,
            success: true,
            riderCount: 0,
            message: notifyOnly ? `NOTIFY-ONLY: skipped scrape (stage ${stageNumber})` : `DRY-RUN: would scrape stage ${stageNumber}`,
          });
          continue;
        }

        try {
          const stageResult = await getStageResult({
            race: raceSlug,
            year: key.year,
            stage: stageNumber,
          });
          const save = await saveScraperDataValidated(key, stageResult);
          const riderCount = 'stageResults' in stageResult ? stageResult.stageResults.length : 0;

          outcomes.push({
            raceSlug,
            raceName,
            type: 'stage',
            stage: stageNumber,
            success: save.success,
            riderCount,
            message: save.success ? `Scraped stage ${stageNumber}` : (save.error || 'Validation failed'),
          });
        } catch (error) {
          outcomes.push({
            raceSlug,
            raceName,
            type: 'stage',
            stage: stageNumber,
            success: false,
            riderCount: 0,
            message: error instanceof Error ? error.message : 'Scrape failed',
          });
        }
      }
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

    if (!dryRun || notifyOnly) {
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
