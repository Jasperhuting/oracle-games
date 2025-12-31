import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { deleteExpiredJobs } from '@/lib/firebase/job-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute

/**
 * Cron job to clean up expired jobs from Firestore
 * Runs daily at 2 AM
 */
export async function GET(request: NextRequest) {
  try {
    // Verify Vercel Cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('[CRON] Unauthorized access attempt to cleanup-expired-jobs');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting expired jobs cleanup...');

    const deletedCount = await deleteExpiredJobs();

    console.log(`[CRON] Cleanup completed. Deleted ${deletedCount} expired jobs.`);

    return Response.json({
      success: true,
      timestamp: Timestamp.now(),
      deletedCount,
    });
  } catch (error) {
    console.error('[CRON] Error in cleanup-expired-jobs:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Timestamp.now(),
      },
      { status: 500 }
    );
  }
}
