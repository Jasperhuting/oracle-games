import { Country } from "@/lib/scraper/types";
import { CountryRow } from "./CountryRow";
import { Selector } from "./Selector";
import countriesList from '@/lib/country.json';

export const CountrySelector = ({ 
    setSelectedCountries, 
    selectedCountries, 
    multiSelect = false, 
    multiSelectShowSelected = true 
}: { 
    setSelectedCountries: (countries: Country[]) => void, 
    selectedCountries: Country[], 
    multiSelect?: boolean, 
    multiSelectShowSelected?: boolean 
}) => {
    return (
        <Selector<Country>
            items={countriesList}
            selectedItems={selectedCountries}
            setSelectedItems={setSelectedCountries}
            multiSelect={multiSelect}
            multiSelectShowSelected={multiSelectShowSelected}
            placeholder={multiSelect ? "Filter on countries..." : "Filter on country..."}
            getItemLabel={(country) => country.name || ''}
            searchFilter={(country, searchTerm) => {
                const lowerSearch = searchTerm.toLowerCase();
                return !!(country?.name?.toLowerCase().includes(lowerSearch) ||
                         country?.code?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(c1, c2) => c1.code === c2.code}
            renderItem={(country, index, isSelected) => (
                <CountryRow 
                    selectedCountry={isSelected} 
                    country={country} 
                    selectCountry={() => {}} 
                />
            )}
            renderSelectedItem={(country, index, onRemove) => (
                <CountryRow 
                    country={country} 
                    selectCountry={onRemove} 
                />
            )}
        />
    );
};