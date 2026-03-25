import { NextRequest } from 'next/server';
import {
  getJob,
  claimPendingJob,
  completeJob,
  failJob,
  updateJobProgress,
  updateJob,
} from '@/lib/firebase/job-queue';
import { getStageResult, getRiders, getRaceResult, getTourGCResult, type RaceSlug } from '@/lib/scraper';
import {
  saveScraperDataValidated,
  saveEmptyScraperDataMarker,
  isEmptyScrapeValidationFailure,
  type ScraperDataKey,
} from '@/lib/firebase/scraper-service';
import { getServerFirebase } from '@/lib/firebase/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { cleanFirebaseData } from '@/lib/firebase/utils';
import { classifyScrapeError } from '@/lib/scraper/browserHelper';
import { FieldValue } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 300; // 5 minutes (Vercel Pro)
const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SCRAPER_TIMEOUT_MS = parsePositiveInt(process.env.SCRAPER_TIMEOUT_MS, 90_000);
const MAX_SCRAPE_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;

const logPointsCalculation = async (details: Record<string, unknown>) => {
  try {
    const db = getServerFirebase();
    await db.collection('activityLogs').add({
      action: 'POINTS_CALCULATION',
      details,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('[jobs/process] Failed to log points calculation:', error);
  }
};

const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${SCRAPER_TIMEOUT_MS}ms`)), SCRAPER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
};

/**
 * POST /api/jobs/process/[jobId]
 *
 * Process a job (scraping, team updates, etc.)
 * This endpoint should be called internally or by cron jobs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Verify internal call (required - API key must be present and correct)
    const apiKey = request.headers.get('x-internal-key');
    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await getJob(jobId);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Don't reprocess completed/failed jobs
    if (job.status === 'completed' || job.status === 'failed') {
      return Response.json({
        message: 'Job already processed',
        status: job.status,
      });
    }

    const claimResult = await claimPendingJob(jobId);
    if (!claimResult.job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!claimResult.claimed) {
      return Response.json({
        message: 'Job already being handled',
        status: claimResult.job.status,
      });
    }

    const startTime = Date.now();

    // Log scrape start
    const db = getServerFirebase();
    await db.collection('activityLogs').add({
      action: 'SCRAPE_STARTED',
      userId: 'system',
      details: {
        jobId,
        jobType: job.type,
        ...job.data,
      },
      timestamp: Timestamp.now(),
    });

    try {
      // Process based on job type
      if (job.type === 'bulk-scrape') {
        await processBulkScrape(jobId, job);
      } else if (job.type === 'scraper') {
        const result = await processSingleScrape(jobId, job);
        const safeResult = cleanFirebaseData(result) as ScrapeResult;

        if (!safeResult.success && safeResult.retryable) {
          const retryCount = typeof (job as any).retryCount === 'number' ? (job as any).retryCount : 0;
          if (retryCount < MAX_SCRAPE_RETRIES) {
            const nextRunAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
            await updateJob(jobId, {
              status: 'pending',
              retryCount: retryCount + 1,
              nextRunAt,
              error: safeResult.message,
            } as any);

            return Response.json({
              success: false,
              jobId,
              status: 'pending',
              retryCount: retryCount + 1,
              nextRunAt,
              error: safeResult.message,
              result: safeResult,
            }, { status: 202 });
          }
        }

        if (!safeResult.success) {
          await failJob(jobId, safeResult.message);
          await updateBatchFromJob(job, safeResult, 'failed');
          return Response.json(
            {
              error: safeResult.message,
              jobId,
              status: 'failed',
              result: safeResult,
            },
            { status: 500 }
          );
        }

        await completeJob(jobId, safeResult);
        await updateBatchFromJob(job, safeResult, 'completed');
        return Response.json({
          success: true,
          jobId,
          status: 'completed',
          result: safeResult,
        });
      } else if (job.type === 'team-update') {
        await processTeamUpdate(jobId, job);
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      await completeJob(jobId);

      // Calculate execution time and estimated cost
      const executionTimeMs = Date.now() - startTime;
      const executionTimeSec = executionTimeMs / 1000;
      // Vercel Pro: $0.18 per GB-hour for functions (1GB memory)
      // ~$0.00005 per second for 1GB function, converted to EUR (~0.92 rate)
      const estimatedCostEur = executionTimeSec * 0.00005 * 0.92;

      // Log scrape completion with cost
      await db.collection('activityLogs').add({
        action: 'SCRAPE_COMPLETED',
        userId: 'system',
        details: {
          jobId,
          jobType: job.type,
          ...job.data,
          executionTimeMs,
          executionTimeSec: Math.round(executionTimeSec * 10) / 10,
          estimatedCostEur: Math.round(estimatedCostEur * 100000) / 100000,
        },
        timestamp: Timestamp.now(),
      });

      return Response.json({
        success: true,
        jobId,
        status: 'completed',
        executionTimeMs,
        estimatedCostEur,
      });
    } catch (error) {
      const classifiedError = classifyScrapeError(error);
      const errorMessage = classifiedError.message;
      const shouldRetry = job?.type === 'scraper' && classifiedError.retryable;

      if (job?.type === 'scraper' && classifiedError.category === 'availability') {
        const { race, year, stage, type } = job.data as {
          race: string;
          year: number;
          stage?: number;
          type: 'startlist' | 'stage-result' | 'stage' | 'result' | 'tour-gc';
        };
        const markerType = type === 'stage-result' ? 'stage' : type;

        if (markerType === 'startlist' || markerType === 'stage' || markerType === 'result' || markerType === 'tour-gc') {
          await saveEmptyScraperDataMarker({
            race,
            year,
            type: markerType,
            stage: markerType === 'stage' ? stage : undefined,
          }, errorMessage);
        }

        const emptyResult: ScrapeResult = {
          success: true,
          message: errorMessage,
          riderCount: 0,
          stage,
          resultPreview: [],
          retryable: false,
          failureReason: 'availability',
          errorCategory: classifiedError.category,
        };

        await completeJob(jobId, emptyResult);
        await updateBatchFromJob(job, emptyResult, 'completed');

        return Response.json({
          success: true,
          jobId,
          status: 'completed',
          result: emptyResult,
        });
      }

      if (shouldRetry) {
        const retryCount = typeof (job as any).retryCount === 'number' ? (job as any).retryCount : 0;
        if (retryCount < MAX_SCRAPE_RETRIES) {
          const nextRunAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
          await updateJob(jobId, {
            status: 'pending',
            retryCount: retryCount + 1,
            nextRunAt,
            error: errorMessage,
          } as any);

          return Response.json({
            success: false,
            jobId,
            status: 'pending',
            retryCount: retryCount + 1,
            nextRunAt,
            error: errorMessage,
            errorCategory: classifiedError.category,
          }, { status: 202 });
        }
      }

      await failJob(jobId, errorMessage);
      await updateBatchFromJob(job, { success: false, message: errorMessage }, 'failed');

      // Calculate execution time for failed job
      const executionTimeMs = Date.now() - startTime;

      // Log scrape failure
      await db.collection('activityLogs').add({
        action: 'SCRAPE_FAILED',
        userId: 'system',
        details: {
          jobId,
          jobType: job.type,
          ...job.data,
          executionTimeMs,
          errorMessage,
          errorCategory: classifiedError.category,
          retryable: classifiedError.retryable,
          retryCount: typeof (job as any).retryCount === 'number' ? (job as any).retryCount : 0,
        },
        timestamp: Timestamp.now(),
      });

      return Response.json(
        {
          error: errorMessage,
          jobId,
          status: 'failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing job:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Process bulk scraping job (multiple stages)
 */
async function processBulkScrape(jobId: string, job: any) {
  const { race, year } = job.data as { race: string; year: number };
  const totalStages = (job.data.totalStages as number) || 21;

  for (let stageNum = 1; stageNum <= totalStages; stageNum++) {
    // Update progress
    await updateJobProgress(
      jobId,
      stageNum,
      totalStages,
      `Scraping stage ${stageNum}/${totalStages}`
    );

    try {
      // Scrape stage data
      const stageData = await getStageResult({
        race: race as RaceSlug,
        year,
        stage: stageNum,
      });

      // Save to Firestore
      const stageKey: ScraperDataKey = {
        race,
        year,
        type: 'stage',
        stage: stageNum,
      };

      const save = await saveScraperDataValidated(stageKey, stageData);
      if (!save.success) {
        console.error(`[bulk-scrape] Validation failed for ${race} stage ${stageNum}:`, save.error);
        continue;
      }

      // Trigger points calculation for this stage
      try {
        console.log(`[bulk-scrape] Triggering points calculation for ${race} stage ${stageNum}`);
        const calculatePointsModule = await import('@/app/api/games/calculate-points/route');
        const calculatePoints = calculatePointsModule.POST;
        
        const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
          method: 'POST',
          body: JSON.stringify({
            raceSlug: race,
            stage: stageNum,
            year,
          }),
        });

        const calculatePointsResponse = await calculatePoints(mockRequest);
        const pointsResult = await calculatePointsResponse.json();
        
        if (calculatePointsResponse.status === 200) {
          console.log(`[bulk-scrape] Points calculation completed for stage ${stageNum}:`, pointsResult);
        } else {
          console.error(`[bulk-scrape] Failed to calculate points for stage ${stageNum}:`, pointsResult);
        }
      } catch (error) {
        console.error(`[bulk-scrape] Error calculating points for stage ${stageNum}:`, error);
        // Don't fail the scrape if points calculation fails
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error scraping stage ${stageNum}:`, error);
      // Continue with next stage even if one fails
    }
  }
}

