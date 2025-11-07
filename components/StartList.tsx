import { iso2ToFlag } from "@/lib/firebase/utils";
import { StartlistResult } from "@/lib/scraper";
import Link from "next/link";

export const StartList = ({ year, race, startList }: { year: number, race: string, startList: StartlistResult }) => {
    
    return (
        <div>
            <h1>Startlists {race}</h1>

            <div className="grid grid-cols-2 gap-2">
                {startList.riders.map((team, index) => (
                    <div className="flex flex-col gap-2 bg-red-100 p-2 rounded" key={index}>
                        <div className="flex flex-row gap-2 items-center bg-white p-2 rounded">
                            <span>
                                {team.image && <img className="w-16 h-16 self-center rounded-full" src={`https://www.procyclingstats.com/${team.image}`} alt={team.name} />}
                            </span>
                            <span>
                                {team.name}
                            </span>
                        </div>
                        {team.riders.map((rider, index) => (
                            <div className="flex flex-row gap-2" key={index}>
                                <span>#{rider.startNumber}</span>
                                <span>{iso2ToFlag(rider.country)}</span>
                                <span className={rider.dropout ? 'line-through' : ''}>{rider.name}</span>
                                
                                
                            </div>
                        ))}
                    </div>
                ))}

                {Array.from({ length: 21 }).map((_, index) => (
                    <div key={index}>
                        <Link href={`/races/${race}/${year}/stage/${index + 1}`}>Stage {index + 1}</Link>
                    </div>
                ))}
            </div>

        </div>
    );
}