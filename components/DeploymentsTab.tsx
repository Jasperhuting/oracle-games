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

  const formatDate = (timestamp: string | { toDate: () => Date }) => {
    try {
      const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp.toDate());

      // Check if date is valid
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
      console.error('Error formatting date:', error, 'timestamp:', timestamp);
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
