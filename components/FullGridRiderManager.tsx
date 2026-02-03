'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/Button';

interface RiderValue {
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  teamSlug: string;
  jerseyImage?: string;
  value: number;
  uciPoints?: number;
}

interface FullGridRiderManagerProps {
  gameId: string;
  onValuesChange?: () => void;
}

export function FullGridRiderManager({
  gameId,
  onValuesChange,
}: FullGridRiderManagerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [riders, setRiders] = useState<RiderValue[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [showOnlyUnset, setShowOnlyUnset] = useState(false);

  // Load rider data
  useEffect(() => {
    const loadRiders = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/games/${gameId}/full-grid/rider-values`);
        const data = await response.json();

        console.log(data);

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load rider values');
        }

        setRiders(data.riders || []);
        // Initialize edited values from current values
        const initialValues: Record<string, number> = {};
        data.riders.forEach((rider: RiderValue) => {
          initialValues[rider.riderNameId] = rider.value;
        });
        setEditedValues(initialValues);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rider values');
      } finally {
        setLoading(false);
      }
    };

    if (gameId) {
      loadRiders();
    }
  }, [gameId]);

  // Get unique teams for filter
  const teams = useMemo(() => {
    const uniqueTeams = new Set(riders.map(r => r.riderTeam).filter(Boolean));
    return Array.from(uniqueTeams).sort();
  }, [riders]);

  // Filter riders based on search, team, and unset filter
  const filteredRiders = useMemo(() => {
    return riders.filter(rider => {
      // Search filter
      if (searchTerm && !rider.riderName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Team filter
      if (selectedTeam !== 'all' && rider.riderTeam !== selectedTeam) {
        return false;
      }
      // Unset filter
      if (showOnlyUnset && (editedValues[rider.riderNameId] || 0) > 0) {
        return false;
      }
      return true;
    });
  }, [riders, searchTerm, selectedTeam, showOnlyUnset, editedValues]);

  // Group riders by team
  const ridersByTeam = useMemo(() => {
    const grouped: Record<string, RiderValue[]> = {};
    filteredRiders.forEach(rider => {
      const team = rider.riderTeam || 'Unknown Team';
      if (!grouped[team]) {
        grouped[team] = [];
      }
      grouped[team].push(rider);
    });
    return grouped;
  }, [filteredRiders]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalRiders = riders.length;
    const ridersWithValue = Object.values(editedValues).filter(v => v > 0).length;
    const totalValue = Object.values(editedValues).reduce((sum, v) => sum + (v || 0), 0);
    return {
      totalRiders,
      ridersWithValue,
      ridersWithoutValue: totalRiders - ridersWithValue,
      totalValue,
    };
  }, [riders, editedValues]);

  // Handle value change
  const handleValueChange = (riderNameId: string, value: string) => {
    const numValue = parseInt(value, 10) || 0;
    setEditedValues(prev => ({
      ...prev,
      [riderNameId]: numValue,
    }));
  };

  // Save all values
  const saveAllValues = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/games/${gameId}/full-grid/rider-values`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: user.uid,
          riderValues: editedValues,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save rider values');
      }

      setSuccess(`${data.totalRiders} renner waarden opgeslagen!`);
      onValuesChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rider values');
    } finally {
      setSaving(false);
    }
  };

  // Set all values to a specific number
  const setAllValues = (value: number) => {
    const newValues: Record<string, number> = {};
    riders.forEach(rider => {
      newValues[rider.riderNameId] = value;
    });
    setEditedValues(newValues);
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return riders.some(rider => rider.value !== editedValues[rider.riderNameId]);
  }, [riders, editedValues]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Laden...</span>
      </div>
    );
  }

  if (riders.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-yellow-800">
          Geen renners gevonden. Zorg dat je eerst de race lineup hebt ingesteld via de
          &quot;Manage Race Lineup&quot; sectie.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Renner Waarden Beheer</h3>
            <p className="text-sm text-gray-500">
              {stats.ridersWithValue} van {stats.totalRiders} renners hebben een waarde
              {stats.ridersWithoutValue > 0 && (
                <span className="text-orange-600 ml-1">
                  ({stats.ridersWithoutValue} nog in te stellen)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              text={saving ? 'Opslaan...' : 'Alles Opslaan'}
              onClick={saveAllValues}
              disabled={saving || !hasUnsavedChanges}
              className={`px-4 py-2 ${hasUnsavedChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'}`}
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Snel instellen:</span>
          {[1, 2, 3, 4, 5].map(val => (
            <button
              key={val}
              onClick={() => setAllValues(val)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Alles op {val}
            </button>
          ))}
          <button
            onClick={() => setAllValues(0)}
            className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md"
          >
            Alles wissen
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Zoek renner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Team filter */}
          <div>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Alle ploegen ({riders.length})</option>
              {teams.map(team => (
                <option key={team} value={team}>
                  {team} ({riders.filter(r => r.riderTeam === team).length})
                </option>
              ))}
            </select>
          </div>

          {/* Show only unset */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyUnset}
              onChange={(e) => setShowOnlyUnset(e.target.checked)}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <span className="text-sm text-gray-700">Alleen zonder waarde</span>
          </label>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <span className="text-green-700 text-sm">{success}</span>
        </div>
      )}

      {/* Riders table grouped by team */}
      <div className="space-y-4">
        {Object.entries(ridersByTeam)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([teamName, teamRiders]) => (
            <div key={teamName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Team header */}
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {teamRiders[0]?.jerseyImage && (
                    <img
                      src={teamRiders[0].jerseyImage}
                      alt={teamName}
                      className="w-6 h-6 object-contain"
                    />
                  )}
                  <span className="font-medium text-gray-900">{teamName}</span>
                  <span className="text-sm text-gray-500">({teamRiders.length} renners)</span>
                </div>
                <div className="text-sm text-gray-500">
                  Totaal: {teamRiders.reduce((sum, r) => sum + (editedValues[r.riderNameId] || 0), 0)} pts
                </div>
              </div>

              {/* Riders */}
              <div className="divide-y divide-gray-100">
                {teamRiders.map(rider => (
                  <div
                    key={rider.riderNameId}
                    className="px-4 py-2 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-900">{rider.riderName}</span>
                      {rider.uciPoints !== undefined && (
                        <span className="text-xs text-gray-400">
                          ({rider.uciPoints} UCI pts)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editedValues[rider.riderNameId] || 0}
                        onChange={(e) => handleValueChange(rider.riderNameId, e.target.value)}
                        className={`w-16 px-2 py-1 text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                          (editedValues[rider.riderNameId] || 0) === 0
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-gray-300'
                        }`}
                      />
                      <span className="text-sm text-gray-500 w-8">pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {filteredRiders.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
          <p className="text-gray-500">Geen renners gevonden met de huidige filters.</p>
        </div>
      )}

      {/* Bottom save button */}
      {filteredRiders.length > 0 && (
        <div className="flex justify-end">
          <Button
            text={saving ? 'Opslaan...' : 'Alle Waarden Opslaan'}
            onClick={saveAllValues}
            disabled={saving || !hasUnsavedChanges}
            className={`px-6 py-2 ${hasUnsavedChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'}`}
          />
        </div>
      )}
    </div>
  );
}
