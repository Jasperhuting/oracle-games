'use client';

import { useState, useMemo, useEffect } from 'react';
import { PlayerRow } from '@/components/PlayerRow';
import { Selector } from '@/components/Selector';
import { normalizeString } from '@/lib/utils/stringUtils';
import { Rider } from '@/lib/scraper/types';

interface SlipstreamRiderSelectorProps {
  riders: Rider[];
  usedRiderIds: string[];
  selectedRider: Rider | null;
  onSelect: (rider: Rider | null) => void;
  disabled?: boolean;
}

export function SlipstreamRiderSelector({
  riders,
  usedRiderIds,
  selectedRider,
  onSelect,
  disabled = false
}: SlipstreamRiderSelectorProps) {
  const [selectedItems, setSelectedItems] = useState<Rider[]>(
    selectedRider ? [selectedRider] : []
  );

  // Sync internal state with prop when selectedRider changes
  useEffect(() => {
    if (selectedRider) {
      setSelectedItems([selectedRider]);
    } else {
      setSelectedItems([]);
    }
  }, [selectedRider]);

  const availableRiders = useMemo(() => {
    return riders.filter(rider => {
      const riderId = rider.id || (rider as { nameID?: string }).nameID || '';
      return !usedRiderIds.includes(riderId);
    });
  }, [riders, usedRiderIds]);

  const handleSelect = (items: Rider[]) => {
    setSelectedItems(items);
    onSelect(items[0] || null);
  };

  if (disabled) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-gray-500">
        <p className="text-sm">Pick selection is disabled</p>
        {selectedRider && (
          <div className="mt-2">
            <span className="font-medium">Current pick:</span> {selectedRider.name}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {availableRiders.length} riders available ({usedRiderIds.length} already used)
        </span>
      </div>
      
      <Selector<Rider>
        items={availableRiders}
        selectedItems={selectedItems}
        setSelectedItems={handleSelect}
        multiSelect={false}
        placeholder="Search for a rider..."
        getItemLabel={(rider) => rider.name || ''}
        searchFilter={(rider, searchTerm) => {
          const normalizedSearch = normalizeString(searchTerm);
          const lowerSearch = searchTerm.toLowerCase();

          return !!(
            normalizeString(rider?.name || '').includes(normalizedSearch) ||
            normalizeString(rider?.team?.name || '').includes(normalizedSearch) ||
            rider?.country?.toLowerCase().includes(lowerSearch)
          );
        }}
        isEqual={(r1, r2) => {
          const id1 = r1.id || (r1 as { nameID?: string }).nameID || r1.name;
          const id2 = r2.id || (r2 as { nameID?: string }).nameID || r2.name;
          return id1 === id2;
        }}
        renderItem={(rider, index, isSelected) => (
          <PlayerRow
            showPoints={true}
            showRank={true}
            selectedPlayer={isSelected}
            player={rider}
            selectPlayer={() => {}}
            index={false}
            fullWidth={true}
          />
        )}
        renderSelectedItem={(rider, _index, onRemove) => (
          <PlayerRow
            showRank={true}
            showPoints={true}
            showButton={false}
            player={rider}
            selectPlayer={onRemove}
            index={false}
            fullWidth={true}
          />
        )}
      />

      {usedRiderIds.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Show used riders ({usedRiderIds.length})
          </summary>
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 max-h-32 overflow-y-auto">
            {usedRiderIds.map((id, i) => {
              const rider = riders.find(r => (r.id || (r as { nameID?: string }).nameID) === id);
              return (
                <span key={id} className="inline-block mr-2 mb-1">
                  {rider?.name || id}{i < usedRiderIds.length - 1 ? ',' : ''}
                </span>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
