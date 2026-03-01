'use client';

import { useMemo, useState } from 'react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';

export interface SelectedGif {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
}

interface RawGiphyGif {
  id?: string;
  title?: string;
  url?: string;
  images?: {
    fixed_height?: { webp?: string; url?: string; width?: string | number; height?: string | number };
    downsized_medium?: { url?: string; width?: string | number; height?: string | number };
    original?: { url?: string; width?: string | number; height?: string | number };
  };
}

interface GiphyPickerProps {
  onSelect: (gif: SelectedGif) => void;
  width?: number;
}

function toNumber(value?: string | number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGif(gif: RawGiphyGif): SelectedGif | null {
  const fixed = gif.images?.fixed_height;
  const downsized = gif.images?.downsized_medium;
  const original = gif.images?.original;

  const url = fixed?.webp || downsized?.url || original?.url || gif.url || '';
  const previewUrl = fixed?.webp || fixed?.url || downsized?.url || original?.url || url;
  const width = toNumber(fixed?.width) ?? toNumber(downsized?.width) ?? toNumber(original?.width);
  const height = toNumber(fixed?.height) ?? toNumber(downsized?.height) ?? toNumber(original?.height);

  if (!gif.id || !url) return null;

  return {
    id: gif.id,
    title: gif.title || 'GIF',
    url,
    previewUrl,
    width,
    height,
  };
}

export default function GiphyPicker({ onSelect, width = 320 }: GiphyPickerProps) {
  const [query, setQuery] = useState('');
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY || '';
  const gf = useMemo(() => (apiKey ? new GiphyFetch(apiKey) : null), [apiKey]);

  const fetchGifs = (offset: number) => {
    if (!gf) {
      return Promise.resolve({
        data: [],
        pagination: { total_count: 0, count: 0, offset },
        meta: { status: 200, msg: 'No API key', response_id: 'no-api-key' },
      });
    }

    if (query.trim()) {
      return gf.search(query.trim(), { offset, limit: 20, rating: 'pg-13', lang: 'nl' });
    }

    return gf.trending({ offset, limit: 20, rating: 'pg-13' });
  };

  if (!apiKey) {
    return (
      <div className="w-80 max-w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        GIPHY is nog niet geconfigureerd. Zet `NEXT_PUBLIC_GIPHY_API_KEY` in je env.
      </div>
    );
  }

  return (
    <div className="w-80 max-w-full rounded-xl border border-gray-200 bg-white shadow-xl">
      <div className="border-b border-gray-200 p-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek GIF..."
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="max-h-96 overflow-y-auto p-2">
        <Grid
          key={query || 'trending'}
          width={width}
          columns={2}
          gutter={6}
          noLink
          hideAttribution
          fetchGifs={fetchGifs}
          onGifClick={(gif, event) => {
            event.preventDefault();
            const normalized = normalizeGif(gif as RawGiphyGif);
            if (normalized) onSelect(normalized);
          }}
          onGifRightClick={(gif, event) => {
            event.preventDefault();
            const normalized = normalizeGif(gif as RawGiphyGif);
            if (normalized) onSelect(normalized);
          }}
        />
      </div>
    </div>
  );
}
