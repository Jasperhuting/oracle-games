import { NextRequest } from 'next/server';
import { getRiders, getStageResult, KNOWN_RACE_SLUGS, type RaceSlug } from '@/lib/scraper';

interface ScraperJob {
  id: string;
  type: 'startlist' | 'stage-result';
  race: string;
  stage?: number;
  year?: number;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  output?: string;
  error?: string;
}

// In-memory job storage (use Redis/database in production)
const jobs = new Map<string, ScraperJob>();

// Use races from the scraper module
const RACES = KNOWN_RACE_SLUGS;

export async function POST(request: NextRequest) {
  try {
    const { type, race, stage, year = new Date().getFullYear() } = await request.json();

    // Validation
    if (!type || !race) {
      return Response.json({ error: 'Missing required fields: type, race' }, { status: 400 });
    }

    if (!['startlist', 'stage-result'].includes(type)) {
      return Response.json({ error: 'Invalid type. Must be "startlist" or "stage-result"' }, { status: 400 });
    }

    if (!RACES.includes(race)) {
      return Response.json({ error: `Invalid race. Must be one of: ${RACES.join(', ')}` }, { status: 400 });
    }

    if (type === 'stage-result' && !stage) {
      return Response.json({ error: 'Stage number required for stage-result type' }, { status: 400 });
    }

    // Create job
    const jobId = `${type}-${race}-${stage || 'startlist'}-${Date.now()}`;
    const job: ScraperJob = {
      id: jobId,
      type,
      race,
      stage,
      year,
      status: 'running',
      startTime: new Date().toISOString()
    };

    jobs.set(jobId, job);

    // Start scraper in background
    runScraperJob(job);

    return Response.json({ 
      jobId,
      message: 'Scraper job started',
      status: 'running',
      checkStatusUrl: `/api/run-scraper/${jobId}`
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
    const job = jobs.get(jobId);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    return Response.json(job);
  }

  // Return all jobs
  return Response.json({
    jobs: Array.from(jobs.values()),
    availableRaces: RACES,
    availableTypes: ['startlist', 'stage-result']
  });
}

async function runScraperJob(job: ScraperJob) {
  try {
    let result;

    if (job.type === 'startlist') {
      result = await getRiders({ 
        race: job.race as RaceSlug, 
        year: job.year || new Date().getFullYear() 
      });
    } else {
      result = await getStageResult({ 
        race: job.race as RaceSlug, 
        year: job.year || new Date().getFullYear(), 
        stage: job.stage! 
      });
    }
    
    // Update job status
    const updatedJob = jobs.get(job.id);
    if (updatedJob) {
      updatedJob.status = 'completed';
      updatedJob.endTime = new Date().toISOString();
      updatedJob.output = JSON.stringify(result, null, 2);
      jobs.set(job.id, updatedJob);
    }

    // Note: commitAndPush functionality removed since we're using internal scrapers now
    // This was for committing to the external scraper repo

  } catch (error) {
    const updatedJob = jobs.get(job.id);
    if (updatedJob) {
      updatedJob.status = 'failed';
      updatedJob.endTime = new Date().toISOString();
      updatedJob.error = error instanceof Error ? error.message : 'Unknown error';
      jobs.set(job.id, updatedJob);
    }
  }
}

