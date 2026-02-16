import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = request.headers.get('authorization');

  if (!authHeader || authHeader !== expectedAuth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerFirebase();
    const snapshot = await db.collection('jobs').get();
    const jobs = snapshot.docs.map(doc => doc.data() as { id: string; type: string; status: string; createdAt?: string });

    const scraperJobs = jobs.filter(j => j.type === 'scraper');
    const counts = scraperJobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    const pendingIds = scraperJobs
      .filter(j => j.status === 'pending')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 20)
      .map(j => j.id);

    return Response.json({
      success: true,
      total: jobs.length,
      scraperTotal: scraperJobs.length,
      statusCounts: counts,
      pendingSample: pendingIds,
    });
  } catch (error) {
    return Response.json(
      { error: 'Failed to load jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
