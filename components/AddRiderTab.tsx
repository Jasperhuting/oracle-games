'use client'

import { useState, useEffect } from 'react';
import { incrementCacheVersionClient } from '@/lib/utils/auctionCache';
import { CountrySelector } from './CountrySelector';
import { Country } from '@/lib/scraper/types';
import countriesList from '@/lib/country.json';

interface RiderFormData {
  name: string;
  firstName: string;
  lastName: string;
  nameID: string;
  country: string;
  team: string;
  points: number;
  rank: number;
  year: number;
  age?: string; // Date string in YYYY-MM-DD format
}

export function AddRiderTab() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [formData, setFormData] = useState<RiderFormData>({
    name: '',
    firstName: '',
    lastName: '',
    nameID: '',
    country: '',
    team: '',
    points: 0,
    rank: 0,
    year: 2026,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [suggestedRank, setSuggestedRank] = useState<number | null>(null);

  // Fetch next available rank when year changes
  useEffect(() => {
    const fetchNextRank = async () => {
      try {
        const response = await fetch(`/api/get-next-available-rank?year=${formData.year}`);
        const data = await response.json();
        if (response.ok) {
          setSuggestedRank(data.nextAvailableRank);
          // Auto-set rank if it's still 0
          if (formData.rank === 0) {
            setFormData(prev => ({ ...prev, rank: data.nextAvailableRank }));
          }
        }
      } catch (error) {
        console.error('Error fetching next available rank:', error);
      }
    };

    fetchNextRank();
  }, [formData.year]);

  const handleScrape = async () => {
    if (!url) {
      setMessage({ type: 'error', text: 'Vul een ProCyclingStats URL in' });
      return;
    }

    setScraping(true);
    setMessage(null);

    try {
      const response = await fetch('/api/scrape-rider-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape rider data');
      }

      // Fill form with scraped data
      // Use suggestedRank if scraped rank is 0 or invalid
      const rankToUse = (data.rank && data.rank > 0 && data.rank < 9900) ? data.rank : (suggestedRank || 9999);

      setFormData({
        name: data.name || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        nameID: data.nameID || '',
        country: data.country || '',
        team: data.team || '',
        points: data.points || 0,
        rank: rankToUse,
        year: formData.year,
        age: data.age || '',
      });

      setMessage({ type: 'success', text: 'Data succesvol opgehaald! Controleer de velden en klik op "Voeg toe aan database"' });
    } catch (error) {
      console.error('Error scraping:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to scrape rider data' });
    } finally {
      setScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/add-rider-to-ranking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add rider');
      }

      const gamesMessage = data.addedToGames > 0
        ? ` en ${data.addedToGames} seasonal game(s)`
        : '';
      setMessage({
        type: 'success',
        text: `${formData.name} succesvol toegevoegd aan rankings_${formData.year}${gamesMessage}!`
      });

      // Increment cache version to invalidate all caches
      if (data.cacheInvalidated) {
        incrementCacheVersionClient();
      }

      // Reset form and fetch new suggested rank
      setUrl('');
      setFormData({
        name: '',
        firstName: '',
        lastName: '',
        nameID: '',
        country: '',
        team: '',
        points: 0,
        rank: 0,
        year: 2026,
      });

      // Refresh suggested rank
      const rankResponse = await fetch(`/api/get-next-available-rank?year=${formData.year}`);
      const rankData = await rankResponse.json();
      if (rankResponse.ok) {
        setSuggestedRank(rankData.nextAvailableRank);
      }
    } catch (error) {
      console.error('Error adding rider:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to add rider' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Voeg Renner toe aan Rankings</h2>

      {message && (
        <div className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* URL Scraper Section */}
      <div className="mb-8 p-4 border border-gray-200 rounded">
        <h3 className="text-lg font-semibold mb-3">Stap 1: Scrape data van ProCyclingStats (optioneel)</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.procyclingstats.com/rider/titouan-fontaine"
            className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {scraping ? 'Laden...' : 'Scrape Data'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Plak de ProCyclingStats URL van de renner om automatisch de data op te halen
        </p>
      </div>

      {/* Manual Form Section */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold mb-3">Stap 2: Controleer/Vul de gegevens in</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Volledige Naam *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voornaam *
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Achternaam *
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name ID (URL slug) *
            </label>
            <input
              type="text"
              value={formData.nameID}
              onChange={(e) => setFormData({ ...formData, nameID: e.target.value })}
              required
              placeholder="titouan-fontaine"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Land *
            </label>
            <CountrySelector
              selectedCountries={
                formData.country
                  ? countriesList.filter((c: Country) => c.code?.toLowerCase() === formData.country.toLowerCase())
                  : []
              }
              setSelectedCountries={(countries: Country[]) => {
                // Extraheer de code van het geselecteerde land
                const countryCode = countries.length > 0 ? countries[0].code : '';
                setFormData({ ...formData, country: countryCode });
              }}
              multiSelect={false}
              multiSelectShowSelected={false}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team (slug)
            </label>
            <input
              type="text"
              value={formData.team}
              onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              placeholder="team-visma-lease-a-bike"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PCS Punten *
            </label>
            <input
              type="number"
              value={formData.points}
              onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pcs Rank * {suggestedRank && <span className="text-gray-500 font-normal">(Volgende beschikbare: {suggestedRank})</span>}
            </label>
            <input
              type="number"
              value={formData.rank}
              onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) || 0 })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Geboortedatum (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={formData.age || ''}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
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
            {loading ? 'Toevoegen...' : 'Voeg toe aan database'}
          </button>
        </div>
      </form>
    </div>
  );
}
