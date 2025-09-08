import { iso2ToFlag } from "@/lib/firebase/utils";
import { getStageResult, RaceSlug, type StageRider, type TTTTeamResult } from "@/lib/scraper";

export default async function StagePage({ params }: { params: { race: RaceSlug; year: number; stage: string } }) {

    const result = await getStageResult({ race: params.race, year: Number(params.year), stage: Number(params.stage.split('stage-')[1]) });
    console.log(result.stageResults);

    return (
        <div className="container mx-auto p-10">
            {result.stageResults.map((rider) => {
                function isTTTTeamResult(v: unknown): v is TTTTeamResult {
                    const obj = v as any;
                    return obj && typeof obj === 'object' && typeof obj.team === 'string' && Array.isArray(obj.riders);
                }

                if (isTTTTeamResult(rider)) {
                    return <div>
                        <span>{rider.place}</span>
                        <div key={rider.place}>{rider.team}</div>
                    </div>;
                }

                const r = rider as StageRider;
                return <div key={`${r.firstName}-${r.lastName}`} className="flex flex-row gap-2">
                    <span className="min-w-10 text-center">#{r.place || '-'}</span>
                    <div className="grid grid-cols-3 gap-2 w-full">
                        <div>
                            <span>{iso2ToFlag(rider.country)}</span><span className={rider.country === 'nl' ? 'font-bold' : ''}>{r.firstName} {r.lastName}</span>
                        </div>
                        <span className="whitespace-nowrap">{r.team}</span>
                        <span>{r.timeDifference}</span>
                    </div>
                </div>;
            })}
        </div>
    );
}