'use client'

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "../Button";
import { ConfirmDialog } from "../ConfirmDialog";

export const FixCorruptedTeamData = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fixTeamData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/fix-corrupted-team-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fix team data');
      }

      const data = await response.json();
      setResult(data);
    } catch (error: unknown) {
      console.error('Error fixing team data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fix team data';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Fix Corrupted Team Data
        </h2>
        <p className="text-sm text-gray-600">
          This tool fixes corrupted team data in gameParticipants collection by reconstructing 
          team arrays from the playerTeams collection. This addresses the "[object Object]" 
          corruption issue.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {result && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
          <h3 className="text-green-800 font-medium mb-2">Fix Completed Successfully!</h3>
          <div className="text-green-700 text-sm space-y-1">
            <p>• Total corrupted participants found: {result.totalCorrupted}</p>
            <p>• Successfully fixed: {result.fixedCount}</p>
            <p>• Errors: {result.errorCount}</p>
            {result.fixedDetails && result.fixedDetails.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">View Fixed Participants</summary>
                <div className="mt-2 pl-4 space-y-1">
                  {result.fixedDetails.map((detail: any, index: number) => (
                    <div key={index} className="text-xs">
                      • {detail.playername}: {detail.ridersReconstructed} riders reconstructed
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          text={loading ? "Fixing..." : "Fix Corrupted Team Data"}
          onClick={() => setConfirmOpen(true)}
          disabled={loading}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white"
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={fixTeamData}
        title="Fix Corrupted Team Data"
        description="This will scan for and fix all corrupted team data in the gameParticipants collection. The action will reconstruct team arrays from the playerTeams collection. This cannot be undone. Are you sure you want to continue?"
        confirmText="Fix Data"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
};
