"use client";

import { useState, useRef, useEffect } from "react";
import { DriverCard } from "./components/DriverCardComponent";
import { Button } from "@/components/Button";
import { RaceCard } from "./components/RaceCardComponent";

export interface Driver {
    firstName: string;
    lastName: string;
    shortName: string;
    team: string;
    teamColor?: string;
    teamColorAlt?: string;
    number: number;
    numberImage?: string;
    country: string;
    image: string;
}

export interface Race {
    name: string;
    subName: string;
    startDate: string;
    endDate: string;
    round: number;
    raceImage: string;
}

interface StartingGridElementProps {
    driver: Driver | null;
    even: boolean;
    position: number;
    onDrop: (position: number, driver: Driver) => void;
    onDragStart: (position: number) => void;
    onDragEnd: (e: React.DragEvent, position: number) => void;
}

export const StartingGridElement = ({ driver, even, position, onDrop, onDragStart, onDragEnd }: StartingGridElementProps) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const driverData = e.dataTransfer.getData("application/json");
        if (driverData) {
            const droppedDriver: Driver = JSON.parse(driverData);
            onDrop(position, droppedDriver);
        }
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (driver) {
            e.dataTransfer.setData("application/json", JSON.stringify(driver));
            onDragStart(position);

            // Hide native drag image - we use a custom overlay instead
            const emptyImg = document.createElement('img');
            emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(emptyImg, 0, 0);
        }
    };

    return (
        <span
            className={`xl:h-10 h-8 relative border-2 border-l-2 border-r-2 border-b-0 border-t-2 border-white ${even ? 'mt-10 lg:mt-4' : 'mb-5 mt-5 lg:mt-1 lg:mb-1'} transition-colors ${isDragOver ? 'bg-white/30 border-green-400' : ''} ${driver ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            draggable={!!driver}
            onDragStart={handleDragStart}
            onDragEnd={(e) => onDragEnd(e, position)}
        >
            <span className="text-white absolute -top-4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 xl:text-xl text-lg font-nunito font-black">{position}</span>
            {driver && (
                <span className="text-white xl:text-xl text-lg font-nunito font-black content-center flex justify-center items-center xl:mt-1 mt-0 pointer-events-none">{driver.shortName}</span>
            )}
        </span>
    );
};

const F1Page = () => {

    const races2026: Race[] = [
  {
    name: "Australia",
    subName: "FORMULA 1 QATAR AIRWAYS AUSTRALIAN GRAND PRIX 2026",
    startDate: "2026-03-06",
    endDate: "2026-03-08",
    round: 1,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackmelbourneblackoutline.svg",
  },
  {
    name: "China",
    subName: "FORMULA 1 HEINEKEN CHINESE GRAND PRIX 2026",
    startDate: "2026-03-13",
    endDate: "2026-03-15",
    round: 2,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackshanghaiblackoutline.svg",
  },
  {
    name: "Japan",
    subName: "FORMULA 1 ARAMCO JAPANESE GRAND PRIX 2026",
    startDate: "2026-03-27",
    endDate: "2026-03-29",
    round: 3,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026tracksuzukablackoutline.svg",
  },
  {
    name: "Bahrain",
    subName: "FORMULA 1 GULF AIR BAHRAIN GRAND PRIX 2026",
    startDate: "2026-04-10",
    endDate: "2026-04-12",
    round: 4,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026tracksakhirblackoutline.svg",
  },
  {
    name: "Saudi Arabia",
    subName: "FORMULA 1 STC SAUDI ARABIAN GRAND PRIX 2026",
    startDate: "2026-04-17",
    endDate: "2026-04-19",
    round: 5,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackjeddahblackoutline.svg",
  },
  {
    name: "Miami",
    subName: "FORMULA 1 CRYPTO.COM MIAMI GRAND PRIX 2026",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    round: 6,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackmiamiblackoutline.svg",
  },
  {
    name: "Canada",
    subName: "FORMULA 1 LENOVO GRAND PRIX DU CANADA 2026",
    startDate: "2026-05-22",
    endDate: "2026-05-24",
    round: 7,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackmontrealblackoutline.svg",
  },
  {
    name: "Monaco",
    subName: "FORMULA 1 LOUIS VUITTON GRAND PRIX DE MONACO 2026",
    startDate: "2026-06-05",
    endDate: "2026-06-07",
    round: 8,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackmontecarloblackoutline.svg",
  },
  {
    name: "Barcelona-Catalunya",
    subName: "FORMULA 1 MSC CRUISES GRAN PREMIO DE BARCELONA-CATALUNYA 2026",
    startDate: "2026-06-12",
    endDate: "2026-06-14",
    round: 9,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackcatalunyablackoutline.svg",
  },
  {
    name: "Austria",
    subName: "FORMULA 1 LENOVO AUSTRIAN GRAND PRIX 2026",
    startDate: "2026-06-26",
    endDate: "2026-06-28",
    round: 10,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackspielbergblackoutline.svg",
  },
  {
    name: "Great Britain",
    subName: "FORMULA 1 PIRELLI BRITISH GRAND PRIX 2026",
    startDate: "2026-07-03",
    endDate: "2026-07-05",
    round: 11,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026tracksilverstoneblackoutline.svg",
  },
  {
    name: "Belgium",
    subName: "FORMULA 1 BELGIAN GRAND PRIX 2026",
    startDate: "2026-07-17",
    endDate: "2026-07-19",
    round: 12,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackspafrancorchampsblackoutline.svg",
  },
  {
    name: "Hungary",
    subName: "FORMULA 1 AWS HUNGARIAN GRAND PRIX 2026",
    startDate: "2026-07-24",
    endDate: "2026-07-26",
    round: 13,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackhungaroringblackoutline.svg",
  },
  {
    name: "Netherlands",
    subName: "FORMULA 1 HEINEKEN DUTCH GRAND PRIX 2026",
    startDate: "2026-08-21",
    endDate: "2026-08-23",
    round: 14,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackzandvoortblackoutline.svg",
  },
  {
    name: "Italy",
    subName: "FORMULA 1 PIRELLI GRAN PREMIO D’ITALIA 2026",
    startDate: "2026-09-04",
    endDate: "2026-09-06",
    round: 15,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackmonzablackoutline.svg",
  },
  {
    name: "Spain",
    subName: "FORMULA 1 TAG HEUER GRAN PREMIO DE ESPAÑA 2026",
    startDate: "2026-09-11",
    endDate: "2026-09-13",
    round: 16,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackmadringblackoutline.svg",
  },
  {
    name: "Azerbaijan",
    subName: "FORMULA 1 QATAR AIRWAYS AZERBAIJAN GRAND PRIX 2026",
    startDate: "2026-09-24",
    endDate: "2026-09-26",
    round: 17,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackbakublackoutline.svg",
  },
  {
    name: "Singapore",
    subName: "FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026",
    startDate: "2026-10-09",
    endDate: "2026-10-11",
    round: 18,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026tracksingaporeblackoutline.svg",
  },
  {
    name: "United States",
    subName: "FORMULA 1 MSC CRUISES UNITED STATES GRAND PRIX 2026",
    startDate: "2026-10-23",
    endDate: "2026-10-25",
    round: 19,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackaustinblackoutline.svg",
  },
  {
    name: "Mexico",
    subName: "FORMULA 1 GRAN PREMIO DE LA CIUDAD DE MÉXICO 2026",
    startDate: "2026-10-30",
    endDate: "2026-11-01",
    round: 20,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackmexicocityblackoutline.svg",
  },
  {
    name: "Brazil",
    subName: "FORMULA 1 MSC CRUISES GRANDE PRÊMIO DE SÃO PAULO 2026",
    startDate: "2026-11-06",
    endDate: "2026-11-08",
    round: 21,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackinterlagosblackoutline.svg",
  },
  {
    name: "Las Vegas",
    subName: "FORMULA 1 HEINEKEN LAS VEGAS GRAND PRIX 2026",
    startDate: "2026-11-19",
    endDate: "2026-11-21",
    round: 22,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026tracklasvegasblackoutline.svg",
  },
  {
    name: "Qatar",
    subName: "FORMULA 1 QATAR AIRWAYS QATAR GRAND PRIX 2026",
    startDate: "2026-11-27",
    endDate: "2026-11-29",
    round: 23,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026tracklusailblackoutline.svg",
  },
  {
    name: "Abu Dhabi",
    subName: "FORMULA 1 ETIHAD AIRWAYS ABU DHABI GRAND PRIX 2026",
    startDate: "2026-12-04",
    endDate: "2026-12-06",
    round: 24,
    raceImage:
      "https://media.formula1.com/image/upload/c_lfill,w_3392/v1740000000/common/f1/2026/track/2026trackyasmarinacircuitblackoutline.svg",
  },
];


    const drivers: Driver[] = [
        {
            firstName: "Pierre",
            lastName: "Gasly",
            shortName: "GAS",
            team: "Alpine",
            teamColor: "#00A1E8",
            teamColorAlt: "#005081",
            number: 10,
            country: "fr",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/alpine/piegas01/2026alpinepiegas01numberwhitefrless.webp",
        },
        {
            firstName: "Franco",
            lastName: "Colapinto",
            shortName: "COL",
            team: "Alpine",
            teamColor: "#00A1E8",
            teamColorAlt: "#005081",
            number: 43,
            country: "ar",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/alpine/fracol01/2026alpinefracol01numberwhitefrless.webp",
        },

        {
            firstName: "Fernando",
            lastName: "Alonso",
            shortName: "ALO",
            team: "Aston Martin",
            teamColor: "#229971",
            teamColorAlt: "#00482C",
            number: 14,
            country: "es",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01numberwhitefrless.webp",
        },
        {
            firstName: "Lance",
            lastName: "Stroll",
            shortName: "STR",
            team: "Aston Martin",
            teamColor: "#229971",
            teamColorAlt: "#00482C",
            number: 18,
            country: "ca",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01numberwhitefrless.webp",
        },

        {
            firstName: "Nico",
            lastName: "Hulkenberg",
            shortName: "HUL",
            team: "Audi",
            teamColor: "#F50537",
            teamColorAlt: "#6B0015",
            number: 27,
            country: "de",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/audi/nichul01/2026audinichul01right.webp",
        },
        {
            firstName: "Gabriel",
            lastName: "Bortoleto",
            shortName: "BOR",
            team: "Audi",
            teamColor: "#F50537",
            teamColorAlt: "#6B0015",
            number: 5,
            country: "br",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp",
        },

        {
            firstName: "Sergio",
            lastName: "Perez",
            shortName: "PER",
            team: "Cadillac",
            number: 11,
            country: "mx",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp",
        },
        {
            firstName: "Valtteri",
            lastName: "Bottas",
            shortName: "BOT",
            team: "Cadillac",
            number: 77,
            country: "fi",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp",
        },

        {
            firstName: "Charles",
            lastName: "Leclerc",
            shortName: "LEC",
            team: "Ferrari",
            teamColor: "#ED1131",
            teamColorAlt: "#710006",
            number: 16,
            country: "mc",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/ferrari/chalec01/2026ferrarichalec01numberwhitefrless.webp",
        },
        {
            firstName: "Lewis",
            lastName: "Hamilton",
            shortName: "HAM",
            team: "Ferrari",
            teamColor: "#ED1131",
            teamColorAlt: "#710006",
            number: 44,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/ferrari/lewham01/2026ferrarilewham01numberwhitefrless.webp",
        },

        {
            firstName: "Esteban",
            lastName: "Ocon",
            shortName: "OCO",
            team: "Haas F1 Team",
            teamColor: "#9C9FA2",
            teamColorAlt: "#4D5052",
            number: 31,
            country: "fr",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/haas/estoco01/2026haasestoco01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/haas/estoco01/2026haasestoco01numberwhitefrless.webp",
        },
        {
            firstName: "Oliver",
            lastName: "Bearman",
            shortName: "BEA",
            team: "Haas F1 Team",
            teamColor: "#9C9FA2",
            teamColorAlt: "#4D5052",
            number: 87,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/haas/olibea01/2026haasolibea01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/haas/olibea01/2026haasolibea01numberwhitefrless.webp",
        },

        {
            firstName: "Lando",
            lastName: "Norris",
            shortName: "NOR",
            team: "McLaren",
            teamColor: "#F47600",
            teamColorAlt: "#863400",
            number: 1,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp"
        },
        {
            firstName: "Oscar",
            lastName: "Piastri",
            shortName: "PIA",
            team: "McLaren",
            teamColor: "#F47600",
            teamColorAlt: "#863400",
            number: 81,
            country: "au",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01numberwhitefrless.webp",
        },

        {
            firstName: "George",
            lastName: "Russell",
            shortName: "RUS",
            team: "Mercedes",
            teamColor: "#00D7B6",
            teamColorAlt: "#007560",
            number: 63,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/mercedes/georus01/2026mercedesgeorus01numberwhitefrless.webp",
        },
        {
            firstName: "Kimi",
            lastName: "Antonelli",
            shortName: "ANT",
            team: "Mercedes",
            teamColor: "#00D7B6",
            teamColorAlt: "#007560",
            number: 12,
            country: "it",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/mercedes/andant01/2026mercedesandant01numberwhitefrless.webp",
        },

        {
            firstName: "Liam",
            lastName: "Lawson",
            shortName: "LAW",
            team: "Racing Bulls",
            teamColor: "#6C98FF",
            teamColorAlt: "#2345AB",
            number: 30,
            country: "nz",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01numberwhitefrless.webp",
        },
        {
            firstName: "Arvid",
            lastName: "Lindblad",
            shortName: "LIN",
            team: "Racing Bulls",
            teamColor: "#6C98FF",
            teamColorAlt: "#2345AB",
            number: 41,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp",
        },

        {
            firstName: "Max",
            lastName: "Verstappen",
            shortName: "VER",
            team: "Red Bull Racing",
            teamColor: "#4781D7",
            teamColorAlt: "#003282",
            number: 3,
            country: "nl",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp",
        },
        {
            firstName: "Isack",
            lastName: "Hadjar",
            shortName: "HAD",
            team: "Red Bull Racing",
            teamColor: "#4781D7",
            teamColorAlt: "#003282",
            number: 6,
            country: "fr",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp",
        },

        {
            firstName: "Carlos",
            lastName: "Sainz",
            shortName: "SAI",
            team: "Williams",
            teamColor: "#1868DB",
            teamColorAlt: "#000681",
            number: 55,
            country: "es",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/williams/carsai01/2026williamscarsai01numberwhitefrless.webp",
        },
        {
            firstName: "Alexander",
            lastName: "Albon",
            shortName: "ALB",
            team: "Williams",
            teamColor: "#1868DB",
            teamColorAlt: "#000681",
            number: 23,
            country: "th",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/williams/alealb01/2026williamsalealb01numberwhitefrless.webp",
        },
    ];

    // Grid state: array of 22 positions, each can hold a driver or null
    const [grid, setGrid] = useState<(Driver | null)[]>(Array(22).fill(null));
    const [draggedFromGrid, setDraggedFromGrid] = useState<number | null>(null);
    const [draggingDriver, setDraggingDriver] = useState<string | null>(null);
    const [draggingDriverData, setDraggingDriverData] = useState<Driver | null>(null);
    const [isOutsideGrid, setIsOutsideGrid] = useState(false);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const gridRef = useRef<HTMLDivElement>(null);

    // Track mouse position during drag from grid
    useEffect(() => {
        if (draggedFromGrid === null) return;

        const handleDrag = (e: DragEvent) => {
            if (e.clientX === 0 && e.clientY === 0) return; // Ignore invalid positions

            setDragPosition({ x: e.clientX, y: e.clientY });

            if (gridRef.current) {
                const rect = gridRef.current.getBoundingClientRect();
                const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom;
                setIsOutsideGrid(!isInside);
            }
        };

        document.addEventListener('drag', handleDrag);
        return () => document.removeEventListener('drag', handleDrag);
    }, [draggedFromGrid]);

    const handleDropOnGrid = (position: number, droppedDriver: Driver) => {
        setGrid((prevGrid) => {
            const newGrid = [...prevGrid];
            const existingDriver = newGrid[position - 1];

            // If dropped from another grid position, swap
            if (draggedFromGrid !== null) {
                newGrid[draggedFromGrid - 1] = existingDriver;
            }

            newGrid[position - 1] = droppedDriver;
            return newGrid;
        });
        setDraggedFromGrid(null);
        setDraggingDriver(null);
    };

    const handleDragStartFromGrid = (position: number) => {
        setDraggedFromGrid(position);
        const driver = grid[position - 1];
        if (driver) {
            setDraggingDriver(driver.shortName);
            setDraggingDriverData(driver);
            setIsOutsideGrid(false);
        }
    };

    const handleDragStartFromCard = (e: React.DragEvent, driver: Driver) => {
        e.dataTransfer.setData("application/json", JSON.stringify(driver));
        setDraggedFromGrid(null);
        setDraggingDriver(driver.shortName);

        // Create custom drag image with shortName
        const dragImage = document.createElement('div');
        dragImage.textContent = driver.shortName;
        dragImage.style.cssText = `
            background: linear-gradient(to right, ${driver.teamColor || '#666'}, ${driver.teamColorAlt || '#333'});
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 18px;
            position: absolute;
            top: -1000px;
            left: -1000px;
        `;
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 40, 20);

        // Clean up the element after drag starts
        setTimeout(() => document.body.removeChild(dragImage), 0);
    };

    const handleDragEnd = () => {
        setDraggingDriver(null);
        setDraggedFromGrid(null);
        setDraggingDriverData(null);
        setIsOutsideGrid(false);
    };

    // Remove driver from grid when dropped outside
    const handleGridDragEnd = (e: React.DragEvent, position: number) => {
        // Check if dropped on a valid drop target (the grid elements handle their own drops)
        // If dropEffect is 'none', it means it wasn't dropped on a valid target
        if (e.dataTransfer.dropEffect === 'none') {
            setGrid((prevGrid) => {
                const newGrid = [...prevGrid];
                newGrid[position - 1] = null;
                return newGrid;
            });
        }
        setDraggingDriver(null);
        setDraggedFromGrid(null);
        setDraggingDriverData(null);
        setIsOutsideGrid(false);
    };
// border-3 border-red-500 xs:border-blue-500 sm:border-green-500 md:border-yellow-500 lg:border-purple-500 xl:border-pink-500
    return <div className="container mx-auto mt-5 ">
        <h1 className="text-3xl font-bold mb-6 flex justify-between"><span>F1 Starting Grid </span><Button onClick={() => setGrid(Array(22).fill(null))}>Reset</Button></h1>

        <div title="races" className="flex w-full overflow-y-scroll gap-1">
            {races2026.map((race, index) => {

                console.log(race.name)

                return <RaceCard race={race} selected={index === 0} done={index === 0} />

            })}
        </div>


        <div className="flex flex-row gap-4">

            <div className="flex-5/6 mb-4 grid grid-cols-1 xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-2 gap-2 lg:gap-4 lg:gap-2 auto-rows-min">
                {drivers.map((driver) => {
                    const gridIndex = grid.findIndex((gridDriver) => gridDriver?.shortName === driver.shortName);
                    const gridPosition = gridIndex !== -1 ? gridIndex + 1 : undefined;
                    const isOnGrid = gridPosition !== undefined;
                    const isDragging = draggingDriver === driver.shortName;

                    return (
                        <div
                            key={driver.lastName}
                            className="relative"
                        >
                            <div
                                draggable={!isOnGrid}
                                onDragStart={(e) => handleDragStartFromCard(e, driver)}
                                onDragEnd={handleDragEnd}
                                className={`cursor-grab active:cursor-grabbing select-none transition-opacity duration-200 ${isOnGrid ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'} ${isDragging ? 'opacity-50' : ''}`}
                            >
                                <div className="pointer-events-none">
                                    <DriverCard driver={driver} />
                                </div>
                            </div>
                            {gridPosition && (
                                <div className="absolute right-1 bottom-1 md:top-1 md:bottom-auto lg:bottom-3 lg:top-auto lg:right-3 z-10 bg-white text-gray-600 font-nunito font-black text-xs md:text-xs lg:text-xl xl:text-xl px-1 md:px-1 py-0 md:py-0 xl:py-1 rounded-lg shadow-2xl">
                                    P{gridPosition}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div ref={gridRef} className="rounded-md flex-1/6 min-w-[250px] mb-4 pt-15 relative grid grid-cols-2 bg-gray-600 gap-x-8 p-8 xl:auto-rows-[70px] auto-rows-[60px] h-fit" title="grid">
                <div className="absolute flex left-0 right-0 top-0 content-center items-center justify-center w-full z-10 text-white font-nunito font-regular text-xl px-4 py-2 rounded-lg bg-white/10">Starting Grid</div>
                {Array.from({ length: 22 }, (_, index) => {
                    const position = index + 1;
                    return (
                        <StartingGridElement
                            key={index}
                            driver={grid[index]}
                            even={position % 2 === 0}
                            position={position}
                            onDrop={handleDropOnGrid}
                            onDragStart={handleDragStartFromGrid}
                            onDragEnd={handleGridDragEnd}
                        />
                    );
                })}

            </div>
        </div>

        {/* Custom drag overlay for grid items */}
        {draggingDriverData && draggedFromGrid !== null && dragPosition.x > 0 && (
            <div
                className="fixed pointer-events-none z-50 flex items-center px-4 py-2 rounded font-bold text-lg text-white"
                style={{
                    left: dragPosition.x + 10,
                    top: dragPosition.y - 20,
                    background: `linear-gradient(to right, ${draggingDriverData.teamColor || '#666'}, ${draggingDriverData.teamColorAlt || '#333'})`,
                }}
            >
                <span>{draggingDriverData.shortName}</span>
                {isOutsideGrid && (
                    <span className="ml-2 text-red-400 text-xl">✕</span>
                )}
            </div>
        )}

    </div>
};

export default F1Page;