import { PlayerRow } from "./PlayerRow";
import { Rider } from "@/lib/scraper";
import { Selector } from "./Selector";

export const PlayerSelector = ({ 
    setSelectedPlayers, 
    selectedPlayers, 
    multiSelect = false, 
    multiSelectShowSelected = true 
}: { 
    setSelectedPlayers: (players: Rider[]) => void, 
    selectedPlayers: Rider[], 
    multiSelect?: boolean, 
    multiSelectShowSelected?: boolean 
}) => {
    return (
        <Selector<Rider>
            items={[]}
            selectedItems={selectedPlayers}
            setSelectedItems={setSelectedPlayers}
            multiSelect={multiSelect}
            multiSelectShowSelected={multiSelectShowSelected}
            placeholder={multiSelect ? "Search players..." : "Search player..."}
            localStorageKey="riders_2025"
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