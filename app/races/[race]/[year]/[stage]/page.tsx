import { StageRider, ClassificationRider } from "@/lib/firebase/utils";
import { StageRider, ClassificationRider } from "@/lib/scraper";

export default async function StagePage({ params }: { params: { race: RaceSlug; year: number; stage: string } }) {

    const result = await getStageResult({ race: params.race, year: Number(params.year), stage: Number(params.stage.split('stage-')[1]) });
    

    return (
        <div className="container mx-auto p-10">
            <span>StageResults</span>
            {result.stageResults.map((rider) => {


                if (isTTTTeamResult(rider)) {
                    return <div key={`ttt-stage-${rider.place}-${rider.team}`}>
                        <span>{rider.place}</span>
                        <div>{rider.team}</div>
                    </div>;
                }

                const r = rider as StageRider;
                
                return <div key={`${r.firstName}-${r.lastName}`} className="flex flex-row gap-2">
                    <span className="min-w-10 text-center">#{r.place || '-'}</span>
                    <div className="grid grid-cols-4 gap-2 w-full">
                        <div>
                            <span>{iso2ToFlag(rider.country)}</span><span className={rider.country === 'nl' ? 'font-bold' : ''}>{r.firstName} {r.lastName}</span>
                        </div>
                        <span className="whitespace-nowrap">{r.team}</span>
                        <span className="whitespace-nowrap">Vluchter: {r.breakAway ? 'Ja' : 'Nee'}</span>
                        <span>{r.timeDifference}</span>
                    </div>
                </div>;
            })}

            <span>Pointsresults</span>

            {result.pointsClassification.filter((e) => e.place <= 20).map((rider) => {
                

                if (isTTTTeamResult(rider)) {
                    return <div key={`ttt-points-${rider.place}-${rider.team}`}>
                        <span>{rider.place}</span>
                        <div>{rider.team}</div>
                    </div>;
                }

                const r = rider as ClassificationRider;
                
                return <div key={`${r.firstName}-${r.lastName}`} className="flex flex-row gap-2">
                    <span className="min-w-10 text-center">#{r.place || '-'}</span>
                    <div className="grid grid-cols-4 gap-2 w-full">
                        <div>
                            <span>{rider?.country && iso2ToFlag(rider?.country)}</span><span className={rider?.country === 'nl' ? 'font-bold' : ''}>{r.firstName} {r.lastName}</span>
                        </div>
                        <span className="whitespace-nowrap">{r.team}</span>
                        <span>{r.points}</span>
                    </div>
                </div>;
            })}
        </div>
    );
}