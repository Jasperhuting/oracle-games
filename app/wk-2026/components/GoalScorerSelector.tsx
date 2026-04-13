'use client';

import { Selector } from '@/components/Selector';

export type GoalScorerPosition = 'keeper' | 'verdediger' | 'middenvelder' | 'spits';

export interface GoalScorerPlayer {
  name: string;
  position: GoalScorerPosition;
}

interface GoalScorerOption {
  id: string;
  label: string;
  positionGroup: 'none' | GoalScorerPosition;
  player: GoalScorerPlayer | null;
}

const POSITION_LABELS: Record<GoalScorerOption['positionGroup'], string> = {
  none: 'Geen doelpunt',
  keeper: 'Keepers',
  verdediger: 'Verdedigers',
  middenvelder: 'Middenvelders',
  spits: 'Aanvallers',
};

const POSITION_ORDER: GoalScorerOption['positionGroup'][] = [
  'none',
  'keeper',
  'verdediger',
  'middenvelder',
  'spits',
];

export function GoalScorerSelector({
  players,
  selectedPlayerName,
  onChange,
  teamLabel,
  firstGoalLabel = false,
}: {
  players: GoalScorerPlayer[];
  selectedPlayerName: string | null | undefined;
  onChange: (playerName: string | null) => void;
  teamLabel: string;
  firstGoalLabel?: boolean;
}) {
  const options: GoalScorerOption[] = [
    {
      id: 'none',
      label: 'Geen doelpunt',
      positionGroup: 'none',
      player: null,
    },
    ...players.map((player) => ({
      id: `${player.position}-${player.name}`,
      label: player.name,
      positionGroup: player.position,
      player,
    })),
  ];

  const selectedOption = options.find((option) => option.player?.name === selectedPlayerName)
    ?? options[0];

  return (
    <Selector<GoalScorerOption>
      items={options}
      selectedItems={[selectedOption]}
      setSelectedItems={(items) => onChange(items[0]?.player?.name ?? null)}
      multiSelect={false}
      multiSelectShowSelected={false}
      showSelected={false}
      displaySelectedInInput
      showCheckboxes={false}
      placeholder={`${firstGoalLabel ? 'Geen 1e doelpunt' : 'Geen doelpunt'} (${teamLabel})`}
      inputClassName="border-[#ffd7a6] bg-[#fffaf2] text-[#9a4d00] placeholder:text-[#c88a3d] focus:border-[#ff9900] focus:outline-none focus:ring-2 focus:ring-[#ff9900]/20"
      dropdownClassName="border-[#ffd7a6] bg-[#fffdf9] shadow-xl"
      groupHeaderClassName="bg-[#fff0d9] text-[#9a4d00] border-[#ffd7a6]"
      availableItemClassName="bg-white hover:bg-[#fff7eb]"
      selectedItemClassName="bg-[#fff0d9] hover:bg-[#ffe3b8]"
      getItemLabel={(item) => item.label}
      searchFilter={(item, searchTerm) =>
        item.label.toLowerCase().includes(searchTerm.toLowerCase())
      }
      isEqual={(a, b) => a.id === b.id}
      renderItem={(item) => (
        <div className="min-w-0">
          <span className={`truncate text-sm ${item.id === selectedOption.id ? 'font-semibold text-[#9a4d00]' : 'text-gray-900'}`}>
            {item.label}
          </span>
        </div>
      )}
      renderSelectedItem={() => null}
      showClearButton={false}
      groupBy={(item) => item.positionGroup}
      getGroupLabel={(groupKey) => POSITION_LABELS[groupKey as GoalScorerOption['positionGroup']]}
      groupOrder={POSITION_ORDER}
    />
  );
}
