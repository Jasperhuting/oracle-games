'use client'

import { useState } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";

export const RacesScraperTab = () => {
  const { user } = useAuth();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleScrapeRaces = async () => {
    if (!user) return;

    setScraping(true);
    setMessage(null);

    try {
      const response = await fetch('/api/scraper/races', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          year,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message || `Successfully scraped ${data.racesScraped} races for ${year}`,
        });
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to scrape races',
        });
      }
    } catch (error) {
      console.error('Error scraping races:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while scraping races',
      });
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-4">Scrape Races from ProCyclingStats</h2>
      
      <p className="text-gray-600 mb-6">
        This tool will scrape all races from ProCyclingStats for the selected year and save them to the database.
        These races can then be selected in the game configuration to determine which races count for points.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Year
          </label>
          <input
            type="number"
            min="2020"
            max={new Date().getFullYear() + 1}
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-full max-w-xs px-3 py-2 border cursor-pointer border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={scraping}
          />
        </div>

        <div>
          <Button
            text={scraping ? "Scraping..." : "Scrape Races"}
            onClick={handleScrapeRaces}
            disabled={scraping}
            className="px-6 py-2"
          />
        </div>

        {message && (
          <div
            className={`p-4 rounded-md ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <p
              className={`text-sm ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold mb-3">How it works</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
          <li>Scrapes all races from ProCyclingStats for the selected year</li>
          <li>Saves race information including: name, slug, dates, classification, and country</li>
          <li>Races are stored in the database with ID format: slug_year (e.g., &quot;tour-de-france_2025&quot;)</li>
          <li>These races can then be selected when editing an Auctioneer game</li>
          <li>You can specify which stages count and apply points multipliers per race</li>
        </ul>
      </div>

      {/* Note about saving stage results */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2 text-blue-900">💡 Save Stage Results</h3>
          <p className="text-sm text-blue-800">
            To save stage results and calculate points, go to the <strong>&quot;Races&quot;</strong> tab, 
            select a race, click on <strong>&quot;Etappes&quot;</strong>, and use the &quot;Add Stage&quot; form.
          </p>
          <p className="text-sm text-blue-800 mt-2">
            This will automatically scrape the stage results and calculate points for all affected Auctioneer games.
          </p>
        </div>
      </div>
    </div>
  );
};
