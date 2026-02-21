import { NextRequest } from 'next/server';
import {
  getJob,
  startJob,
  completeJob,
  failJob,
  updateJobProgress,
  updateJob,
} from '@/lib/firebase/job-queue';
import { getStageResult, getRiders, getRaceResult, type RaceSlug } from '@/lib/scraper';
import { saveScraperDataValidated, type ScraperDataKey } from '@/lib/firebase/scraper-service';
import { getServerFirebase } from '@/lib/firebase/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { cleanFirebaseData } from '@/lib/firebase/utils';
import { FieldValue } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 300; // 5 minutes (Vercel Pro)
const SCRAPER_TIMEOUT_MS = 25_000;
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

    // Verify internal call (optional - use API key for security)
    const apiKey = request.headers.get('x-internal-key');
    if (apiKey && apiKey !== process.env.INTERNAL_API_KEY) {
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

    // Start the job
    await startJob(jobId);
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const isTimeout = typeof errorMessage === 'string' && errorMessage.includes('timed out after');
      if (isTimeout && job?.type === 'scraper') {
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
  retryable?: boolean;
  failureReason?: 'validation' | 'unsupported';
};

async function processSingleScrape(jobId: string, job: any): Promise<ScrapeResult> {
  const { type, race, year, stage } = job.data as {
    type: 'startlist' | 'stage-result' | 'stage' | 'result';
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
    const startlistResult: ScrapeResult = {
      success: save.success,
      message: save.success ? 'Startlist scraped' : (save.error || 'Validation failed'),
      riderCount: 'riders' in result ? result.riders.length : 0,
      retryable: !save.success,
    };
    if (!save.success) {
      startlistResult.failureReason = 'validation';
    }
    return startlistResult;
  } else if ((type === 'stage-result' || type === 'stage') && stage) {
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
      retryable: !save.success,
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
      retryable: !save.success,
    };
    if (!save.success) {
      resultResult.failureReason = 'validation';
    }
    return resultResult;
  }

  await updateJobProgress(jobId, 1, 1, 'Completed');
  return { success: false, message: 'Unsupported scrape type', riderCount: 0, retryable: false, failureReason: 'unsupported' };
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

  await batchRef.set({
    outcomes: FieldValue.arrayUnion(`${outcomeLabel}: ${result?.message || ''}`.trim()),
    completedJobs: FieldValue.increment(status === 'completed' ? 1 : 0),
    failedJobs: FieldValue.increment(status === 'failed' ? 1 : 0),
  }, { merge: true });

  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) return;

  const batch = batchSnap.data() as any;
  const totalJobs = batch.totalJobs || 0;
  const completed = batch.completedJobs || 0;
  const failed = batch.failedJobs || 0;
  const done = totalJobs > 0 && completed + failed >= totalJobs;

  if (done && !batch.telegramSent) {
    const lines: string[] = Array.isArray(batch.outcomes) ? batch.outcomes : [];
    const message = [
      `🕛 <b>Daily Race Scrape Completed</b> (${batch.date || ''})`,
      '',
      `✅ Success: ${completed}`,
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
