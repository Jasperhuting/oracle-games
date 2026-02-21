import { adminDb as db } from './server';

export interface Job {
  id: string;
  type: 'scraper' | 'team-update' | 'bulk-scrape';
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number; // 1 = highest
  progress: {
    current: number;
    total: number;
    percentage: number;
    stage?: string;
  };
  data: Record<string, unknown>;
  result?: unknown;
  error?: string;
  retryCount?: number;
  nextRunAt?: string; // ISO, for backoff scheduling
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt: string; // Auto-delete after 24h
}

const JOBS_COLLECTION = 'jobs';

/**
 * Create a new job in Firestore
 */
export async function createJob(
  job: Omit<Job, 'id' | 'createdAt' | 'expiresAt'>
): Promise<string> {
  const jobRef = db.collection(JOBS_COLLECTION).doc();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h from now

  const newJob: Job = {
    ...job,
    id: jobRef.id,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await jobRef.set(newJob);
  return jobRef.id;
}

/**
 * Get a job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const doc = await db.collection(JOBS_COLLECTION).doc(jobId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as Job;
}

/**
 * Update a job with partial data
 */
export async function updateJob(
  jobId: string,
  updates: Partial<Omit<Job, 'id'>>
): Promise<void> {
  await db.collection(JOBS_COLLECTION).doc(jobId).update(updates);
}

/**
 * Update job progress (convenience method)
 */
export async function updateJobProgress(
  jobId: string,
  current: number,
  total: number,
  stage?: string
): Promise<void> {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  await updateJob(jobId, {
    progress: {
      current,
      total,
      percentage,
      stage,
    },
  });
}

/**
 * Mark job as running
 */
export async function startJob(jobId: string): Promise<void> {
  await updateJob(jobId, {
    status: 'running',
    startedAt: new Date().toISOString(),
  });
}

/**
 * Mark job as completed with optional result
 */
export async function completeJob(jobId: string, result?: unknown): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const { cleanFirebaseData } = await import('./utils');
  const safeResult = result !== undefined ? cleanFirebaseData(result) : undefined;

  await updateJob(jobId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    progress: {
      current: job.progress.total,
      total: job.progress.total,
      percentage: 100,
    },
    result: safeResult,
  });
}

/**
 * Mark job as failed with error message
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  await updateJob(jobId, {
    status: 'failed',
    completedAt: new Date().toISOString(),
    error,
  });
}

/**
 * Get all jobs (with optional filters)
 */
export async function getJobs(filters?: {
  type?: Job['type'];
  status?: Job['status'];
  limit?: number;
}): Promise<Job[]> {
  let query: import('@google-cloud/firestore').Query = db.collection(JOBS_COLLECTION);
  const HARD_LIMIT = 500;
  const nowIso = new Date().toISOString();

  if (filters?.type) {
    query = query.where('type', '==', filters.type);
  }

  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  }

  const snapshot = await query.limit(HARD_LIMIT).get();
  const jobs = snapshot.docs.map(doc => doc.data() as Job).filter(job => {
    if (filters?.status === 'pending' && job.nextRunAt) {
      return job.nextRunAt <= nowIso;
    }
    return true;
  });
  jobs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (filters?.limit) {
    return jobs.slice(0, filters.limit);
  }

  return jobs;
}

/**
 * Delete expired jobs (for cleanup cron)
 */
export async function deleteExpiredJobs(): Promise<number> {
  const now = new Date().toISOString();

  const expiredJobs = await db
    .collection(JOBS_COLLECTION)
    .where('expiresAt', '<', now)
    .get();

  const batch = db.batch();
  expiredJobs.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  return expiredJobs.size;
}
