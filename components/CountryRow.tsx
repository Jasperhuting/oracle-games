import { Country } from "@/lib/scraper/types";
import { getCountryNameNL } from "@/lib/country-nl";
import { Flag } from "./Flag";
import { Row } from "./Row";

export const CountryRow = ({
    country,
    selectCountry,
    selectedCountry
}: {
    country: Country,
    selectCountry: (country: Country) => void,
    selectedCountry?: boolean
}) => {
    return (
        <Row
            item={country}
            onSelect={selectCountry}
            isSelected={selectedCountry}
        >
            <span className="w-[20px] h-[20px]">
                <Flag
                    className="w-[20px] h-[20px] whitespace-nowrap break-keep"
                    countryCode={country.code}
                />
            </span>
            <span className="break-keep whitespace-nowrap">{getCountryNameNL(country.code, country.name)}</span>
        </Row>
    );
};