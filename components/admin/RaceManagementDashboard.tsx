'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/Button';
import toast from 'react-hot-toast';

interface StageStatus {
  stageNumber: number | string;
  status: 'scraped' | 'pending' | 'failed';
  scrapedAt: string | null;
  riderCount: number;
  hasValidationErrors: boolean;
  validationWarnings: number;
  docId: string;
}

interface RaceStatus {
  raceSlug: string;
  raceName: string;
  year: number;
  totalStages: number;
  scrapedStages: number;
  failedStages: number;
  pendingStages: number;
  hasStartlist: boolean;
  startlistRiderCount: number;
  lastScrapedAt: string | null;
  hasValidationErrors: boolean;
  isSingleDay: boolean;
  hasPrologue: boolean;
  stages: StageStatus[];
  // Calendar info
  startDate: string | null;
  endDate: string | null;
  raceStatus: 'upcoming' | 'in-progress' | 'finished' | 'unknown';
  classification: string | null;
}

interface RaceStatusResponse {
  races: RaceStatus[];
  summary: {
    totalRaces: number;
    racesWithData: number;
    totalStagesScraped: number;
    totalStagesFailed: number;
    validationErrors: number;
  };
}

interface StageDetailResponse {
  race: string;
  year: number;
  stage: number | string;
  docId: string;
  exists: boolean;
  updatedAt: string | null;
  riderCount: number;
  hasGC: boolean;
  hasPointsClassification: boolean;
  hasMountainsClassification: boolean;
  hasYouthClassification: boolean;
  hasTeamClassification: boolean;
  validation: {
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  } | null;
  backups: Array<{
    id: string;
    backedUpAt: string;
    backupReason: string;
  }>;
  sampleRiders: Array<{
    place: number;
    name: string;
    team: string;
    points: string | number;
  }>;
}

function StatusBadge({ status }: { status: 'scraped' | 'pending' | 'failed' }) {
  const styles = {
    scraped: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  };

  const labels = {
    scraped: 'Scraped',
    pending: 'Pending',
    failed: 'Failed',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ValidationBadge({ hasErrors, warningCount }: { hasErrors: boolean; warningCount: number }) {
  if (hasErrors) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Invalid
      </span>
    );
  }
  if (warningCount > 0) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        {warningCount} warnings
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
      Valid
    </span>
  );
}

