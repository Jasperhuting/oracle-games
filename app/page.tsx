"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { StageList } from "../components/StageList";
import { AdminPanel } from "../components/AdminPanel";
import { useDataRefresh } from "../hooks/useDataRefresh";
import { ScraperRunner } from "@/components/ScraperRunner";
import { Bike } from "./bike";

type Startlist = {
  race: string;
  year: number;
  source: string;
  count: number;
  riders: Team[];
};

type Team = {
  image: string;
  name: string;
  shortName: string;
  riders: Rider[];
};

type Rider = {
  name: string;
  country: string; // ISO-2
  number: string;
  dropout?: boolean;
};

const YEAR = 2025;
const BASE = "https://jasperhuting.github.io/oracle-games-scraper/output";
const RACES = [
  "tour-de-france",
  "giro-d-italia",
  "vuelta-a-espana",
  "world-championship",
  "liege-bastogne-liege",
  "paris-roubaix",
  "tour-of-flanders",
  "milan-sanremo",
  "il-lombardia"
] as const;
type Race = typeof RACES[number];

const urlFor = (race: Race) => `${BASE}/startlist-${race}-${YEAR}.json`;

// Convert ISO-2 country code to flag emoji
function iso2ToFlag(code: string): string {
  if (!code || code.length !== 2) return code;
  const A = 0x1f1e6; // Regional Indicator Symbol Letter A
  const asciiA = 65; // 'A'
  const [c1, c2] = code.toUpperCase();
  return String.fromCodePoint(
    A + (c1.charCodeAt(0) - asciiA),
    A + (c2.charCodeAt(0) - asciiA)
  );
}

async function fetchStartlist(race: Race): Promise<{
  race: Race;
  data: Startlist | null;
  error: string | null;
}> {
  try {
    const cacheBustedUrl = `${urlFor(race)}?_cb=${Math.floor(Date.now() / (5 * 60 * 1000))}`;
    const res = await fetch(cacheBustedUrl, {
      mode: 'cors',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    if (!res.ok) {
      if (res.status === 404) {
        return { race, data: null, error: 'Race data not available yet' };
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const json = (await res.json()) as Startlist;
    return { race, data: json, error: null };
  } catch (e: any) {
    if (e?.message?.includes('CORS')) {
      return { race, data: null, error: 'Race data not available yet' };
    }
    if (e?.message?.includes('Failed to fetch')) {
      return { race, data: null, error: 'Network error - please check connection' };
    }
    return { race, data: null, error: e?.message ?? "Unknown error" };
  }
}

function formatRaceName(race: Race): string {
  return race
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function Home() {
  const [activeRace, setActiveRace] = useState<Race>(RACES[0]);
  const [raceData, setRaceData] = useState<{ [key in Race]?: { data: Startlist | null; error: string | null } }>({});
  const [loading, setLoading] = useState<{ [key in Race]?: boolean }>({});
  const [showAdmin, setShowAdmin] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);

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

  const loadRaceData = useCallback(async (race: Race) => {
    if (raceData[race] || loading[race]) return;

    setLoading(prev => ({ ...prev, [race]: true }));
    const result = await fetchStartlist(race);
    setRaceData(prev => ({
      ...prev,
      [race]: { data: result.data, error: result.error }
    }));
    setLoading(prev => ({ ...prev, [race]: false }));
  }, [raceData, loading]);

  useEffect(() => {
    loadRaceData(activeRace);
  }, [activeRace, loadRaceData]);

  useEffect(() => {
    if (refreshMessage) {
      const timer = setTimeout(() => setRefreshMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [refreshMessage]);

  // Show admin panel with Ctrl+Shift+A (or Cmd+Shift+A on Mac)
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

  const currentData = raceData[activeRace];

  const bikeColor = 'red';

  return (
    <div>
      test
      <div style={{ margin: '8px 0' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          <span>Show SVG grid</span>
        </label>
      </div>
      {/* <svg viewBox="0 0 300 300" className="w-50">  */}
      <svg viewBox="0 0 300 300" className="w-[800px]">
        <defs>
          <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#888" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <rect width="50" height="50" fill="url(#smallGrid)" />
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#666" strokeWidth="1" />
          </pattern>
        </defs>
        {showGrid && (
          <>
            <rect className="dev-grid" width="100%" height="100%" fill="url(#grid)" />
            <g className="dev-grid-labels">
              {Array.from({ length: 7 }, (_, i) => i * 50).map((x) => (
                <text
                  key={`x-${x}`}
                  x={x}
                  y={10}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                >
                  {x}
                </text>
              ))}
              {Array.from({ length: 7 }, (_, i) => i * 50).map((y) => (
                <text
                  key={`y-${y}`}
                  x={4}
                  y={y}
                  textAnchor="start"
                  dominantBaseline="middle"
                >
                  {y}
                </text>
              ))}
            </g>
          </>
        )}

        <Bike bikeColor={"red"} count={1} />

        <style>
          {`
    
         .dev-grid {
        pointer-events: none;
        opacity: 0.25;
        mix-blend-mode: multiply;
      }
      .dev-grid-labels {
        pointer-events: none;
        font-size: 8px;
        fill: #444;
        user-select: none;
      }
    `}
        </style>

      </svg>

    </div>
  );
}
