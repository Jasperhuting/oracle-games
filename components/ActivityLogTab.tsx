'use client'

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ActivityLog } from "@/lib/types/activity";
import { useTranslation } from "react-i18next";
  
// Separate component for error details to avoid hook violation
const ErrorDetails = ({ details }: { details: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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

// Category checkbox component with indeterminate support
const CategoryCheckbox = ({
  label,
  checked,
  indeterminate,
  onChange
}: {
  label: string;
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className="flex items-center gap-2 cursor-pointer mb-2">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-gray-300 text-primary focus:ring-primary"
      />
      <span className="text-xs font-semibold text-gray-600">{label}</span>
    </label>
  );
};

const FILTER_OPTIONS = {
  users: ['USER_REGISTERED', 'USER_BLOCKED', 'USER_UNBLOCKED', 'USER_PROFILE_UPDATED'],
  games: ['GAME_JOINED', 'GAME_LEFT', 'GAME_UPDATED', 'GAME_CREATED', 'GAME_DELETED', 'GAME_STATUS_CHANGED', 'DIVISION_ASSIGNED', 'PARTICIPANT_REMOVED'],
  bids: ['BID_PLACED', 'BID_CANCELLED'],
  messaging: ['MESSAGE_SENT', 'MESSAGE_BROADCAST'],
  system: ['ERROR', 'IMPERSONATION_STARTED', 'IMPERSONATION_STOPPED']
};

export const ActivityLogTab = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
    const { t } = useTranslation();

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/getUser?userId=${user.uid}`);
        if (response.ok) {
          const userData = await response.json();

          // Check if activityLogFilters exists in the response
          if ('activityLogFilters' in userData) {
            // Use the saved filters (even if it's an empty array)
            setSelectedFilters(userData.activityLogFilters || []);
          } else {
            // Only set all filters if the field doesn't exist (first time user)
            const allFilters = Object.values(FILTER_OPTIONS).flat();
            setSelectedFilters(allFilters);
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        // Default: all filters enabled on error
        const allFilters = Object.values(FILTER_OPTIONS).flat();
        setSelectedFilters(allFilters);
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadPreferences();
  }, [user?.uid]);

  // Fetch activity logs
  useEffect(() => {
    const fetchLogs = async () => {
      if (!user?.uid) return;

      try {
        const response = await fetch(`/api/getActivityLogs?userId=${user.uid}&limit=5000`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch activity logs');
        }

        const data = await response.json();
        setLogs(data.logs);
        setError(null);
      } catch (error: unknown) {
        console.error('Error fetching activity logs:', error);
        setError(error instanceof Error ? error.message : 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user?.uid]);

  // Save preferences when filters change
  const handleFilterToggle = async (filterValue: string) => {
    const newFilters = selectedFilters.includes(filterValue)
      ? selectedFilters.filter(f => f !== filterValue)
      : [...selectedFilters, filterValue];

    setSelectedFilters(newFilters);

    // Save to database
    if (user?.uid) {
      try {
        await fetch('/api/updateUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            updates: { activityLogFilters: newFilters }
          })
        });
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
    }
  };

  const toggleAll = async (enabled: boolean) => {
    const newFilters = enabled ? Object.values(FILTER_OPTIONS).flat() : [];
    setSelectedFilters(newFilters);

    if (user?.uid) {
      try {
        await fetch('/api/updateUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            updates: { activityLogFilters: newFilters }
          })
        });
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
    }
  };

  const toggleCategory = async (category: keyof typeof FILTER_OPTIONS) => {
    const categoryFilters = FILTER_OPTIONS[category];
    const allCategorySelected = categoryFilters.every(filter => selectedFilters.includes(filter));

    let newFilters: string[];
    if (allCategorySelected) {
      // Deselect all in category
      newFilters = selectedFilters.filter(f => !categoryFilters.includes(f));
    } else {
      // Select all in category
      const filtersToAdd = categoryFilters.filter(f => !selectedFilters.includes(f));
      newFilters = [...selectedFilters, ...filtersToAdd];
    }

    setSelectedFilters(newFilters);

    if (user?.uid) {
      try {
        await fetch('/api/updateUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            updates: { activityLogFilters: newFilters }
          })
        });
      } catch (error) {
        console.error('Error saving preferences:', error);
      }
    }
  };

  const getCategoryState = (category: keyof typeof FILTER_OPTIONS): { checked: boolean; indeterminate: boolean } => {
    const categoryFilters = FILTER_OPTIONS[category];
    const selectedCount = categoryFilters.filter(filter => selectedFilters.includes(filter)).length;

    if (selectedCount === 0) {
      return { checked: false, indeterminate: false };
    } else if (selectedCount === categoryFilters.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  };

  // Format action for display
  const formatAction = (action: string) => {
    if (action.startsWith('VERCEL_')) {
      return action
        .replace('VERCEL_', '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase());
    }
    return action;
  };

  const filteredLogs = logs.filter(log => {
    return selectedFilters.length === 0 || selectedFilters.includes(log.action);
  });

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

  // Helper to format values for display, handling Firestore timestamps
  const formatValue = (value: any): string => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (value === null || value === undefined) return '(empty)';

    // Handle Firestore Timestamp objects (both formats)
    if (typeof value === 'object' && value !== null) {
      // Format: { _seconds: number, _nanoseconds: number }
      if ('_seconds' in value) {
        const date = new Date(value._seconds * 1000);
        return date.toLocaleString('nl-NL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      // Format: { __type__: 'Timestamp', value: string }
      if (value.__type__ === 'Timestamp' && value.value) {
        const date = new Date(value.value);
        return date.toLocaleString('nl-NL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }

    // Handle ISO date strings
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('nl-NL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }

    // For other objects, stringify them
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
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
      'MESSAGE_SENT': 'bg-blue-100 text-blue-800',
      'MESSAGE_BROADCAST': 'bg-purple-100 text-purple-800',
      'ERROR': 'bg-red-100 text-red-800',
      'IMPERSONATION_STARTED': 'bg-orange-100 text-orange-800',
      'IMPERSONATION_STOPPED': 'bg-green-100 text-green-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const renderDetails = (log: ActivityLog) => {
    if (!log.details) return null;

    // BID_PLACED details
    if (log.action === 'BID_PLACED') {
      return (
        <div className="mt-2 space-y-1">
          {log.details.gameName && (
            <div className="text-xs text-gray-600 font-medium">
              Game: {log.details.gameName}
            </div>
          )}
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
          {log.details.gameName && (
            <div className="text-xs text-gray-600 font-medium">
              Game: {log.details.gameName}
            </div>
          )}
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

    // MESSAGE_SENT details
    if (log.action === 'message_sent') {
      return (
        <div className="mt-2 space-y-1">
          <div className="text-sm text-gray-900">
            <strong>To:</strong> {log.targetUserName || log.targetUserEmail || 'Unknown user'}
          </div>
          <div className="text-sm text-gray-700">
            <strong>Subject:</strong> {log.details.subject}
          </div>
        </div>
      );
    }

    // MESSAGE_BROADCAST details
    if (log.action === 'message_broadcast') {
      return (
        <div className="mt-2 space-y-1">
          <div className="text-sm text-gray-900">
            <strong>Subject:</strong> {log.details.subject}
          </div>
          <div className="text-xs text-gray-600">
            Sent to {log.details.recipientCount} users
          </div>
        </div>
      );
    }

    // GAME_UPDATED details
    if (log.action === 'GAME_UPDATED' && log.details.changes) {
      // Filter to only show fields where values actually changed
      const actualChanges = Object.entries(log.details.changes).filter(([_, change]: [string, any]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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
            {actualChanges.map(([field, change]: [string, any]) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
              <div key={field} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="font-medium min-w-[100px]">{field}:</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{formatValue(change.before)}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-900 font-medium">{formatValue(change.after)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // GAME_STATUS_CHANGED details
    if (log.action === 'GAME_STATUS_CHANGED') {
      return (
        <div className="mt-2 space-y-1">
          {(log.gameName || log.details.gameName) && (
            <div className="text-sm font-medium text-gray-900">{log.gameName || log.details.gameName}</div>
          )}
          {log.gameId && (
            <div className="text-xs text-gray-500">Game ID: {log.gameId}</div>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-600">Status:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">
              {log.details.oldStatus}
            </span>
            <span className="text-gray-400">→</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700 font-semibold">
              {log.details.newStatus}
            </span>
          </div>
          {log.details.oldAuctionStatus && log.details.newAuctionStatus && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-gray-600">Auction Status:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                {log.details.oldAuctionStatus}
              </span>
              <span className="text-gray-400">→</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                {log.details.newAuctionStatus}
              </span>
            </div>
          )}
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
          {Object.entries(changes).map(([field, value]: [string, any]) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
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

    // Vercel deployment events
    if (log.action.startsWith('VERCEL_')) {
      return (
        <div className="mt-2 space-y-1">
          {log.details.environment && (
            <div className="flex items-center">
              <span className="text-gray-500 w-24">Environment:</span>
              <span className="font-medium">{log.details.environment}</span>
            </div>
          )}
          {log.details.branch && (
            <div className="flex items-center">
              <span className="text-gray-500 w-24">Branch:</span>
              <span className="font-mono text-sm">{log.details.branch}</span>
            </div>
          )}
          {log.details.commit && (
            <div className="flex items-center">
              <span className="text-gray-500 w-24">Commit:</span>
              <span className="font-mono text-xs">{log.details.commit}</span>
            </div>
          )}
          {log.details.deploymentUrl && (
            <div className="pt-2">
              <a 
                href={log.details.deploymentUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                View Deployment
              </a>
            </div>
          )}
        </div>
      );
    }

    // IMPERSONATION_STARTED details
    if (log.action === 'IMPERSONATION_STARTED') {
      return (
        <div className="mt-2 space-y-1">
          <div className="text-sm text-gray-900">
            <strong>Impersonating:</strong> {log.details.targetUserName || log.details.targetUserEmail || 'Unknown user'}
          </div>
          {log.details.targetUserEmail && log.details.targetUserName && (
            <div className="text-xs text-gray-600">
              Email: {log.details.targetUserEmail}
            </div>
          )}
          {log.details.targetUserId && (
            <div className="text-xs text-gray-500">
              User ID: {log.details.targetUserId}
            </div>
          )}
        </div>
      );
    }

    // IMPERSONATION_STOPPED details
    if (log.action === 'IMPERSONATION_STOPPED') {
      return (
        <div className="mt-2 space-y-1">
          <div className="text-sm text-gray-900">
            <strong>Stopped impersonating:</strong> {log.details.targetUserName || log.details.targetUserEmail || 'Unknown user'}
          </div>
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
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary text-white">
              {log.details.userType}
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  const getFilterLabel = (action: string) => {
    const labels: Record<string, string> = {
      'USER_REGISTERED': 'Registrations',
      'USER_BLOCKED': 'Blocked',
      'USER_UNBLOCKED': 'Unblocked',
      'USER_PROFILE_UPDATED': 'Profile Updates',
      'GAME_JOINED': 'Game Joined',
      'GAME_LEFT': 'Game Left',
      'GAME_UPDATED': 'Game Updated',
      'GAME_CREATED': 'Game Created',
      'GAME_DELETED': 'Game Deleted',
      'GAME_STATUS_CHANGED': 'Status Changed',
      'DIVISION_ASSIGNED': 'Division Assigned',
      'PARTICIPANT_REMOVED': 'Participant Removed',
      'BID_PLACED': 'Bid Placed',
      'BID_CANCELLED': 'Bid Cancelled',
      'MESSAGE_SENT': 'Messages Sent',
      'MESSAGE_BROADCAST': 'Broadcast Messages',
      'ERROR': 'Errors',
      'IMPERSONATION_STARTED': 'Impersonation Started',
      'IMPERSONATION_STOPPED': 'Impersonation Stopped',
    };
    return labels[action] || action;
  };

  if (loading || loadingPreferences) {
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

  const allFilters = Object.values(FILTER_OPTIONS).flat();
  const allSelected = selectedFilters.length === allFilters.length;
  const noneSelected = selectedFilters.length === 0;

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Activity Log</h2>
            <p className="text-sm text-gray-600">
              {filteredLogs.length} of {logs.length} activities
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{t('global.filters')}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => toggleAll(true)}
              disabled={allSelected}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => toggleAll(false)}
              disabled={noneSelected}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Users */}
          <div>
            <CategoryCheckbox
              label="Users"
              checked={getCategoryState('users').checked}
              indeterminate={getCategoryState('users').indeterminate}
              onChange={() => toggleCategory('users')}
            />
            <div className="space-y-1.5">
              {FILTER_OPTIONS.users.map((filterValue) => (
                <label key={filterValue} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFilters.includes(filterValue)}
                    onChange={() => handleFilterToggle(filterValue)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">{getFilterLabel(filterValue)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Games */}
          <div>
            <CategoryCheckbox
              label="Games"
              checked={getCategoryState('games').checked}
              indeterminate={getCategoryState('games').indeterminate}
              onChange={() => toggleCategory('games')}
            />
            <div className="space-y-1.5">
              {FILTER_OPTIONS.games.map((filterValue) => (
                <label key={filterValue} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFilters.includes(filterValue)}
                    onChange={() => handleFilterToggle(filterValue)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">{getFilterLabel(filterValue)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Bids */}
          <div>
            <CategoryCheckbox
              label="Bids"
              checked={getCategoryState('bids').checked}
              indeterminate={getCategoryState('bids').indeterminate}
              onChange={() => toggleCategory('bids')}
            />
            <div className="space-y-1.5">
              {FILTER_OPTIONS.bids.map((filterValue) => (
                <label key={filterValue} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFilters.includes(filterValue)}
                    onChange={() => handleFilterToggle(filterValue)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">{getFilterLabel(filterValue)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Messaging */}
          <div>
            <CategoryCheckbox
              label="Messaging"
              checked={getCategoryState('messaging').checked}
              indeterminate={getCategoryState('messaging').indeterminate}
              onChange={() => toggleCategory('messaging')}
            />
            <div className="space-y-1.5">
              {FILTER_OPTIONS.messaging.map((filterValue) => (
                <label key={filterValue} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFilters.includes(filterValue)}
                    onChange={() => handleFilterToggle(filterValue)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">{getFilterLabel(filterValue)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* System */}
          <div>
            <CategoryCheckbox
              label="System"
              checked={getCategoryState('system').checked}
              indeterminate={getCategoryState('system').indeterminate}
              onChange={() => toggleCategory('system')}
            />
            <div className="space-y-1.5">
              {FILTER_OPTIONS.system.map((filterValue) => (
                <label key={filterValue} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFilters.includes(filterValue)}
                    onChange={() => handleFilterToggle(filterValue)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">{getFilterLabel(filterValue)}</span>
                </label>
              ))}
            </div>
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
                        <span className={`font-medium ${
                    log.action.startsWith('VERCEL_') ? 'text-blue-600' : ''
                  }`}>
                    {formatAction(log.action)}
                  </span>
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
                    {log.userEmail && log.userName && (
                      <span className="text-xs text-gray-500 ml-2">({log.userEmail})</span>
                    )}
                    {log.targetUserName && (
                      <>
                        {' → '}
                        <strong>{log.targetUserName || log.targetUserEmail}</strong>
                        {log.targetUserEmail && log.targetUserName && (
                          <span className="text-xs text-gray-500 ml-2">({log.targetUserEmail})</span>
                        )}
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