function StageRow({
  stage,
  race,
  year,
  userId,
  isSingleDay,
  onRefresh,
}: {
  stage: StageStatus;
  race: string;
  year: number;
  userId: string;
  isSingleDay: boolean;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<StageDetailResponse | null>(null);

  const handleScrape = async () => {
    // Format display name for confirmation
    const displayName = isSingleDay
      ? 'race result'
      : typeof stage.stageNumber === 'number'
        ? `stage ${stage.stageNumber}`
        : stage.stageNumber === 'prologue'
          ? 'prologue'
          : stage.stageNumber === 'gc'
            ? 'general classification'
            : stage.stageNumber;

    if (!confirm(`Scrape ${race} ${displayName}?`)) return;

    setLoading(true);
    try {
      // Determine the correct type based on stageNumber
      let type = 'stage';
      if (stage.stageNumber === 'result' || isSingleDay) {
        type = 'result';
      } else if (stage.stageNumber === 'gc') {
        type = 'tour-gc';
      } else if (stage.stageNumber === 'prologue') {
        type = 'stage'; // prologue is stage 0
      }

      const response = await fetch('/api/admin/stage-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          race,
          year,
          stage: stage.stageNumber,
          type,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast.success(data.message);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Scrape failed');
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async () => {
    if (details) {
      setDetailsOpen(!detailsOpen);
      return;
    }

    setLoading(true);
    try {
      // Determine the correct type based on stageNumber
      let type = 'stage';
      let stageParam = stage.stageNumber.toString();

      if (stage.stageNumber === 'result' || isSingleDay) {
        type = 'result';
        stageParam = ''; // No stage number for result type
      } else if (stage.stageNumber === 'gc') {
        type = 'tour-gc';
        stageParam = ''; // No stage number for GC type
      } else if (stage.stageNumber === 'prologue') {
        type = 'stage';
        stageParam = '0'; // Prologue is stage 0
      }

      const params = new URLSearchParams({
        userId,
        race,
        year: year.toString(),
        type,
      });

      // Only add stage param if it has a value
      if (stageParam) {
        params.set('stage', stageParam);
      }

      const response = await fetch(`/api/admin/stage-status?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setDetails(data);
      setDetailsOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <tr className="border-b hover:bg-gray-50">
        <td className="px-4 py-2">
          <span className="font-medium">
            {isSingleDay
              ? 'Race Result'
              : typeof stage.stageNumber === 'number'
                ? `Stage ${stage.stageNumber}`
                : stage.stageNumber === 'prologue'
                  ? 'Prologue'
                  : stage.stageNumber === 'result'
                    ? 'Result'
                    : stage.stageNumber === 'gc'
                      ? 'General Classification'
                      : stage.stageNumber}
          </span>
        </td>
        <td className="px-4 py-2">
          <StatusBadge status={stage.status} />
        </td>
        <td className="px-4 py-2 text-sm text-gray-600">
          {stage.riderCount > 0 ? `${stage.riderCount} riders` : '-'}
        </td>
        <td className="px-4 py-2">
          {stage.status === 'scraped' && (
            <ValidationBadge
              hasErrors={stage.hasValidationErrors}
              warningCount={stage.validationWarnings}
            />
          )}
        </td>
        <td className="px-4 py-2 text-sm text-gray-500">
          {stage.scrapedAt
            ? new Date(stage.scrapedAt).toLocaleString('nl-NL', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-'}
        </td>
        <td className="px-4 py-2 space-x-2">
          {stage.status === 'scraped' && (
            <Button
              size="sm"
              variant="secondary"
              ghost
              onClick={loadDetails}
              disabled={loading}
            >
              {loading ? '...' : detailsOpen ? 'Hide' : 'Details'}
            </Button>
          )}
          <Button
            size="sm"
            variant={stage.status === 'pending' ? 'primary' : 'secondary'}
            outline={stage.status !== 'pending'}
            onClick={handleScrape}
            disabled={loading}
          >
            {loading ? 'Loading...' : stage.status === 'pending' ? 'Scrape' : 'Re-scrape'}
          </Button>
        </td>
      </tr>
      {detailsOpen && details && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-4">
              {/* Classifications */}
              <div className="flex gap-4 text-sm">
                <span className={details.hasGC ? 'text-green-600' : 'text-gray-400'}>
                  GC: {details.hasGC ? 'Yes' : 'No'}
                </span>
                <span className={details.hasPointsClassification ? 'text-green-600' : 'text-gray-400'}>
                  Points: {details.hasPointsClassification ? 'Yes' : 'No'}
                </span>
                <span className={details.hasMountainsClassification ? 'text-green-600' : 'text-gray-400'}>
                  Mountains: {details.hasMountainsClassification ? 'Yes' : 'No'}
                </span>
                <span className={details.hasYouthClassification ? 'text-green-600' : 'text-gray-400'}>
                  Youth: {details.hasYouthClassification ? 'Yes' : 'No'}
                </span>
                <span className={details.hasTeamClassification ? 'text-green-600' : 'text-gray-400'}>
                  Team: {details.hasTeamClassification ? 'Yes' : 'No'}
                </span>
              </div>

              {/* Sample Riders */}
              {details.sampleRiders.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Top 5 Finishers:</h4>
                  <table className="text-sm w-full max-w-lg">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="pr-4">#</th>
                        <th className="pr-4">Rider</th>
                        <th className="pr-4">Team</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.sampleRiders.map((rider, i) => (
                        <tr key={i}>
                          <td className="pr-4">{rider.place}</td>
                          <td className="pr-4">{rider.name}</td>
                          <td className="pr-4 text-gray-500">{rider.team}</td>
                          <td>{rider.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Validation Errors/Warnings */}
              {details.validation && (details.validation.errors.length > 0 || details.validation.warnings.length > 0) && (
                <div>
                  {details.validation.errors.length > 0 && (
                    <div className="text-red-600 text-sm">
                      <h4 className="font-medium">Errors:</h4>
                      <ul className="list-disc list-inside">
                        {details.validation.errors.map((e, i) => (
                          <li key={i}>{e.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {details.validation.warnings.length > 0 && (
                    <div className="text-yellow-600 text-sm mt-2">
                      <h4 className="font-medium">Warnings:</h4>
                      <ul className="list-disc list-inside">
                        {details.validation.warnings.slice(0, 5).map((w, i) => (
                          <li key={i}>{w.message}</li>
                        ))}
                        {details.validation.warnings.length > 5 && (
                          <li>... and {details.validation.warnings.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Backups */}
              {details.backups.length > 0 && (
                <div className="text-sm">
                  <h4 className="font-medium mb-1">Backups ({details.backups.length}):</h4>
                  <ul className="text-gray-600">
                    {details.backups.slice(0, 3).map((backup) => (
                      <li key={backup.id}>
                        {new Date(backup.backedUpAt).toLocaleString('nl-NL')} - {backup.backupReason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RaceCard({
  race,
  userId,
  onRefresh,
}: {
  race: RaceStatus;
  userId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const progressPercent = race.totalStages > 0
    ? Math.round((race.scrapedStages / race.totalStages) * 100)
    : 0;

  // Format date range for display
  const formatDateRange = () => {
    if (!race.startDate) return null;
    const start = new Date(race.startDate);
    const end = race.endDate ? new Date(race.endDate) : start;
    const startStr = start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    return start.getTime() === end.getTime() ? startStr : `${startStr} - ${endStr}`;
  };

  // Get status badge color
  const getStatusBadgeColor = () => {
    switch (race.raceStatus) {
      case 'in-progress': return 'bg-green-100 text-green-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'finished': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = () => {
    switch (race.raceStatus) {
      case 'in-progress': return 'In Progress';
      case 'upcoming': return 'Upcoming';
      case 'finished': return 'Finished';
      default: return '';
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden mb-4">
      {/* Header */}
      <div
        className="px-4 py-3 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <span className="font-semibold text-lg">{race.raceName}</span>
          {formatDateRange() && (
            <span className="text-gray-500 text-sm">{formatDateRange()}</span>
          )}
          {race.raceStatus !== 'unknown' && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadgeColor()}`}>
              {getStatusLabel()}
            </span>
          )}
          {race.isSingleDay && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
              One-day
            </span>
          )}
          {race.hasValidationErrors && (
            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
              Has errors
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {race.isSingleDay ? (
              // Single-day race: simpler display
              race.scrapedStages > 0 ? (
                <span className="text-green-600 font-medium">Scraped</span>
              ) : race.failedStages > 0 ? (
                <span className="text-red-600 font-medium">Failed</span>
              ) : (
                <span className="text-yellow-600">Pending</span>
              )
            ) : (
              // Multi-stage race
              <>
                <span className="text-green-600 font-medium">{race.scrapedStages}</span>
                {race.failedStages > 0 && (
                  <>
                    {' / '}
                    <span className="text-red-600 font-medium">{race.failedStages} failed</span>
                  </>
                )}
                {' / '}
                <span>
                  {race.hasPrologue
                    ? `prologue + ${race.totalStages - 1} stages`
                    : `${race.totalStages} stages`}
                </span>
              </>
            )}
          </div>
          <div className="w-24 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${race.failedStages > 0 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-4">
          {/* Startlist Info */}
          <div className="mb-4 flex items-center gap-4 text-sm">
            <span className={race.hasStartlist ? 'text-green-600' : 'text-gray-400'}>
              Startlist: {race.hasStartlist ? `${race.startlistRiderCount} riders` : 'Not scraped'}
            </span>
            {race.lastScrapedAt && (
              <span className="text-gray-500">
                Last update: {new Date(race.lastScrapedAt).toLocaleString('nl-NL')}
              </span>
            )}
          </div>

          {/* Stages Table */}
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 text-sm border-b">
                <th className="px-4 py-2">{race.isSingleDay ? 'Result' : 'Stage'}</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Riders</th>
                <th className="px-4 py-2">Validation</th>
                <th className="px-4 py-2">Scraped</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {race.stages.map((stage) => (
                <StageRow
                  key={`${race.raceSlug}-${stage.stageNumber}`}
                  stage={stage}
                  race={race.raceSlug}
                  year={race.year}
                  userId={userId}
                  isSingleDay={race.isSingleDay}
                  onRefresh={onRefresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RaceManagementDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RaceStatusResponse | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId: user.uid,
        year: year.toString(),
      });

      const response = await fetch(`/api/admin/race-status?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch race status');
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to load race status');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!user) {
    return <div className="p-4">Please log in to access this page.</div>;
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Race Management</h1>
        <div className="flex items-center gap-4">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="border rounded px-3 py-2"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button onClick={fetchData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold">{data.summary.totalRaces}</div>
            <div className="text-gray-500 text-sm">Total Races</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{data.summary.racesWithData}</div>
            <div className="text-gray-500 text-sm">Races with Data</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{data.summary.totalStagesScraped}</div>
            <div className="text-gray-500 text-sm">Stages Scraped</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{data.summary.totalStagesFailed}</div>
            <div className="text-gray-500 text-sm">Failed Stages</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{data.summary.validationErrors}</div>
            <div className="text-gray-500 text-sm">Validation Errors</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="text-center py-8 text-gray-500">Loading race data...</div>
      )}

      {/* No Data */}
      {!loading && data && data.races.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No race data found for {year}
        </div>
      )}

      {/* Race List */}
      {data && data.races.length > 0 && (
        <div>
          {data.races.map((race) => (
            <RaceCard
              key={`${race.raceSlug}-${race.year}`}
              race={race}
              userId={user.uid}
              onRefresh={fetchData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
