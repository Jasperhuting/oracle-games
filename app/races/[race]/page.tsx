import Link from "next/link";
import { getRiders } from "@/lib/scraper";
import { RaceSlug } from "@/lib/scraper/types";

const YEAR = 2025;

export default async function StartlistsPage({ params }: { params: { race: RaceSlug } }) {
    const startList = await getRiders({ race: params.race, year: YEAR });

    console.log(startList);

    return (
        <div>
            <h1>Startlists {params.race}</h1>

            <div>
                {startList.riders.map((team, index) => (
                    <div key={index}>
                        <img src={`https://www.procyclingstats.com/${team.image}`} alt={team.name} />
                        {team.name}
                        {team.riders.map((rider, index) => (
                            <div key={index}>
                                {rider.name}
                            </div>
                        ))}
                    </div>
                ))}

                {Array.from({ length: 21 }).map((_, index) => (
                    <div key={index}>
                        <Link href={`/races/${params.race}/stage/${index + 1}`}>Stage {index + 1}</Link>
                    </div>
                ))}
            </div>

        </div>
    );
}