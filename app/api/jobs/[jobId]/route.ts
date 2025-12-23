import { NextRequest } from 'next/server';
import { getJob } from '@/lib/firebase/job-queue';

/**
 * GET /api/jobs/[jobId]
 *
 * Get job status and progress (used by polling)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return Response.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const job = await getJob(jobId);

    if (!job) {
      return Response.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return Response.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
