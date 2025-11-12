'use client'
import { useEffect, useState } from "react";
import { ClassRow } from "./ClassRow";
import { Selector } from "./Selector";

export const ClassSelector = ({
    setSelectedClasses,
    selectedClasses,
    multiSelect = false,
    multiSelectShowSelected = true,
    placeholder
}: {
    setSelectedClasses: (classes: string[]) => void,
    selectedClasses: string[],
    multiSelect?: boolean,
    multiSelectShowSelected?: boolean,
    placeholder?: string
}) => {
    const [classes, setClasses] = useState<string[]>([]);
    
    // Load classes from API on mount
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await fetch('/api/getClasses');
                const data = await response.json();

                console.log('data', data.classes);
                setClasses(data.classes || []);
            } catch (error) {
                console.error('Error fetching classes:', error);
            }
        };
        fetchClasses();
    }, []);

    return (
        <Selector<string>
            items={classes}
            selectedItems={selectedClasses}
            setSelectedItems={setSelectedClasses}
            multiSelect={multiSelect}
            multiSelectShowSelected={multiSelectShowSelected}
            placeholder={placeholder || (multiSelect ? "Filter on classes..." : "Filter on class...")}
            getItemLabel={(classItem) => classItem || ''}
            searchFilter={(team, searchTerm) => {
                const lowerSearch = searchTerm.toLowerCase();
                return !!(team?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(t1, t2) => t1 === t2}
            renderItem={(team, index, isSelected) => (
                <ClassRow 
                    selectedClass={isSelected} 
                    name={team} 
                    selectClass={() => {}} 
                />
            )}
            renderSelectedItem={(team, index, onRemove) => (
                <ClassRow 
                    name={team} 
                    selectClass={onRemove} 
                />
            )}
        />
    );
};