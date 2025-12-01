'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

interface ActivityLog {
  id: string;
  action: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  targetUserName?: string;
  details?: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}

// Separate component for error details to avoid hook violation
const ErrorDetails = ({ details }: { details: Record<string, any> }) => {
  const [showTrace, setShowTrace] = useState(false);

  return (
    <div className="mt-2 space-y-1">
      <div className="text-sm font-medium text-red-900">
        {details.operation && (
          <span className="text-xs text-red-700">Operation: {details.operation}</span>
        )}
      </div>
      {details.errorMessage && (
        <div className="text-sm text-red-800 bg-red-50 p-2 rounded border border-red-200">
          {details.errorMessage}
        </div>
      )}
      {details.gameId && (
        <div className="text-xs text-gray-600">
          Game ID: {details.gameId}
        </div>
      )}
      {details.endpoint && (
        <div className="text-xs text-gray-600">
          Endpoint: {details.endpoint}
        </div>
      )}
      {details.errorDetails && (
        <div className="mt-2">
          <button
            onClick={() => setShowTrace(!showTrace)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showTrace ? 'Hide' : 'Show'} Stack Trace
          </button>
          {showTrace && (
            <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 font-mono whitespace-pre-wrap overflow-x-auto">
              {details.errorDetails}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ActivityLogTab = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/getActivityLogs?userId=${user.uid}&limit=100`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch activity logs');
        }

        const data = await response.json();
        setLogs(data.logs);
        setError(null);
      } catch (error: any) {
        console.error('Error fetching activity logs:', error);
        setError(error.message || 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user?.uid]);

  const filteredLogs = logs.filter(log => {
    if (filter === "all") return true;
    return log.action === filter;
  });

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'USER_REGISTERED': 'User Registered',
      'USER_BLOCKED': 'User Blocked',
      'USER_UNBLOCKED': 'User Unblocked',
      'USER_PROFILE_UPDATED': 'Profile Updated',
      'GAME_JOINED': 'Game Joined',
      'GAME_LEFT': 'Game Left',
      'GAME_UPDATED': 'Game Updated',
      'GAME_CREATED': 'Game Created',
      'GAME_DELETED': 'Game Deleted',
      'BID_PLACED': 'Bid Placed',
      'BID_CANCELLED': 'Bid Cancelled',
      'DIVISION_ASSIGNED': 'Division Assigned',
      'PARTICIPANT_REMOVED': 'Participant Removed',
      'GAME_STATUS_CHANGED': 'Game Status Changed',
      'ERROR': 'Error',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'USER_REGISTERED': 'bg-green-100 text-green-800',
      'USER_BLOCKED': 'bg-red-100 text-red-800',
      'USER_UNBLOCKED': 'bg-blue-100 text-blue-800',
      'USER_PROFILE_UPDATED': 'bg-yellow-100 text-yellow-800',
      'GAME_JOINED': 'bg-green-100 text-green-800',
      'GAME_LEFT': 'bg-orange-100 text-orange-800',
      'GAME_UPDATED': 'bg-blue-100 text-blue-800',
      'GAME_CREATED': 'bg-purple-100 text-purple-800',
      'GAME_DELETED': 'bg-red-100 text-red-800',
      'BID_PLACED': 'bg-emerald-100 text-emerald-800',
      'BID_CANCELLED': 'bg-red-100 text-red-800',
      'DIVISION_ASSIGNED': 'bg-indigo-100 text-indigo-800',
      'PARTICIPANT_REMOVED': 'bg-red-100 text-red-800',
      'GAME_STATUS_CHANGED': 'bg-yellow-100 text-yellow-800',
      'ERROR': 'bg-red-100 text-red-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const renderDetails = (log: ActivityLog) => {
    if (!log.details) return null;

    // BID_PLACED details
    if (log.action === 'BID_PLACED') {
      return (
        <div className="mt-2 space-y-1">
          <div className="text-sm text-gray-900">
            <strong>{log.details.riderName}</strong>
            {log.details.riderTeam && (
              <span className="text-gray-500"> ({log.details.riderTeam})</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-700 font-semibold">
              Bid: €{log.details.amount}
            </span>
            {log.details.isUpdate && log.details.previousAmount && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                Was: €{log.details.previousAmount}
              </span>
            )}
            {log.details.availableBudget && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-gray-600">
                Budget left: €{log.details.availableBudget}
              </span>
            )}
            {log.details.totalActiveBids && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-50 text-orange-700">
                Total active: €{log.details.totalActiveBids}
              </span>
            )}
          </div>
        </div>
      );
    }

    // BID_CANCELLED details
    if (log.action === 'BID_CANCELLED') {
      return (
        <div className="mt-2 space-y-1">
          <div className="text-sm text-gray-900">
            <strong>{log.details.riderName}</strong>
            {log.details.riderTeam && (
              <span className="text-gray-500"> ({log.details.riderTeam})</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold">
              Cancelled bid: €{log.details.amount}
            </span>
            {log.details.wasHighestBid && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-50 text-yellow-700">
                Was highest bid
              </span>
            )}
          </div>
        </div>
      );
    }

    // GAME_UPDATED details
    if (log.action === 'GAME_UPDATED' && log.details.changes) {
      // Filter to only show fields where values actually changed
      const actualChanges = Object.entries(log.details.changes).filter(([_, change]: [string, any]) => {
        return JSON.stringify(change.before) !== JSON.stringify(change.after);
      });

      // Don't render anything if no actual changes
      if (actualChanges.length === 0) return null;

      return (
        <div className="mt-2 space-y-1">
          <div className="text-sm font-medium text-gray-900">
            {log.details.gameName}
            {log.details.gameType && (
              <span className="ml-2 text-xs text-gray-500">({log.details.gameType} - {log.details.gameYear})</span>
            )}
          </div>
          <div className="space-y-1 pl-2 border-l-2 border-gray-200">
            {actualChanges.map(([field, change]: [string, any]) => (
              <div key={field} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="font-medium min-w-[100px]">{field}:</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{JSON.stringify(change.before) || '(empty)'}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-900 font-medium">{JSON.stringify(change.after) || '(empty)'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // GAME_JOINED / GAME_LEFT / PARTICIPANT_REMOVED details
    if ((log.action === 'GAME_JOINED' || log.action === 'GAME_LEFT' || log.action === 'PARTICIPANT_REMOVED') && log.details.gameName) {
      return (
        <div className="mt-2">
          <div className="text-sm font-medium text-gray-900">{log.details.gameName}</div>
          {log.action === 'PARTICIPANT_REMOVED' && log.details.assignedDivision && (
            <div className="text-xs text-gray-600 mt-1">
              Division: {log.details.assignedDivision}
            </div>
          )}
        </div>
      );
    }

    // USER_PROFILE_UPDATED details
    if (log.action === 'USER_PROFILE_UPDATED' && log.details.changes) {
      const changes = log.details.changes;
      return (
        <div className="mt-2 space-y-1">
          {Object.entries(changes).map(([field, value]: [string, any]) => (
            <div key={field} className="text-xs text-gray-600 flex items-center gap-2">
              <span className="font-medium capitalize">{field}:</span>
              <span className="text-gray-400">{value.old || '(empty)'}</span>
              <span className="text-gray-400">→</span>
              <span className="text-gray-900 font-medium">{value.new || '(empty)'}</span>
            </div>
          ))}
        </div>
      );
    }

    // ERROR details
    if (log.action === 'ERROR') {
      return <ErrorDetails details={log.details} />;
    }

    // For other details, show them in a cleaner way
    if (log.details.reason) {
      return (
        <div className="mt-2 text-xs text-gray-500 italic">
          {log.details.reason}
        </div>
      );
    }

    if (log.details.authMethod || log.details.userType) {
      return (
        <div className="mt-2 flex gap-2">
          {log.details.authMethod && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
              {log.details.authMethod}
            </span>
          )}
          {log.details.userType && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary text-primary">
              {log.details.userType}
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading activities...</div>
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
      {/* Header with filter */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Activity Log</h2>
            <p className="text-sm text-gray-600">
              {filteredLogs.length} of {logs.length} activities
            </p>
          </div>
          <div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All activities</option>
              <optgroup label="Users">
                <option value="USER_REGISTERED">Registrations</option>
                <option value="USER_BLOCKED">Blocked</option>
                <option value="USER_UNBLOCKED">Unblocked</option>
                <option value="USER_PROFILE_UPDATED">Profile Updates</option>
              </optgroup>
              <optgroup label="Games">
                <option value="GAME_JOINED">Game Joined</option>
                <option value="GAME_LEFT">Game Left</option>
                <option value="GAME_UPDATED">Game Updated</option>
                <option value="GAME_CREATED">Game Created</option>
                <option value="GAME_DELETED">Game Deleted</option>
                <option value="GAME_STATUS_CHANGED">Status Changed</option>
                <option value="DIVISION_ASSIGNED">Division Assigned</option>
                <option value="PARTICIPANT_REMOVED">Participant Removed</option>
              </optgroup>
              <optgroup label="Bids">
                <option value="BID_PLACED">Bid Placed</option>
                <option value="BID_CANCELLED">Bid Cancelled</option>
              </optgroup>
              <optgroup label="System">
                <option value="ERROR">Errors</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* Activity list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-200">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No activities found
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col gap-2">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    {log.ipAddress && log.ipAddress !== 'unknown' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        {log.ipAddress === '::1' || log.ipAddress === '127.0.0.1' ? 'localhost' : log.ipAddress}
                      </span>
                    )}
                  </div>

                  {/* User info */}
                  <div className="text-sm text-gray-900">
                    <strong>{log.userName || log.userEmail}</strong>
                    {log.targetUserName && (
                      <>
                        {' → '}
                        <strong>{log.targetUserName || log.targetUserEmail}</strong>
                      </>
                    )}
                  </div>

                  {/* Details */}
                  {renderDetails(log)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
