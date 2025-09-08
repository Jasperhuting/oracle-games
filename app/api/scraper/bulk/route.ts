import { NextRequest } from 'next/server';
import { getStageResult, type RaceSlug } from '@/lib/scraper';
import { saveScraperData, type ScraperDataKey } from '@/lib/firebase/scraper-service';

// In-memory storage for progress tracking (use Redis in production)
const bulkJobs = new Map<string, BulkScrapingJob>();

interface BulkScrapingJob {
  id: string;
  race: string;
  year: number;
  totalStages: number;
  status: 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results: Array<{
    stage: number;
    success: boolean;
    dataCount?: number;
    error?: string;
  }>;
  errors: Array<{
    stage: number;
    error: string;
  }>;
  startedAt: string;
  completedAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { race, year } = await request.json();

    if (!race || !year) {
      return Response.json({ 
        error: 'Missing required fields: race, year' 
      }, { status: 400 });
    }

    // Create job
    const jobId = `bulk-${race}-${year}-${Date.now()}`;
    const job: BulkScrapingJob = {
      id: jobId,
      race,
      year: Number(year),
      totalStages: 21,
      status: 'running',
      progress: {
        current: 0,
        total: 21,
        percentage: 0,
      },
      results: [],
      errors: [],
      startedAt: new Date().toISOString(),
    };

    bulkJobs.set(jobId, job);

    // Start background scraping
    scrapeAllStagesBackground(job);

    return Response.json({
      success: true,
      jobId,
      message: 'Bulk scraping job started',
      totalStages: 21,
      checkStatusUrl: `/api/scraper/bulk/${jobId}`,
    });

  } catch (error) {
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');

  if (jobId) {
    const job = bulkJobs.get(jobId);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    return Response.json(job);
  }

  // Return all jobs
  return Response.json({
    jobs: Array.from(bulkJobs.values()),
  });
}

async function scrapeAllStagesBackground(job: BulkScrapingJob) {
  try {
    for (let stageNum = 1; stageNum <= job.totalStages; stageNum++) {
      // Update progress
      job.progress.current = stageNum;
      job.progress.percentage = Math.round((stageNum / job.totalStages) * 100);
      bulkJobs.set(job.id, job);

      try {
        const stageData = await getStageResult({
          race: job.race as RaceSlug,
          year: job.year,
          stage: stageNum
        });

        const stageKey: ScraperDataKey = {
          race: job.race,
          year: job.year,
          type: 'stage',
          stage: stageNum,
        };

        await saveScraperData(stageKey, stageData);
        
        const stageCount = 'stageResults' in stageData ? stageData.stageResults.length : 0;
        
        job.results.push({
          stage: stageNum,
          success: true,
          dataCount: stageCount
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        job.errors.push({ stage: stageNum, error: errorMsg });
        job.results.push({
          stage: stageNum,
          success: false,
          error: errorMsg
        });
      }

      // Update job in map
      bulkJobs.set(job.id, job);
    }

    // Mark job as completed
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.progress.percentage = 100;
    bulkJobs.set(job.id, job);

  } catch (error) {
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    bulkJobs.set(job.id, job);
  }
}