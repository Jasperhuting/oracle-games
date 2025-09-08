import { KNOWN_RACE_SLUGS } from "@/lib/scraper";
import Link from "next/link";

export default async function RacesPage() {
    const races = KNOWN_RACE_SLUGS;
    return (
        <div>
            <h1>Races</h1>

            {races.map((race) => (
                <div key={race}>                    
                    <Link href={`/races/${race}`}>{race}</Link>
                </div>
            ))}

        </div>
    );
}