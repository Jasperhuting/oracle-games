import { getRiders } from "@/lib/scraper";
import { RaceSlug } from "@/lib/scraper/types";
import { StartList } from "@/components/StartList";
import process from "process";

const YEAR = Number(process.env.NEXT_PUBLIC_PLAYING_YEAR || 2026);

export default async function StartlistsPage({ params }: { params: { race: RaceSlug } }) {
    const startList = await getRiders({ race: params.race, year: YEAR });
    
    return (
       <StartList startList={startList} year={YEAR} race={params.race}/>
    );
}