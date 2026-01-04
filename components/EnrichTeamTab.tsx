'use client'

import { useState } from 'react';
import { incrementCacheVersionClient } from '@/lib/utils/auctionCache';

interface EnrichTeamFormData {
  team: string;
  year: number;
}

export function EnrichTeamTab() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EnrichTeamFormData>({
    team: '',
    year: 2026,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.team) {
      setMessage({ type: 'error', text: 'Team slug is verplicht' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/enrich-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enrich team');
      }

      setMessage({
        type: 'success',
        text: `Team ${data.teamName || formData.team} succesvol verrijkt! ${data.ridersCount || 0} renners toegevoegd.`
      });

      // Increment cache version to invalidate all caches
      if (data.cacheInvalidated) {
        incrementCacheVersionClient();
      }

      // Reset form
      setFormData({
        team: '',
        year: 2026,
      });
    } catch (error) {
      console.error('Error enriching team:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to enrich team' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Verrijk Team Data</h2>

      <p className="text-sm text-gray-600 mb-6">
        Haal team informatie op van ProCyclingStats en update de database met renners, jersey afbeeldingen en team statistieken.
      </p>

      {message && (
        <div className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Slug *
            </label>
            <input
              type="text"
              value={formData.team}
              onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              required
              placeholder="team-visma-lease-a-bike"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Bijvoorbeeld: team-visma-lease-a-bike (het deel na procyclingstats.com/team/)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jaar *
            </label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 2026 })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? 'Verrijken...' : 'Verrijk Team'}
          </button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Wat doet deze functie?</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Haalt team informatie op van ProCyclingStats</li>
          <li>Update team gegevens (naam, land, klasse, ranks, punten)</li>
          <li>Haalt jersey afbeeldingen op</li>
          <li>Update renner informatie (jersey afbeeldingen, leeftijden)</li>
        </ul>
      </div>
    </div>
  );
}
