'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/Button';

type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

interface JobItem {
  id: string;
  type: string;
  status: JobStatus;
  priority: number;
  progress: {
    current: number;
    total: number;
    percentage: number;
    stage?: string;
  };
  data: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface BatchItem {
  id: string;
  date: string;
  status: 'running' | 'completed';
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  telegramSent?: boolean;
  createdAt: string;
  completedAt?: string;
  outcomes?: string[];
}

interface PointsCalcLogItem {
  id: string;
  timestamp?: string;
  details: {
    jobId?: string;
    race?: string;
    raceSlug?: string;
    year?: number;
    stage?: number | string;
    type?: string;
    status?: number;
    success?: boolean;
    error?: string | null;
  };
}

export function JobsDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [pointsLogs, setPointsLogs] = useState<PointsCalcLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [recalcRaceSlug, setRecalcRaceSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);

    try {
      const [jobsResponse, logsResponse] = await Promise.all([
        fetch(`/api/admin/jobs?userId=${user.uid}`),
        fetch(`/api/admin/points-calculation-logs?userId=${user.uid}&status=failed`),
      ]);

      const jobsData = await jobsResponse.json();
      if (!jobsResponse.ok) {
        throw new Error(jobsData.error || 'Failed to fetch jobs');
      }
      setJobs(jobsData.jobs || []);
      setBatches(jobsData.batches || []);

      const logsData = await logsResponse.json();
      if (logsResponse.ok) {
        setPointsLogs(logsData.logs || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [user?.uid]);

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleString('nl-NL') : '-';

  const statusBadge = (status: JobStatus | BatchItem['status']) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Jobs</h2>
          <p className="text-sm text-gray-500">Scrape batches en job queue status</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              if (!user?.uid) return;
              setProcessing(true);
              setError(null);
              try {
                const response = await fetch('/api/admin/process-scrape-jobs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.uid, limit: 10 }),
                });
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data.error || 'Failed to process scrape jobs');
                }
                await loadJobs();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to process scrape jobs');
              } finally {
                setProcessing(false);
              }
            }}
            disabled={loading || cleaning || processing}
          >
            {processing ? 'Processing...' : 'Process queue'}
          </Button>
          <Button
            onClick={async () => {
              if (!user?.uid) return;
              setCleaning(true);
              setError(null);
              try {
                const response = await fetch('/api/admin/jobs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.uid, action: 'cleanupExcluded' }),
                });
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data.error || 'Failed to cleanup jobs');
                }
                await loadJobs();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to cleanup jobs');
              } finally {
                setCleaning(false);
              }
            }}
            disabled={loading || cleaning || processing}
          >
            {cleaning ? 'Cleaning...' : 'Cleanup excluded'}
          </Button>
          <Button onClick={loadJobs} disabled={loading || cleaning || processing}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Batches</h3>
        {batches.length === 0 ? (
          <p className="text-sm text-gray-500">No batches found</p>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => (
              <details key={batch.id} className="border rounded-md p-3">
                <summary className="cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{batch.date || batch.id}</span>
                    {statusBadge(batch.status)}
                    <span className="text-sm text-gray-500">
                      {batch.completedJobs}/{batch.totalJobs} done
                      {batch.failedJobs > 0 ? ` • ${batch.failedJobs} failed` : ''}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(batch.createdAt)}</span>
                </summary>
                <div className="mt-3 text-sm text-gray-600 space-y-2">
                  <div>Telegram sent: {batch.telegramSent ? 'yes' : 'no'}</div>
                  <div>Completed at: {formatDate(batch.completedAt)}</div>
                  {batch.outcomes && batch.outcomes.length > 0 && (
                    <div className="bg-gray-50 border rounded p-2 max-h-48 overflow-y-auto text-xs">
                      {batch.outcomes.slice(0, 100).map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Points Calculation Errors</h3>
        {pointsLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No failed calculations found</p>
        ) : (
          <div className="space-y-2">
            {pointsLogs.map((log) => {
              const raceSlug = log.details.raceSlug || log.details.race || 'unknown';
              const year = log.details.year;
              const stage = log.details.stage;
              const errorText = log.details.error || 'Unknown error';
              const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString('nl-NL') : '-';
              return (
                <div key={log.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{raceSlug}</span>
                      <span className="text-xs text-gray-500">{year ?? '-'}</span>
                      <span className="text-xs text-gray-500">Stage: {stage ?? '-'}</span>
                      <span className="text-xs text-red-600">Failed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (!user?.uid) return;
                          setRecalcRaceSlug(raceSlug);
                          setError(null);
                          try {
                            const response = await fetch('/api/admin/recalculate-race-points', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                userId: user.uid,
                                raceSlug,
                                year,
                              }),
                            });
                            const data = await response.json();
                            if (!response.ok) {
                              throw new Error(data.error || 'Failed to recalculate points');
                            }
                            await loadJobs();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to recalculate points');
                          } finally {
                            setRecalcRaceSlug(null);
                          }
                        }}
                        disabled={loading || processing || cleaning || recalcRaceSlug !== null}
                      >
                        {recalcRaceSlug === raceSlug ? 'Recalculating...' : 'Recalculate race'}
                      </Button>
                      <span className="text-xs text-gray-400">{timestamp}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Error: {errorText}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-500">No jobs found</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{job.data?.raceName as string || (job.data?.race as string) || job.id}</span>
                    {statusBadge(job.status)}
                    <span className="text-xs text-gray-500">{job.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === 'failed' && (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (!user?.uid) return;
                          setProcessingJobId(job.id);
                          setError(null);
                          try {
                            const response = await fetch('/api/admin/retry-job', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: user.uid, jobId: job.id }),
                            });
                            const data = await response.json();
                            if (!response.ok) {
                              throw new Error(data.error || 'Failed to retry job');
                            }
                            await loadJobs();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to retry job');
                          } finally {
                            setProcessingJobId(null);
                          }
                        }}
                        disabled={loading || cleaning || processing || processingJobId !== null}
                      >
                        {processingJobId === job.id ? 'Retrying...' : 'Retry'}
                      </Button>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(job.createdAt)}</span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Progress: {job.progress?.current ?? 0}/{job.progress?.total ?? 0} ({job.progress?.percentage ?? 0}%)
                  {job.progress?.stage ? ` • ${job.progress.stage}` : ''}
                </div>
                {job.error && (
                  <div className="mt-2 text-sm text-red-600">Error: {job.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
