import { getRiders } from "@/lib/scraper";
import { RaceSlug } from "@/lib/scraper/types";
import { StartList } from "@/components/StartList";
// import { getRidersRanked } from "@/lib/scraper/getRidersRanked";


export default async function StartlistsPage({ params }: { params: Promise<{ race: RaceSlug, year: string }> }) {
    const { race, year } = await params;
    const startList = await getRiders({ race, year: Number(year) });
    //  const rankedRiders = await getRidersRanked({ offset: 0, year: Number(year) });
    

    return (
        <StartList startList={startList} year={Number(year)} race={race}/>
    );
}