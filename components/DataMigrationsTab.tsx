'use client'

import { useState } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";

export const DataMigrationsTab = () => {
  const { user } = useAuth();
  const [gameId, setGameId] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMigrateParticipantTeams = async () => {
    if (!user || !gameId.trim()) {
      setError('Please enter a game ID');
      return;
    }

    setMigrating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/games/${gameId.trim()}/migrate-participant-teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      setResult(data);
    } catch (error: any) {
      console.error('Error running migration:', error);
      setError(error.message || 'Failed to run migration');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Data Migrations</h2>
        <p className="text-sm text-gray-600 mb-6">
          Run one-time data migrations to fix or update data structures.
        </p>

        {/* Migration: Fix Participant Teams */}
        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold mb-2">Fix Participant Team Data</h3>
          <p className="text-sm text-gray-600 mb-4">
            Migrates participant team arrays to use <code className="bg-gray-100 px-1 rounded">pricePaid</code> instead of <code className="bg-gray-100 px-1 rounded">amount</code>.
            This fixes the issue where sold rider prices don't display correctly in the auction page.
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="gameId" className="block text-sm font-medium text-gray-700 mb-1">
                Game ID
              </label>
              <input
                id="gameId"
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="Enter game ID (e.g., abc123)"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={migrating}
              />
            </div>

            <Button
              onClick={handleMigrateParticipantTeams}
              disabled={migrating || !gameId.trim()}
              text={migrating ? "Running migration..." : "Run Migration"}
              className="w-full"
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-700 text-sm font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-700 text-sm font-medium mb-2">Migration Complete</p>
            <div className="text-sm text-gray-700 space-y-1">
              <p><strong>Total participants:</strong> {result.total}</p>
              <p><strong>Updated:</strong> {result.updated}</p>
              <p><strong>Skipped:</strong> {result.skipped}</p>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-600 font-medium">Errors:</p>
                  <ul className="list-disc list-inside text-red-600">
                    {result.errors.map((err: string, idx: number) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ How to use</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Find the game ID from the URL or games list</li>
          <li>Enter the game ID in the field above</li>
          <li>Click "Run Migration" to update all participants in that game</li>
          <li>The migration will rename the <code className="bg-blue-100 px-1 rounded">amount</code> field to <code className="bg-blue-100 px-1 rounded">pricePaid</code> in team arrays</li>
          <li>Refresh the auction page to see the updated prices</li>
        </ol>
      </div>
    </div>
  );
};
