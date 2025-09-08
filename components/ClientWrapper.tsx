'use client';

import { useState, useEffect } from 'react';
import { AdminPanel } from './AdminPanel';
import { useDataRefresh } from '../hooks/useDataRefresh';

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [showAdmin, setShowAdmin] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  

  const { isChecking, error, checkNow } = useDataRefresh({
    pollingInterval: 3000,
    enableAutoPolling: true,
    onDataChanged: (changedFiles) => {
      console.log('Data changed detected:', changedFiles);
      setRefreshMessage(`Data updated for: ${changedFiles.join(', ')}`);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  });

  useEffect(() => {
    if (refreshMessage) {
      const timer = setTimeout(() => setRefreshMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [refreshMessage]);

  // Show admin panel with Ctrl+A (or Cmd+A on Mac)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.shiftKey) {
        e.preventDefault();
        setShowAdmin(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div>
      {/* Status Bar */}
      <div className="fixed top-0 right-0 p-4 z-50">
        <div className="flex items-center gap-2">
          {isChecking && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
          )}
          
          
          <button
            onClick={checkNow}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors"
            title="Check for updates now"
          >
            🔍
          </button>
          
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors"
            title="Toggle admin panel (Ctrl+Shift+A)"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Refresh Notification */}
      {refreshMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg animate-pulse">
          {refreshMessage} - Refreshing page...
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg">
          Error checking for updates: {error}
        </div>
      )}

      {/* Main Content */}
      {children}

      {/* Admin Panel */}
      {showAdmin && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Admin Panel</h2>
              <button
                onClick={() => setShowAdmin(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <AdminPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}