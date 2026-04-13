'use client'
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useState, useMemo, useRef } from "react";
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
    showCheckboxes = true,
    getItemLabel,
    sortKey,
    showClearButton = true,
    clearButtonLabel,
    groupBy,
    getGroupLabel,
    groupOrder,
    displaySelectedInInput = true,
    inputClassName,
    dropdownClassName,
    groupHeaderClassName,
    availableItemClassName,
    selectedItemClassName
}: SelectorProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [storedItems, setStoredItems] = useState<T[] | null>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const containerRef = useRef<HTMLDivElement>(null);
    
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
        if (!showSelected && !displaySelectedInInput) {
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

    useEffect(() => {
        if (!isFocused) return;

        const updatePosition = () => {
            if (!containerRef.current || typeof window === 'undefined') return;
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const shouldOpenUp = spaceBelow < 280 && spaceAbove > spaceBelow;
            setOpenUpward(shouldOpenUp);
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isFocused]);

    const sortItems = (itemsToSort: T[]) => {
        if (sortKey) {
            return [...itemsToSort].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
        }
        return itemsToSort;
    };

    const groupItems = (itemsToGroup: T[]) => {
        if (!groupBy) {
            return [{ key: '__ungrouped__', label: null, items: sortItems(itemsToGroup) }];
        }

        const grouped = new Map<string, T[]>();

        for (const item of itemsToGroup) {
            const key = groupBy(item);
            const current = grouped.get(key) || [];
            current.push(item);
            grouped.set(key, current);
        }

        const preferredOrder = groupOrder || [];
        const orderedKeys = Array.from(grouped.keys()).sort((a, b) => {
            const aIndex = preferredOrder.indexOf(a);
            const bIndex = preferredOrder.indexOf(b);

            if (aIndex !== -1 || bIndex !== -1) {
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            }

            const aLabel = getGroupLabel ? getGroupLabel(a) : a;
            const bLabel = getGroupLabel ? getGroupLabel(b) : b;
            return aLabel.localeCompare(bLabel);
        });

        return orderedKeys.map((key) => ({
            key,
            label: getGroupLabel ? getGroupLabel(key) : key,
            items: sortItems(grouped.get(key) || []),
        }));
    };

    const renderSection = (sectionItems: T[], sectionPrefix: string, selectedState: boolean) => {
        const groupedSections = groupItems(sectionItems);
        let rowIndex = 0;

        return groupedSections.map((group) => (
            <div key={`${sectionPrefix}-group-${group.key}`}>
                {group.label && group.key !== '__ungrouped__' && (
                    <div className={`sticky top-0 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200 z-[55] ${groupHeaderClassName || ''}`}>
                        {group.label}
                    </div>
                )}
                {group.items.map((item) => {
                    const currentIndex = rowIndex++;
                    return (
                        <div
                            key={`${sectionPrefix}-${currentIndex}`}
                            className={`flex w-full items-center gap-2 hover:bg-gray-100 p-2 pl-3 cursor-pointer transition-colors duration-100 ${
                                selectedState
                                    ? (selectedItemClassName || 'bg-blue-50')
                                    : (availableItemClassName || (currentIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'))
                            }`}
                            onMouseDown={(e) => {
                                if (multiSelect) {
                                    e.preventDefault();
                                }
                                toggleItem(item);
                            }}
                        >
                            {multiSelect && showCheckboxes && (
                                <input
                                    type="checkbox"
                                    checked={selectedState}
                                    onChange={() => {}}
                                    className="w-4 h-4 ml-2"
                                />
                            )}
                            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                {renderItem(item, currentIndex, selectedState)}
                            </div>
                        </div>
                    );
                })}
            </div>
        ));
    };

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-2">
                <input
                    className={`h-[40px] w-full px-3 border rounded ${selectedItems.length > 0 ? 'border-primary bg-blue-50' : 'border-gray-300'} ${inputClassName || ''}`}
                    type="text"
                    placeholder={getPlaceholder()}
                    value={getDisplayValue()}
                    onChange={handleSearch}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                {showClearButton && selectedItems.length > 0 && (
                    <button
                        onClick={clearAll}
                        className="h-[40px] px-3 bg-red-500 cursor-pointer text-white rounded hover:bg-red-600 whitespace-nowrap"
                        title="Clear selection"
                    >
                        {clearButtonLabel || `✕ Clear (${selectedItems.length})`}
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
                const sortedAvailable = sortItems(availableItems);
                const sortedSelected = sortItems(allSelectedItems);
                
                return (
                    <div className={`absolute ${openUpward ? 'bottom-[44px]' : 'top-[44px]'} left-0 right-0 bg-white border border-solid border-gray-200 rounded-md shadow-lg z-50 ${dropdownClassName || ''}`}>
                        <div className="max-h-[60vh] overflow-x-hidden overflow-y-auto">
                            {/* Available group */}
                            {sortedAvailable.length > 0 && (
                                <>
                                    <div className={`sticky top-0 bg-gray-100 px-3 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b-2 border-gray-200 z-[60] relative ${groupHeaderClassName || ''}`}>
                                        Available ({sortedAvailable.length})
                                    </div>
                                    {renderSection(sortedAvailable, 'available', false)}
                                </>
                            )}
                            
                            {/* Selected group */}
                            {showSelected && sortedSelected.length > 0 && (
                                <>
                                    <div className={`sticky top-0 bg-blue-100 px-3 py-4 text-xs font-semibold text-blue-700 uppercase tracking-wide border-b-2 border-blue-200 z-[60] relative ${groupHeaderClassName || ''}`}>
                                        Selected ({sortedSelected.length})
                                    </div>
                                    {renderSection(sortedSelected, 'selected', true)}
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
