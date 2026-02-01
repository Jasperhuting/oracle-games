'use client'
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useState, useMemo } from "react";
import { SelectorProps } from "@/lib/types/component-props";

export function Selector<T>({
    items: initialItems,
    selectedItems,
    setSelectedItems,
    multiSelect = false,
    multiSelectShowSelected = true,
    placeholder = "Search...",
    searchFilter,
    isEqual,
    renderItem,
    renderSelectedItem,
    localStorageKey,
    initialResultsLimit = 50,
    showSelected = true,
    getItemLabel,
    sortKey
}: SelectorProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [storedItems, setStoredItems] = useState<T[] | null>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    
    // Load items from localStorage once on mount
    useEffect(() => {
        if (localStorageKey && typeof window !== 'undefined') {
            const stored = JSON.parse(localStorage.getItem(localStorageKey) || '[]') as T[];
            if (stored.length > 0) {
                setStoredItems(stored);
            }
        }
    }, [localStorageKey]);

    // Use stored items if available, otherwise use initialItems
    const items = storedItems || initialItems;

    // Compute results based on search term
    const results = useMemo(() => {
        if (debouncedSearchTerm) {
            return items.filter(item => searchFilter(item, debouncedSearchTerm));
        }
        return items.slice(0, initialResultsLimit);
    }, [debouncedSearchTerm, items, searchFilter, initialResultsLimit]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const toggleItem = (item: T) => {
        if (multiSelect) {
            const isSelected = selectedItems.some(selected => isEqual(selected, item));
            if (isSelected) {
                setSelectedItems(selectedItems.filter(selected => !isEqual(selected, item)));
            } else {
                setSelectedItems([...selectedItems, item]);
            }
        } else {
            const isSelected = selectedItems.some(selected => isEqual(selected, item));
            setSelectedItems(isSelected ? [] : [item]);
        }
    };

    const clearAll = () => {
        setSelectedItems([]);
    };

    // Generate display value for input
    const getDisplayValue = () => {
        if (isFocused) {
            return searchTerm;
        }
        if (selectedItems.length > 0 && getItemLabel) {
            return selectedItems.map(item => getItemLabel(item)).join(', ');
        }
        return searchTerm;
    };

    const getPlaceholder = () => {
        if (selectedItems.length > 0 && !isFocused && !getItemLabel) {
            return `${placeholder} (${selectedItems.length} selected)`;
        }
        return placeholder;
    };

    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <input
                    className={`h-[40px] w-full px-3 border rounded ${selectedItems.length > 0 ? 'border-primary bg-blue-50' : 'border-gray-300'}`}
                    type="text"
                    placeholder={getPlaceholder()}
                    value={getDisplayValue()}
                    onChange={handleSearch}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                {selectedItems.length > 0 && (
                    <button
                        onClick={clearAll}
                        className="h-[40px] px-3 bg-red-500 cursor-pointer text-white rounded hover:bg-red-600 whitespace-nowrap"
                        title="Clear selection"
                    >
                        ✕ Clear ({selectedItems.length})
                    </button>
                )}
            </div>
            {multiSelectShowSelected && selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 max-h-[200px] overflow-y-auto">
                    {selectedItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                            {renderSelectedItem(item, index, () => toggleItem(item))}
                            <button
                                onClick={() => toggleItem(item)}
                                className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                                title="Remove"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isFocused && (() => {
                // Separate available and selected items from results
                const availableItems = results.filter(item => !selectedItems.some(selected => isEqual(selected, item)));
                const selectedInResults = results.filter(item => selectedItems.some(selected => isEqual(selected, item)));
                // Add selected items not in results
                const selectedNotInResults = selectedItems.filter(item => !results.some(r => isEqual(r, item)));
                const allSelectedItems = [...selectedInResults, ...selectedNotInResults];
                
                // Sort by sortKey if provided
                const sortItems = (items: T[]) => {
                    if (sortKey) {
                        return [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
                    }
                    return items;
                };
                
                const sortedAvailable = sortItems(availableItems);
                const sortedSelected = sortItems(allSelectedItems);
                
                return (
                    <div className="absolute top-[44px] left-0 right-0 bg-white border border-solid border-gray-200 rounded-md shadow-lg z-50">
                        <div className="max-h-[400px] overflow-x-hidden overflow-y-auto">
                            {/* Available group */}
                            {sortedAvailable.length > 0 && (
                                <>
                                    <div className="sticky top-0 bg-gray-100 px-3 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b-2 border-gray-200 z-[60] relative">
                                        Available ({sortedAvailable.length})
                                    </div>
                                    {sortedAvailable.map((item, index) => (
                                        <div 
                                            key={`available-${index}`} 
                                            className={`flex w-full items-center gap-2 hover:bg-gray-50 p-2 pl-3 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} 
                                            onMouseDown={(e) => {
                                                if (multiSelect) {
                                                    e.preventDefault();
                                                }
                                                toggleItem(item);
                                            }}
                                        >
                                            {multiSelect && (
                                                <input
                                                    type="checkbox"
                                                    checked={false}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 ml-2"
                                                />
                                            )}
                                            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                                {renderItem(item, index, false)}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                            
                            {/* Selected group */}
                            {sortedSelected.length > 0 && (
                                <>
                                    <div className="sticky top-0 bg-blue-100 px-3 py-4 text-xs font-semibold text-blue-700 uppercase tracking-wide border-b-2 border-blue-200 z-[60] relative">
                                        Selected ({sortedSelected.length})
                                    </div>
                                    {sortedSelected.map((item, index) => (
                                        <div 
                                            key={`selected-${index}`} 
                                            className={`flex w-full items-center gap-2 hover:bg-blue-100 p-2 pl-3 bg-blue-50`} 
                                            onMouseDown={(e) => {
                                                if (multiSelect) {
                                                    e.preventDefault();
                                                }
                                                toggleItem(item);
                                            }}
                                        >
                                            {multiSelect && (
                                                <input
                                                    type="checkbox"
                                                    checked={true}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 ml-2"
                                                />
                                            )}
                                            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                                {renderItem(item, index, true)}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