/**
 * Process single scraper job (startlist or single stage)
 */
type ScrapeResult = {
  success: boolean;
  message: string;
  riderCount: number;
  stage?: number;
  resultPreview?: string[];
  retryable?: boolean;
  failureReason?: 'validation' | 'unsupported' | 'resource' | 'navigation' | 'timeout' | 'availability' | 'unknown';
  errorCategory?: 'resource' | 'navigation' | 'timeout' | 'availability' | 'validation' | 'unknown';
};

const getRiderDisplayName = (row: any): string => {
  if (!row || typeof row !== 'object') return 'Unknown';

  if (typeof row.name === 'string' && row.name.trim()) return row.name.trim();
  if (typeof row.rider === 'string' && row.rider.trim()) return row.rider.trim();

  const firstName = typeof row.firstName === 'string' ? row.firstName.trim() : '';
  const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : '';
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;

  if (typeof row.team === 'string' && row.team.trim()) return row.team.trim();
  if (typeof row.shortName === 'string' && row.shortName.trim()) return row.shortName.trim();
  return 'Unknown';
};

const getTopResultsPreview = (data: any, maxRows = 3): string[] => {
  if (!data || !Array.isArray(data.stageResults)) return [];

  return data.stageResults
    .filter((row: any) => row && typeof row.place === 'number' && row.place > 0)
    .sort((a: any, b: any) => a.place - b.place)
    .slice(0, maxRows)
    .map((row: any) => `${row.place}. ${getRiderDisplayName(row)}`);
};

