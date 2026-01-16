import { Flag } from "@/components/Flag";

interface Driver {
    firstName: string;
    lastName: string;
    team: string;
    teamColor?: string;
    teamColorAlt?: string;
    number: number;
    numberImage?: string;
    country: string;
    image: string;
}

const f1Page = () => {


const drivers: Driver[] = [
  {
    firstName: "Pierre",
    lastName: "Gasly",
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
    team: "Cadillac",
    number: 11,
    country: "mx",
    image:
      "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp",
  },
  {
    firstName: "Valtteri",
    lastName: "Bottas",
    team: "Cadillac",
    number: 77,
    country: "fi",
    image:
      "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp",
  },

  {
    firstName: "Charles",
    lastName: "Leclerc",
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
    team: "McLaren",
    teamColor: "#F47600",
    teamColorAlt: "#863400",
    number: 1,
    country: "gb",
    image:
      "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp",
    numberImage:
      "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/mclaren/lannor01/2026mclarenlannor01numberwhitefrless.webp",
  },
  {
    firstName: "Oscar",
    lastName: "Piastri",
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


    return <div className="container mx-auto mt-5">
        <h1 className="text-3xl font-bold mb-6">f1</h1>

        <div className="mb-4 grid grid-cols-4 gap-4">
            {drivers.map((driver) => {
                return <div key={driver.lastName} style={{ backgroundColor: driver.teamColor }} className={`p-3 bg-gray-600 min-h-[430px] relative overflow-hidden`}>
                    <div className="flex flex-col">
                    <span className="text-white">{driver.firstName}</span>
                    <span className="text-white font-bold">{driver.lastName}</span>
                    <span className="text-lg text-white">{driver.team}</span>
                    <span className="text-lg text-white absolute top-2 right-2">{driver.numberImage ? <img className="z-0 w-[50px] h-[50px]" src={driver.numberImage} alt={driver.lastName} /> : <span className="text-5xl font-sans">{driver.number}</span>}</span>
                    <span className="text-lg text-white"><Flag countryCode={driver.country} /></span>
                    </div>
                    <img className="absolute right-1 top-0 z-0" src={driver.image} alt={driver.firstName} />
                </div>
            })}
        </div>

    </div>
};

export default f1Page;