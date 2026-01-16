'use client';

import { useState } from 'react';
import { Plus, Trash, Calendar } from 'tabler-icons-react';

interface Race {
  raceId: string;
  raceSlug: string;
  raceName: string;
  raceDate: string;
  pickDeadline: string;
  status: 'upcoming' | 'locked' | 'finished';
  order: number;
}

interface SlipstreamRaceManagerProps {
  gameId: string;
  races: Race[];
  onRacesChange?: () => void;
}

// Default classics calendar for 2026
const DEFAULT_RACES_2026 = [
  { raceSlug: 'omloop-het-nieuwsblad', raceName: 'Omloop Het Nieuwsblad', date: '2026-02-28' },
  { raceSlug: 'strade-bianche', raceName: 'Strade Bianche', date: '2026-03-07' },
  { raceSlug: 'milano-sanremo', raceName: 'Milano-Sanremo', date: '2026-03-21' },
  { raceSlug: 'e3-saxo-classic', raceName: 'E3 Saxo Classic', date: '2026-03-27' },
  { raceSlug: 'gent-wevelgem', raceName: 'Gent-Wevelgem', date: '2026-03-29' },
  { raceSlug: 'dwars-door-vlaanderen', raceName: 'Dwars door Vlaanderen', date: '2026-04-01' },
  { raceSlug: 'ronde-van-vlaanderen', raceName: 'Ronde van Vlaanderen', date: '2026-04-05' },
  { raceSlug: 'paris-roubaix', raceName: 'Paris-Roubaix', date: '2026-04-12' },
  { raceSlug: 'amstel-gold-race', raceName: 'Amstel Gold Race', date: '2026-04-19' },
  { raceSlug: 'la-fleche-wallonne', raceName: 'La Flèche Wallonne', date: '2026-04-22' },
  { raceSlug: 'liege-bastogne-liege', raceName: 'Liège-Bastogne-Liège', date: '2026-04-26' },
  { raceSlug: 'eschborn-frankfurt', raceName: 'Eschborn-Frankfurt', date: '2026-05-01' },
  { raceSlug: 'san-sebastian', raceName: 'Clásica San Sebastián', date: '2026-08-01' },
  { raceSlug: 'bretagne-classic', raceName: 'Bretagne Classic', date: '2026-08-30' },
  { raceSlug: 'gp-quebec', raceName: 'GP Québec', date: '2026-09-11' },
  { raceSlug: 'gp-montreal', raceName: 'GP Montréal', date: '2026-09-13' },
  { raceSlug: 'world-championship', raceName: 'World Championship', date: '2026-09-27' },
  { raceSlug: 'giro-dell-emilia', raceName: "Giro dell'Emilia", date: '2026-10-03' },
  { raceSlug: 'tre-valli-varesine', raceName: 'Tre Valli Varesine', date: '2026-10-06' },
  { raceSlug: 'milano-torino', raceName: 'Milano-Torino', date: '2026-10-07' },
  { raceSlug: 'il-lombardia', raceName: 'Il Lombardia', date: '2026-10-10' },
];

export function SlipstreamRaceManager({
  gameId,
  races,
  onRacesChange
}: SlipstreamRaceManagerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state for adding single race
  const [newRace, setNewRace] = useState({
    raceSlug: '',
    raceName: '',
    raceDate: ''
  });

  const addDefaultRaces = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const racesToAdd = DEFAULT_RACES_2026.map((race, index) => ({
        raceId: `${race.raceSlug}_2026`,
        raceSlug: race.raceSlug,
        raceName: race.raceName,
        raceDate: new Date(race.date + 'T10:00:00Z').toISOString(),
        order: index + 1
      }));

      const response = await fetch(`/api/games/${gameId}/slipstream/admin/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ races: racesToAdd })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add races');
      }

      setSuccess(`Added ${data.racesAdded} races (${data.duplicatesSkipped} duplicates skipped)`);
      onRacesChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add races');
    } finally {
      setLoading(false);
    }
  };

  const addSingleRace = async () => {
    if (!newRace.raceSlug || !newRace.raceName || !newRace.raceDate) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/slipstream/admin/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          races: [{
            raceId: `${newRace.raceSlug}_2026`,
            raceSlug: newRace.raceSlug,
            raceName: newRace.raceName,
            raceDate: new Date(newRace.raceDate).toISOString()
          }]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add race');
      }

      setSuccess(`Race added successfully`);
      setNewRace({ raceSlug: '', raceName: '', raceDate: '' });
      setShowAddForm(false);
      onRacesChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add race');
    } finally {
      setLoading(false);
    }
  };

  const deleteRace = async (raceSlug: string) => {
    if (!confirm(`Are you sure you want to remove this race?`)) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/slipstream/admin/races`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceSlug })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete race');
      }

      setSuccess(`Race removed`);
      onRacesChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete race');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Race Calendar ({races.length} races)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Race
            </button>
            {races.length === 0 && (
              <button
                onClick={addDefaultRaces}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add 2026 Classics'}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          {success}
        </div>
      )}

      {showAddForm && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Race slug (e.g. milano-sanremo)"
              value={newRace.raceSlug}
              onChange={e => setNewRace({ ...newRace, raceSlug: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Race name"
              value={newRace.raceName}
              onChange={e => setNewRace({ ...newRace, raceName: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={newRace.raceDate}
                onChange={e => setNewRace({ ...newRace, raceDate: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={addSingleRace}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 max-h-[300px] overflow-y-auto">
        {races.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No races configured yet.</p>
            <p className="text-sm mt-2">Click "Add 2026 Classics" to add the default calendar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...races].sort((a, b) => new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime()).map(race => (
              <div
                key={race.raceSlug}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div>
                  <div className="font-medium text-sm">{race.raceName}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(race.raceDate).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                      race.status === 'finished' ? 'bg-green-100 text-green-700' :
                      race.status === 'locked' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {race.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteRace(race.raceSlug)}
                  disabled={loading || race.status !== 'upcoming'}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-30"
                  title={race.status !== 'upcoming' ? 'Cannot delete non-upcoming races' : 'Delete race'}
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
