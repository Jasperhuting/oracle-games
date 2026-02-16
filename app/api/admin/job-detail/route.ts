import { NextRequest } from 'next/server';
import { getJob } from '@/lib/firebase/job-queue';

export async function GET(request: NextRequest) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = request.headers.get('authorization');

  if (!authHeader || authHeader !== expectedAuth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');
  if (!jobId) {
    return Response.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  return Response.json({ success: true, job });
}
