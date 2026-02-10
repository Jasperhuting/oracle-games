'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ActivityLog } from "@/lib/types/activity";

export const DeploymentsTab = () => {
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeployments = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/getDeployments?userId=${user.uid}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch deployments');
        }

        const data = await response.json();
        setDeployments(data.deployments);
        setError(null);
      } catch (error: unknown) {
        console.error('Error fetching deployments:', error);
        setError(error instanceof Error ? error.message : 'Failed to load deployments');
      } finally {
        setLoading(false);
      }
    };

    fetchDeployments();
  }, [user?.uid]);

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);

      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }

      return date.toLocaleString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getStatusColor = (action: string) => {
    if (action.includes('READY')) return 'bg-green-100 text-green-800';
    if (action.includes('ERROR')) return 'bg-red-100 text-red-800';
    if (action.includes('BUILDING')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const formatAction = (action: string) => {
    return action
      .replace('VERCEL_DEPLOYMENT_', '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const buildContributionGrid = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let earliest: Date | null = null;
    deployments.forEach((deployment) => {
      const date = new Date(deployment.timestamp);
      if (Number.isNaN(date.getTime())) return;
      date.setHours(0, 0, 0, 0);
      if (!earliest || date < earliest) earliest = date;
    });

    const defaultStart = new Date(today);
    defaultStart.setDate(defaultStart.getDate() - 364);
    const start = earliest && earliest > defaultStart ? earliest : defaultStart;

    const startWeek = new Date(start);
    startWeek.setDate(startWeek.getDate() - startWeek.getDay());

    const countsByDay = new Map<string, number>();
    deployments.forEach((deployment) => {
      const date = new Date(deployment.timestamp);
      if (Number.isNaN(date.getTime())) return;
      date.setHours(0, 0, 0, 0);
      if (date < start || date > today) return;
      const key = formatDateKey(date);
      countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
    });

    const allCounts = Array.from(countsByDay.values());
    const maxCount = allCounts.length > 0 ? Math.max(...allCounts) : 0;

    const getLevel = (count: number) => {
      if (count <= 0) return 0;
      if (maxCount <= 1) return 4;
      const ratio = count / maxCount;
      if (ratio <= 0.25) return 1;
      if (ratio <= 0.5) return 2;
      if (ratio <= 0.75) return 3;
      return 4;
    };

    const weeks: { date: Date; count: number; level: number; inRange: boolean }[][] = [];
    let cursor = new Date(startWeek);

    while (cursor <= today) {
      const week: { date: Date; count: number; level: number; inRange: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(cursor);
        const inRange = day >= start && day <= today;
        const key = formatDateKey(day);
        const count = inRange ? countsByDay.get(key) || 0 : 0;
        week.push({
          date: day,
          count,
          level: inRange ? getLevel(count) : 0,
          inRange,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }

    const monthLabels: string[] = [];
    let lastMonth = '';
    weeks.forEach((week) => {
      const firstInRange = week.find(day => day.inRange);
      if (!firstInRange) {
        monthLabels.push('');
        return;
      }
      const monthLabel = firstInRange.date.toLocaleString('en-US', { month: 'short' });
      if (monthLabel !== lastMonth) {
        monthLabels.push(monthLabel);
        lastMonth = monthLabel;
      } else {
        monthLabels.push('');
      }
    });

    const startPaddingDays = (start.getDay() + 6) % 7;
    return { weeks, monthLabels, total: deployments.length, startPaddingDays };
  };

  const contributionGrid = buildContributionGrid();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const levelClasses = [
    'bg-gray-100 border border-gray-200',
    'bg-green-100 border border-green-200',
    'bg-green-300 border border-green-300',
    'bg-green-500 border border-green-500',
    'bg-green-700 border border-green-700',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading deployments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <span className="text-red-700 text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Deployments</h2>
            <p className="text-sm text-gray-600">
              {deployments.length} deployment{deployments.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* GitHub-style contributions */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold">{contributionGrid.total}</span> deployments in the last year
          </div>
          <div className="overflow-x-hidden">
            <div className="w-fit">
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `auto repeat(${contributionGrid.weeks.length}, 12px)`,
                  gridTemplateRows: `16px repeat(7, 12px)`,
                }}
              >
                <div className="text-xs text-gray-500" />
                {contributionGrid.monthLabels.map((label, index) => (
                  <div key={`month-${index}`} className="text-xs text-gray-500 h-4">
                    {label}
                  </div>
                ))}
                {dayLabels.map((label, rowIndex) => (
                  <div key={`label-${label}`} className="text-xs text-gray-500 text-right pr-1">
                    {label}
                  </div>
                ))}
                {contributionGrid.weeks.map((week, weekIndex) =>
                  week.map((day, rowIndex) => {
                    const labelDate = day.date.toLocaleDateString('nl-NL');
                    const title = day.inRange
                      ? `${day.count} deployment${day.count !== 1 ? 's' : ''} on ${labelDate}`
                      : '';
                    return (
                      <div
                        key={`${weekIndex}-${labelDate}`}
                        title={title}
                        className={`h-3 w-3 rounded-sm ${day.inRange ? levelClasses[day.level] : 'bg-transparent'}`}
                        style={{ gridColumn: weekIndex + 2, gridRow: rowIndex + 2 }}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={`legend-${level}`} className={`h-3 w-3 rounded-sm ${levelClasses[level]}`} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Deployments list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-200">
          {deployments.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No deployments found
            </div>
          ) : (
            deployments.map((deployment) => (
              <div key={deployment.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col gap-3">
                  {/* Header row with status and timestamp */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deployment.action)}`}>
                        {formatAction(deployment.action)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(deployment.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Commit message */}
                  {deployment.details?.commitMessage && (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        Commit Message
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                        {deployment.details.commitMessage}
                      </div>
                    </div>
                  )}

                  {/* Deployment details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {deployment.details?.branch && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 min-w-[100px]">Branch:</span>
                        <span className="font-mono text-gray-900">{deployment.details.branch}</span>
                      </div>
                    )}

                    {deployment.details?.environment && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 min-w-[100px]">Environment:</span>
                        <span className="font-medium text-gray-900 capitalize">{deployment.details.environment}</span>
                      </div>
                    )}

                    {deployment.details?.commit && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 min-w-[100px]">Commit SHA:</span>
                        <span className="font-mono text-xs text-gray-700">{deployment.details.commit.substring(0, 7)}</span>
                      </div>
                    )}

                    {deployment.details?.deployment?.meta?.githubCommitAuthorName && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 min-w-[100px]">Author:</span>
                        <span className="text-gray-900">{deployment.details.deployment.meta.githubCommitAuthorName}</span>
                      </div>
                    )}
                  </div>

                  {/* Links */}
                  <div className="flex flex-wrap gap-3">
                    {deployment.details?.deployment?.inspectorUrl && (
                      <a
                        href={deployment.details.deployment.inspectorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View on Vercel
                      </a>
                    )}

                    {deployment.details?.links?.project && (
                      <a
                        href={deployment.details.links.project}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 hover:underline"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Project
                      </a>
                    )}

                    {deployment.details?.url && (
                      <a
                        href={`https://${deployment.details.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 hover:underline"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        Deployment URL
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
