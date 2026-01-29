'use client'
import { useEffect, useState } from "react";
import { Selector } from "@/components/Selector";
import { Driver } from "../data";
import { DriverRow } from "./DriverRow";


export const DriverSelector = ({
    drivers,
    setSelectedDrivers,
    selectedDrivers,
    multiSelect = false,
    multiSelectShowSelected = true,
    showSelected = true,
    placeholder
}: {
    drivers: Driver[],
    setSelectedDrivers: (drivers: Driver[]) => void,
    selectedDrivers: Driver[],
    multiSelect?: boolean,
    multiSelectShowSelected?: boolean,
    showSelected?: boolean,
    placeholder?: string
}) => {
 

    return (
        <Selector<Driver>
            items={drivers}
            selectedItems={selectedDrivers}
            setSelectedItems={setSelectedDrivers}
            multiSelect={multiSelect}
            multiSelectShowSelected={multiSelectShowSelected}
            placeholder={placeholder || (multiSelect ? "Filter on Drivers..." : "Filter on driver...")}
            getItemLabel={(team) => team.firstName?.replace(/\s*\d{4}$/, '') || ''}
            searchFilter={(team, searchTerm) => {
                const lowerSearch = searchTerm.toLowerCase();
                return !!(team?.firstName?.toLowerCase().includes(lowerSearch) ||
                         team?.lastName?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(t1, t2) => t1.firstName === t2.firstName && t1.lastName === t2.lastName}
            showSelected={showSelected}
            sortKey={(driver) => driver.team || ''}
            renderItem={(team, index, isSelected) => (
                <DriverRow 
                    selectedDriver={isSelected} 
                    driver={team} 
                    selectDriver={() => {}} 
                />
            )}
            renderSelectedItem={(team, index, onRemove) => (
                showSelected ? (
                    <DriverRow 
                        driver={team} 
                        selectDriver={onRemove} 
                    />
                ) : null
            )}
        />
    );
};