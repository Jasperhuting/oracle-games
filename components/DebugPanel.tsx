'use client';

import { useState } from 'react';

export function DebugPanel() {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const cacheBuster = `?_t=${Date.now()}`;
      const response = await fetch(`/api/metadata${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      const data = await response.json();
      setMetadata(data);
    } catch (error) {
      setMetadata({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const checkSpecificRace = async (race: string) => {
    setLoading(true);
    try {
      const cacheBuster = `_t=${Date.now()}`;
      const response = await fetch(`/api/metadata?race=${race}&${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      const data = await response.json();
      setMetadata({ [race]: data });
    } catch (error) {
      setMetadata({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-6 bg-gray-50">
      <h2 className="text-xl font-semibold mb-4">Debug Panel</h2>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={fetchMetadata}
          disabled={loading}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded text-sm"
        >
          {loading ? 'Loading...' : 'Check All Files'}
        </button>
        
        <button
          onClick={() => checkSpecificRace('tour-de-france')}
          disabled={loading}
          className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded text-sm"
        >
          Check Tour de France
        </button>

        <button
          onClick={() => setMetadata(null)}
          className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
        >
          Clear
        </button>
      </div>

      {metadata && (
        <div className="bg-white rounded border p-4">
          <h3 className="font-semibold mb-2">Metadata Response:</h3>
          <pre className="text-xs overflow-auto max-h-96 bg-gray-100 p-3 rounded">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}