async function processSingleScrape(jobId: string, job: any): Promise<ScrapeResult> {
  const { type, race, year, stage } = job.data as {
    type: 'startlist' | 'stage-result' | 'stage' | 'result' | 'tour-gc';
    race: string;
    year: number;
    stage?: number;
  };

  await updateJobProgress(jobId, 0, 1, `Scraping ${type}...`);

  let result: any;

  if (type === 'startlist') {
    result = await withTimeout(getRiders({
      race: race as RaceSlug,
      year,
    }), `startlist scrape ${race}`);

    const key: ScraperDataKey = {
      race,
      year,
      type: 'startlist',
    };

    const save = await saveScraperDataValidated(key, result);
    await updateJobProgress(jobId, 1, 1, 'Completed');
    if (isEmptyScrapeValidationFailure(save)) {
      return {
        success: true,
        message: 'No startlist available yet',
        riderCount: 0,
      };
    }
    const startlistResult: ScrapeResult = {
      success: save.success,
      message: save.success ? 'Startlist scraped' : (save.error || 'Validation failed'),
      riderCount: 'riders' in result ? result.riders.length : 0,
      retryable: !save.success,
      errorCategory: save.success ? undefined : 'validation',
    };
    if (!save.success) {
      startlistResult.failureReason = 'validation';
    }
    return startlistResult;
  } else if ((type === 'stage-result' || type === 'stage') && stage !== undefined) {
    result = await withTimeout(getStageResult({
      race: race as RaceSlug,
      year,
      stage,
    }), `stage scrape ${race} ${stage}`);

    const key: ScraperDataKey = {
      race,
      year,
      type: 'stage',
      stage,
    };

    const save = await saveScraperDataValidated(key, result);
    await updateJobProgress(jobId, 1, 1, 'Completed');
    if (isEmptyScrapeValidationFailure(save)) {
      return {
        success: true,
        message: `No stage data available yet for stage ${stage}`,
        riderCount: 0,
        stage,
        resultPreview: [],
      };
    }
    if (save.success) {
      try {
        const calculatePointsModule = await import('@/app/api/games/calculate-points/route');
        const calculatePoints = calculatePointsModule.POST;

        const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
          method: 'POST',
          body: JSON.stringify({
            raceSlug: race,
            stage,
            year,
            force: true,
          }),
        });

        const calculatePointsResponse = await calculatePoints(mockRequest);
        const pointsResult = await calculatePointsResponse.json();

        await logPointsCalculation({
          jobId,
          race,
          year,
          stage,
          type: 'stage',
          status: calculatePointsResponse.status,
          success: calculatePointsResponse.status === 200,
          error: calculatePointsResponse.status === 200 ? null : pointsResult?.error || 'Unknown error',
        });

        if (calculatePointsResponse.status === 200) {
          console.log(`[jobs/process] Points calculation completed for ${race} stage ${stage}:`, pointsResult);
        } else {
          console.error(`[jobs/process] Failed to calculate points for ${race} stage ${stage}:`, pointsResult);
        }
      } catch (error) {
        console.error(`[jobs/process] Error calculating points for ${race} stage ${stage}:`, error);
        await logPointsCalculation({
          jobId,
          race,
          year,
          stage,
          type: 'stage',
          status: 500,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    const stageResult: ScrapeResult = {
      success: save.success,
      message: save.success ? `Stage ${stage} scraped` : (save.error || 'Validation failed'),
      riderCount: 'stageResults' in result ? result.stageResults.length : 0,
      stage,
      resultPreview: save.success ? getTopResultsPreview(result) : [],
      retryable: !save.success,
      errorCategory: save.success ? undefined : 'validation',
    };
    if (!save.success) {
      stageResult.failureReason = 'validation';
    }
    return stageResult;
  } else if (type === 'result') {
    result = await withTimeout(getRaceResult({
      race: race as RaceSlug,
      year,
    }), `result scrape ${race}`);

    const key: ScraperDataKey = {
      race,
      year,
      type: 'result',
    };

    const save = await saveScraperDataValidated(key, result);
    await updateJobProgress(jobId, 1, 1, 'Completed');
    if (isEmptyScrapeValidationFailure(save)) {
      return {
        success: true,
        message: 'No race result available yet',
        riderCount: 0,
        resultPreview: [],
      };
    }
    if (save.success) {
      try {
        const calculatePointsModule = await import('@/app/api/games/calculate-points/route');
        const calculatePoints = calculatePointsModule.POST;

        const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
          method: 'POST',
          body: JSON.stringify({
            raceSlug: race,
            stage: 'result',
            year,
            force: true,
          }),
        });

        const calculatePointsResponse = await calculatePoints(mockRequest);
        const pointsResult = await calculatePointsResponse.json();

        await logPointsCalculation({
          jobId,
          race,
          year,
          stage: 'result',
          type: 'result',
          status: calculatePointsResponse.status,
          success: calculatePointsResponse.status === 200,
          error: calculatePointsResponse.status === 200 ? null : pointsResult?.error || 'Unknown error',
        });

        if (calculatePointsResponse.status === 200) {
          console.log(`[jobs/process] Points calculation completed for ${race} result:`, pointsResult);
        } else {
          console.error(`[jobs/process] Failed to calculate points for ${race} result:`, pointsResult);
        }
      } catch (error) {
        console.error(`[jobs/process] Error calculating points for ${race} result:`, error);
        await logPointsCalculation({
          jobId,
          race,
          year,
          stage: 'result',
          type: 'result',
          status: 500,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    const resultResult: ScrapeResult = {
      success: save.success,
      message: save.success ? 'Result scraped' : (save.error || 'Validation failed'),
      riderCount: 'stageResults' in result ? result.stageResults.length : 0,
      resultPreview: save.success ? getTopResultsPreview(result) : [],
      retryable: !save.success,
      errorCategory: save.success ? undefined : 'validation',
    };
    if (!save.success) {
      resultResult.failureReason = 'validation';
    }
    return resultResult;
  } else if (type === 'tour-gc') {
    result = await withTimeout(getTourGCResult({
      race: race as RaceSlug,
      year,
    }), `tour-gc scrape ${race}`);

    const key: ScraperDataKey = {
      race,
      year,
      type: 'tour-gc',
    };

    const save = await saveScraperDataValidated(key, result);
    await updateJobProgress(jobId, 1, 1, 'Completed');
    if (isEmptyScrapeValidationFailure(save)) {
      return {
        success: true,
        message: 'No tour GC available yet',
        riderCount: 0,
        resultPreview: [],
      };
    }
    if (save.success) {
      try {
        const calculatePointsModule = await import('@/app/api/games/calculate-points/route');
        const calculatePoints = calculatePointsModule.POST;

        const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
          method: 'POST',
          body: JSON.stringify({
            raceSlug: race,
            stage: 'tour-gc',
            year,
            force: true,
          }),
        });

        const calculatePointsResponse = await calculatePoints(mockRequest);
        const pointsResult = await calculatePointsResponse.json();

        await logPointsCalculation({
          jobId,
          race,
          year,
          stage: 'tour-gc',
          type: 'tour-gc',
          status: calculatePointsResponse.status,
          success: calculatePointsResponse.status === 200,
          error: calculatePointsResponse.status === 200 ? null : pointsResult?.error || 'Unknown error',
        });
      } catch (error) {
        console.error(`[jobs/process] Error calculating points for ${race} tour-gc:`, error);
        await logPointsCalculation({
          jobId,
          race,
          year,
          stage: 'tour-gc',
          type: 'tour-gc',
          status: 500,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const gcResult: ScrapeResult = {
      success: save.success,
      message: save.success ? 'Tour GC scraped' : (save.error || 'Validation failed'),
      riderCount: Array.isArray(result.generalClassification) ? result.generalClassification.length : 0,
      retryable: !save.success,
      errorCategory: save.success ? undefined : 'validation',
    };
    if (!save.success) {
      gcResult.failureReason = 'validation';
    }
    return gcResult;
  }

  await updateJobProgress(jobId, 1, 1, 'Completed');
  return {
    success: false,
    message: 'Unsupported scrape type',
    riderCount: 0,
    retryable: false,
    failureReason: 'unsupported',
    errorCategory: 'unknown',
  };
}

async function updateBatchFromJob(job: any, result: any, status: 'completed' | 'failed') {
  const batchId = job?.data?.batchId as string | undefined;
  if (!batchId) return;

  const db = getServerFirebase();
  const batchRef = db.collection('scrapeJobBatches').doc(batchId);

  const outcomeLabelParts = [
    result?.success ? '✅' : '❌',
    job?.data?.raceName || job?.data?.race || 'Unknown race',
  ];
  if (job?.data?.type === 'stage' || job?.data?.type === 'stage-result') {
    outcomeLabelParts.push(`Stage ${job?.data?.stage ?? ''}`.trim());
  } else if (job?.data?.type === 'result') {
    outcomeLabelParts.push('Result');
  } else if (job?.data?.type === 'startlist') {
    outcomeLabelParts.push('Startlist');
  }
  const outcomeLabel = outcomeLabelParts.filter(Boolean).join(' — ');
  const resultPreviewText =
    Array.isArray(result?.resultPreview) && result.resultPreview.length > 0
      ? ` | Top: ${result.resultPreview.join(', ')}`
      : '';
  const riderCountText =
    typeof result?.riderCount === 'number' && result.riderCount > 0
      ? ` | Riders: ${result.riderCount}`
      : '';

  await batchRef.set({
    outcomes: FieldValue.arrayUnion(`${outcomeLabel}: ${result?.message || ''}${riderCountText}${resultPreviewText}`.trim()),
    completedJobs: FieldValue.increment(status === 'completed' ? 1 : 0),
    failedJobs: FieldValue.increment(status === 'failed' ? 1 : 0),
  }, { merge: true });

  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) return;

  const batch = batchSnap.data() as any;
  const totalJobs = Number.isFinite(Number(batch.totalJobs)) ? Number(batch.totalJobs) : 0;
  const completed = Number.isFinite(Number(batch.completedJobs)) ? Number(batch.completedJobs) : 0;
  const failed = Number.isFinite(Number(batch.failedJobs)) ? Number(batch.failedJobs) : 0;
  const done = totalJobs > 0 && completed + failed >= totalJobs;

  if (done && !batch.telegramSent) {
    if (completed <= 0 && failed <= 0) {
      await batchRef.set({
        status: 'completed',
        telegramSent: true,
        completedAt: new Date().toISOString(),
      }, { merge: true });
      return;
    }

    const lines: string[] = Array.isArray(batch.outcomes) ? batch.outcomes : [];
    const message = [
      `🕛 <b>Daily Race Scrape Completed</b> (${batch.date || ''})`,
      '',
      `✅ Executed: ${completed}`,
      `❌ Failed: ${failed}`,
      '',
      lines.slice(0, 40).join('\n'),
      '',
      `🔗 <a href="https://oracle-games.online/admin/jobs">Bekijk jobs</a>`,
    ].join('\n');

    await sendTelegramMessage(message, { parse_mode: 'HTML' });

    await batchRef.set({
      status: 'completed',
      telegramSent: true,
      completedAt: new Date().toISOString(),
    }, { merge: true });
  }
}

/**
 * Process team update job
 */
async function processTeamUpdate(jobId: string, job: any) {
  const { year, teamName } = job.data as { year: number; teamName: string };

  // Stage 1: Fetch team data
  await updateJobProgress(jobId, 1, 4, 'fetching-team');

  // Simulate team fetching (replace with actual implementation)
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Stage 2: Update team data
  await updateJobProgress(jobId, 2, 4, 'update-team');
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Stage 3: Fetch riders data
  await updateJobProgress(jobId, 3, 4, 'fetching-riders');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Stage 4: Update riders data
  await updateJobProgress(jobId, 4, 4, 'update-riders');
  await new Promise((resolve) => setTimeout(resolve, 500));
}
