import Link from "next/link";
import { getRiders } from "@/lib/scraper";
import { RaceSlug } from "@/lib/scraper/types";
import { StartList } from "@/components/StartList";

const YEAR = 2025;

export default async function StartlistsPage({ params }: { params: { race: RaceSlug } }) {
    const startList = await getRiders({ race: params.race, year: YEAR });
    
    return (
       <StartList startList={startList} year={YEAR} race={params.race}/>
    );
}