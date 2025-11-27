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
        setError(error.message || 'Kon activiteiten niet laden');
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
      return new Date(dateString).toLocaleString('nl-NL', {
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
      'USER_REGISTERED': 'Gebruiker Geregistreerd',
      'USER_BLOCKED': 'Gebruiker Geblokkeerd',
      'USER_UNBLOCKED': 'Gebruiker Gedeblokkeerd',
      'USER_PROFILE_UPDATED': 'Profiel Bijgewerkt',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'USER_REGISTERED': 'bg-green-100 text-green-800',
      'USER_BLOCKED': 'bg-red-100 text-red-800',
      'USER_UNBLOCKED': 'bg-blue-100 text-blue-800',
      'USER_PROFILE_UPDATED': 'bg-yellow-100 text-yellow-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const renderDetails = (log: ActivityLog) => {
    if (!log.details) return null;

    if (log.action === 'USER_PROFILE_UPDATED' && log.details.changes) {
      const changes = log.details.changes;
      return (
        <div className="mt-2 space-y-1">
          {Object.entries(changes).map(([field, value]: [string, any]) => (
            <div key={field} className="text-xs text-gray-600 flex items-center gap-2">
              <span className="font-medium capitalize">{field}:</span>
              <span className="text-gray-400">{value.old || '(leeg)'}</span>
              <span className="text-gray-400">→</span>
              <span className="text-gray-900 font-medium">{value.new || '(leeg)'}</span>
            </div>
          ))}
        </div>
      );
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
        <div className="text-gray-600">Activiteiten laden...</div>
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
            <h2 className="text-xl font-semibold">Activiteiten Log</h2>
            <p className="text-sm text-gray-600">
              {filteredLogs.length} van {logs.length} activiteiten
            </p>
          </div>
          <div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Alle activiteiten</option>
              <option value="USER_REGISTERED">Registraties</option>
              <option value="USER_BLOCKED">Geblokkeerd</option>
              <option value="USER_UNBLOCKED">Gedeblokkeerd</option>
              <option value="USER_PROFILE_UPDATED">Profiel Updates</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-200">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Geen activiteiten gevonden
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 flex-row flex gap-2 justify-between">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    <div className="flex flex-row items-center gap-2">
                    <div className="text-sm text-gray-900">
                      <strong>{log.userName || log.userEmail}</strong>
                      {log.targetUserName && (
                        <>
                          {' → '}
                          <strong>{log.targetUserName || log.targetUserEmail}</strong>
                        </>
                      )}
                    </div>

                    {renderDetails(log)}

                    {log.ipAddress && log.ipAddress !== 'unknown' && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          {log.ipAddress === '::1' || log.ipAddress === '127.0.0.1' ? 'localhost' : log.ipAddress}
                        </span>
                      </div>
                    )}
                    </div>
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
