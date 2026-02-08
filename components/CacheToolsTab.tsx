import { useState } from "react";
import { Button } from "@/components/Button";
import { incrementCacheVersion } from "@/lib/utils/cacheVersion";

export function CacheToolsTab() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBumpVersion = async () => {
    try {
      setError(null);
      setIsUpdating(true);
      await incrementCacheVersion();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to increment cache version';
      setError(message);
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Cache tools</h2>
        <p className="text-sm text-gray-600">
          Hiermee kun je de rankings-cache ongeldig maken voor alle gebruikers.
          Gebruik dit als je ziet dat team- of rennersdata niet klopt.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      <Button onClick={handleBumpVersion} disabled={isUpdating}>
        {isUpdating ? 'Bezig met verversen...' : 'Rankings-cache verversen (alle users)'}
      </Button>
    </div>
  );
}
