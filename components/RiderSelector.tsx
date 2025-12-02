'use client'

import { PlayerRow } from "./PlayerRow";
import { Rider } from "@/lib/scraper";
import { Selector } from "./Selector";

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
                const lowerSearch = searchTerm.toLowerCase();
                console.log('hier?', rider?.team?.nameID?.split('-')[0]?.toLowerCase());


                return !!(rider?.name?.toLowerCase().includes(lowerSearch) ||
                         rider?.team?.name?.toLowerCase().includes(lowerSearch) ||
                         rider?.team?.nameID?.split('-')[0]?.toLowerCase().includes(lowerSearch) ||
                         rider?.team?.nameID?.split('-')[1]?.toLowerCase().includes(lowerSearch) ||
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
