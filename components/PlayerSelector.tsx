import { PlayerRow } from "./PlayerRow";
import { Rider } from "@/lib/scraper";
import { Selector } from "./Selector";
import process from "process";

const YEAR = Number(process.env.NEXT_PUBLIC_PLAYING_YEAR || 2026);

export const PlayerSelector = ({
    setSelectedPlayers,
    selectedPlayers,
    multiSelect = false,
    multiSelectShowSelected = true,
    items = []
}: {
    setSelectedPlayers: (players: Rider[]) => void,
    selectedPlayers: Rider[],
    multiSelect?: boolean,
    multiSelectShowSelected?: boolean,
    items?: Rider[]
}) => {
    return (
        <Selector<Rider>
            items={items}
            selectedItems={selectedPlayers}
            setSelectedItems={setSelectedPlayers}
            multiSelect={multiSelect}
            multiSelectShowSelected={multiSelectShowSelected}
            placeholder={multiSelect ? "Filter on players..." : "Filter on player..."}
            localStorageKey={`riders_${YEAR}`}
            getItemLabel={(player) => player.name || ''}
            searchFilter={(player, searchTerm) => {
                const lowerSearch = searchTerm.toLowerCase();
                return !!(player?.name?.toLowerCase().includes(lowerSearch) ||
                         player?.team?.name?.toLowerCase().includes(lowerSearch) ||
                         player?.country?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(p1, p2) => p1.name === p2.name && p1.rank === p2.rank}
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