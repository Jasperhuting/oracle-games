import { NextRequest } from 'next/server';
import {
  getJob,
  startJob,
  completeJob,
  failJob,
  updateJobProgress,
} from '@/lib/firebase/job-queue';
import { getStageResult, getRiders, type RaceSlug } from '@/lib/scraper';
import { saveScraperData, type ScraperDataKey } from '@/lib/firebase/scraper-service';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 300; // 5 minutes (Vercel Pro)

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
        await processSingleScrape(jobId, job);
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
      await failJob(jobId, errorMessage);

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

      await saveScraperData(stageKey, stageData);

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
async function processSingleScrape(jobId: string, job: any) {
  const { type, race, year, stage } = job.data as {
    type: 'startlist' | 'stage-result';
    race: string;
    year: number;
    stage?: number;
  };

  await updateJobProgress(jobId, 0, 1, `Scraping ${type}...`);

  let result;

  if (type === 'startlist') {
    result = await getRiders({
      race: race as RaceSlug,
      year,
    });

    const key: ScraperDataKey = {
      race,
      year,
      type: 'startlist',
    };

    await saveScraperData(key, result);
  } else if (type === 'stage-result' && stage) {
    result = await getStageResult({
      race: race as RaceSlug,
      year,
      stage,
    });

    const key: ScraperDataKey = {
      race,
      year,
      type: 'stage',
      stage,
    };

    await saveScraperData(key, result);
  }

  await updateJobProgress(jobId, 1, 1, 'Completed');
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
