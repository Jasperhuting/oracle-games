'use client'

import { PlayerRow } from "./PlayerRow";
import { Rider } from "@/lib/scraper/types";
import { Selector } from "./Selector";
import { normalizeString } from "@/lib/utils/stringUtils";

export const RiderSelector = ({
    setSelectedRiders,
    selectedRiders,
    multiSelect = false,
    multiSelectShowSelected = true,
    items = []
}: {
    setSelectedRiders: (riders: Rider[]) => void,
    selectedRiders: Rider[],
    multiSelect?: boolean,
    multiSelectShowSelected?: boolean,
    items?: Rider[]
}) => {
    return (
        <Selector<Rider>
            items={items}
            selectedItems={selectedRiders}
            setSelectedItems={setSelectedRiders}
            multiSelect={multiSelect}
            multiSelectShowSelected={multiSelectShowSelected}
            placeholder={multiSelect ? "Filter on riders..." : "Filter on rider..."}
            getItemLabel={(rider) => rider.name || ''}
            searchFilter={(rider, searchTerm) => {
                const normalizedSearch = normalizeString(searchTerm);
                const lowerSearch = searchTerm.toLowerCase();

                return !!(normalizeString(rider?.name || '').includes(normalizedSearch) ||
                         normalizeString(rider?.team?.name || '').includes(normalizedSearch) ||
                         rider?.country?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(r1, r2) => r1.name === r2.name && r1.rank === r2.rank}
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
            renderSelectedItem={(rider, index, onRemove) => (
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
    );
};
