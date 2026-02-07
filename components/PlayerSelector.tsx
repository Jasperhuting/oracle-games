import { PlayerRow } from "./PlayerRow";
import { Rider } from "@/lib/types/rider";
import { Selector } from "./Selector";

export const PlayerSelector = ({
    setSelectedPlayers,
    selectedPlayers,
    multiSelect = false,
    multiSelectShowSelected = true,
    items = [],
    useLocalStorage = true
}: {
    setSelectedPlayers: (players: Rider[]) => void,
    selectedPlayers: Rider[],
    multiSelect?: boolean,
    multiSelectShowSelected?: boolean,
    items?: Rider[],
    useLocalStorage?: boolean
}) => {
    return (
        <Selector<Rider>
            items={items}
            selectedItems={selectedPlayers}
            setSelectedItems={setSelectedPlayers}
            multiSelect={multiSelect}
            multiSelectShowSelected={multiSelectShowSelected}
            placeholder={multiSelect ? "Filter on players..." : "Filter on player..."}
            localStorageKey={useLocalStorage ? `riders_2026` : undefined}
            getItemLabel={(player) => player.name || ''}
            searchFilter={(player, searchTerm) => {
                const lowerSearch = searchTerm.toLowerCase();
                return !!(player?.name?.toLowerCase().includes(lowerSearch) ||
                         player?.team?.name?.toLowerCase().includes(lowerSearch) ||
                         player?.country?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(p1, p2) => {
                const p1Id = p1.id || p1.nameID || '';
                const p2Id = p2.id || p2.nameID || '';
                if (p1Id && p2Id) {
                    return p1Id === p2Id;
                }
                return p1.name === p2.name && p1.rank === p2.rank;
            }}
            renderItem={(player, index, isSelected) => (
                <PlayerRow
                    showPoints={true}
                    showRank={true}
                    selectedPlayer={isSelected}
                    player={player}
                    selectPlayer={() => {}}
                    index={false}
                    fullWidth={true}
                />
            )}
            renderSelectedItem={(player, index, onRemove) => (
                <PlayerRow
                    showRank={true}
                    showPoints={true}
                    showButton={false}
                    player={player}
                    selectPlayer={onRemove}
                    index={false}
                    fullWidth={true}
                />
            )}
        />
    );
};
