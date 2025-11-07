'use client'
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";

interface SelectorProps<T> {
    items: T[];
    selectedItems: T[];
    setSelectedItems: (items: T[]) => void;
    multiSelect?: boolean;
    multiSelectShowSelected?: boolean;
    placeholder?: string;
    searchFilter: (item: T, searchTerm: string) => boolean;
    isEqual: (item1: T, item2: T) => boolean;
    renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
    renderSelectedItem: (item: T, index: number, onRemove: () => void) => React.ReactNode;
    localStorageKey?: string;
    initialResultsLimit?: number;
}

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
    initialResultsLimit = 50
}: SelectorProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<T[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [items, setItems] = useState<T[]>(initialItems);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    
    // Load items from localStorage or use initial items
    useEffect(() => {
        if (localStorageKey && typeof window !== 'undefined') {
            const storedItems = JSON.parse(localStorage.getItem(localStorageKey) || '[]') as T[];
            if (storedItems.length > 0) {
                setItems(storedItems);
                setResults(storedItems.slice(0, initialResultsLimit));
            } else {
                setItems(initialItems);
                setResults(initialItems.slice(0, initialResultsLimit));
            }
        } else if (initialItems.length > 0) {
            setItems(initialItems);
            setResults(initialItems.slice(0, initialResultsLimit));
        }
    }, [localStorageKey, initialItems, initialResultsLimit]);

    useEffect(() => {
        const performSearch = async () => {
            setIsSearching(true);
            if (debouncedSearchTerm) {
                const filteredItems = items.filter(item => searchFilter(item, debouncedSearchTerm));
                setResults(filteredItems);
            } else {
                setResults(items.slice(0, initialResultsLimit));
            }
            setIsSearching(false);
        };

        performSearch();
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

    return (
        <div className="relative flex flex-row items-center gap-2">
            <div className="flex items-center gap-2">
                <input
                    className="h-[40px] max-w-[400px] w-full px-3 border border-gray-300 rounded"
                    type="text"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={handleSearch}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                {selectedItems.length > 0 && (
                    <button
                        onClick={clearAll}
                        className="h-[40px] px-3 bg-red-500 text-white rounded hover:bg-red-600 whitespace-nowrap"
                        title="Clear selection"
                    >
                        ✕ Clear {multiSelect ? `(${selectedItems.length})` : ''}
                    </button>
                )}
            </div>
            {multiSelectShowSelected && selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 max-h-[200px] overflow-y-auto min-w-[600px]">
                    {selectedItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                            {renderSelectedItem(item, index, () => toggleItem(item))}
                            <button
                                onClick={() => toggleItem(item)}
                                className="text-red-500 hover:text-red-700 font-bold"
                                title="Remove"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {isSearching ? 'Searching...' : 'Search'}

            {isFocused && (
                <div className="absolute top-[40px] left-0 z-10 bg-white border border-solid border-gray-200 rounded-md w-[600px] max-w-[600px] max-h-[400px] overflow-y-scroll shadow-lg">
                    {results.map((item, index) => {
                        const isSelected = selectedItems.some(selected => isEqual(selected, item));
                        return (
                            <div 
                                key={index} 
                                className={`flex w-full items-center gap-2 hover:bg-gray-50 p-2 ${typeof index !== 'boolean' && index % 2 === 0 ? 'bg-gray-100' : ''}`} 
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
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="w-4 h-4"
                                    />
                                )}
                                {renderItem(item, index, isSelected)}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
