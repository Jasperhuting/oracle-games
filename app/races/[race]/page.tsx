import { getRiders } from "@/lib/scraper";
import { RaceSlug } from "@/lib/scraper/types";
import { StartList } from "@/components/StartList";


export default async function StartlistsPage({ params }: { params: { race: RaceSlug } }) {
    const startList = await getRiders({ race: params.race, year: 2026 });
    
    return (
       <StartList startList={startList} year={2026} race={params.race}/>
    );
}