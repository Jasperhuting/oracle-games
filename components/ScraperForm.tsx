'use client';

import { useState } from 'react';
import { KNOWN_RACE_SLUGS } from '@/lib/scraper/types';

interface ScraperFormProps {
  onSubmit?: (data: ScraperFormData) => void;
  loading?: boolean;
}

export interface ScraperFormData {
  race: string;
  year: number;
  type: 'startlist' | 'stage' | 'all-stages';
  stage?: number;
}

export default function ScraperForm({ onSubmit, loading = false }: ScraperFormProps) {
  const [formData, setFormData] = useState<ScraperFormData>({
    race: 'tour-de-france',
    year: new Date().getFullYear(),
    type: 'startlist',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const handleTypeChange = (type: 'startlist' | 'stage' | 'all-stages') => {
    setFormData(prev => ({
      ...prev,
      type,
      stage: type === 'stage' ? 1 : undefined,
    }));
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Cycling Data Scraper</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Race Selection */}
        <div>
          <label htmlFor="race" className="block text-sm font-medium text-gray-700 mb-1">
            Race
          </label>
          <select
            id="race"
            value={formData.race}
            onChange={(e) => setFormData(prev => ({ ...prev, race: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            {KNOWN_RACE_SLUGS.map(race => (
              <option key={race} value={race}>
                {race.split('-').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Year Selection */}
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <input
            id="year"
            type="number"
            min="2000"
            max={new Date().getFullYear() + 1}
            value={formData.year}
            onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data Type
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="startlist"
                checked={formData.type === 'startlist'}
                onChange={() => handleTypeChange('startlist')}
                className="mr-2 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Startlist</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="stage"
                checked={formData.type === 'stage'}
                onChange={() => handleTypeChange('stage')}
                className="mr-2 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Single Stage Result</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="all-stages"
                checked={formData.type === 'all-stages'}
                onChange={() => handleTypeChange('all-stages')}
                className="mr-2 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">All Stages (1-21)</span>
            </label>
          </div>
        </div>

        {/* Stage Number (only show for stage type) */}
        {formData.type === 'stage' && (
          <div>
            <label htmlFor="stage" className="block text-sm font-medium text-gray-700 mb-1">
              Stage Number
            </label>
            <input
              id="stage"
              type="number"
              min="1"
              max="25"
              value={formData.stage || 1}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                stage: parseInt(e.target.value) || 1 
              }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {loading ? 'Scraping...' : 'Start Scraping'}
        </button>
      </form>
    </div>
  );
}