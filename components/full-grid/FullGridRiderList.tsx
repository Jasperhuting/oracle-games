'use client';

import { Check, Plus } from 'tabler-icons-react';
import { Button } from '@/components/Button';

interface RiderData {
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  teamSlug: string;
  jerseyImage?: string;
  value: number;
  country?: string;
}

interface FullGridRiderListProps {
  riders: RiderData[];
  selectedTeam: string | null;
  isRiderSelected: (riderNameId: string) => boolean;
  teamHasSelection: boolean;
  canSelect: boolean;
  budgetRemaining: number;
  onSelectRider: (rider: RiderData) => void;
  saving: boolean;
}

export function FullGridRiderList({
  riders,
  selectedTeam,
  isRiderSelected,
  teamHasSelection,
  canSelect,
  budgetRemaining,
  onSelectRider,
  saving,
}: FullGridRiderListProps) {
  if (!selectedTeam) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Selecteer een ploeg om renners te zien</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">{selectedTeam}</h2>
        <p className="text-sm text-gray-500">
          {riders.length} renners beschikbaar
          {teamHasSelection && (
            <span className="text-green-600 ml-2">(al een selectie)</span>
          )}
        </p>
      </div>

      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {riders.map((rider) => {
          const isSelected = isRiderSelected(rider.riderNameId);
          const canAfford = budgetRemaining >= rider.value;
          const isDisabled = !canSelect || saving || (!isSelected && (teamHasSelection || !canAfford));

          return (
            <div
              key={rider.riderNameId}
              className={`px-4 py-3 flex items-center gap-3 ${
                isSelected
                  ? 'bg-green-50'
                  : isDisabled
                  ? 'bg-gray-50 opacity-60'
                  : 'hover:bg-gray-50'
              }`}
            >
              {/* Rider info */}
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${isSelected ? 'text-green-800' : 'text-gray-900'}`}>
                  {rider.riderName}
                </div>
                {rider.country && (
                  <div className="text-xs text-gray-500">{rider.country}</div>
                )}
              </div>

              {/* Value badge */}
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                isSelected
                  ? 'bg-green-500 text-white'
                  : canAfford
                  ? 'bg-primary/10 text-primary'
                  : 'bg-red-100 text-red-600'
              }`}>
                {rider.value} pts
              </div>

              {/* Action button */}
              {isSelected ? (
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Check size={20} className="text-white" />
                </div>
              ) : (
                <button
                  onClick={() => onSelectRider(rider)}
                  disabled={isDisabled}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isDisabled
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {riders.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500">
          Geen renners beschikbaar voor deze ploeg
        </div>
      )}

      {teamHasSelection && !riders.some(r => isRiderSelected(r.riderNameId)) && (
        <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-200">
          <p className="text-sm text-yellow-700">
            Je hebt al een renner van deze ploeg geselecteerd.
            Verwijder eerst de huidige selectie om een andere renner te kiezen.
          </p>
        </div>
      )}
    </div>
  );
}
