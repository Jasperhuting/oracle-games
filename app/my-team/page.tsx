import { getRiders } from "@/lib/scraper";

interface Rider {
    name: string;
    bib: number;
    team: string;
    country: string;
}

export default async function MyTeamPage() {

    const team = {
        riders: [1, 55, 26, 31, 12],
    }

    const stages = [1,2];

    const ridersPerTeam = await getRiders({ race: "tour-de-france", year: 2025 });

    const allRiders: Rider[] = [];

    ridersPerTeam.riders.forEach((team) => {
    
    team?.riders?.forEach((rider) => {

        allRiders.push({
            name: rider.name,
            bib: Number(rider.startNumber),
            team: team.name,
            country: rider.country,
        })

        
        // allRiders.push({
        //     firstName: rider.firstName,
        //     lastName: rider.lastName,
        //     bib: rider.bib,
        //     team: rider.team,
        //     country: rider.country,
        //     points: rider.points,
        // });
    });
    });    

    

    

    // const points = stageResults.reduce((acc, rider) => acc + Number(rider.place), 0) + resultsStage2.reduce((acc, rider) => acc + Number(rider.place), 0);
    const points = 0

    
    return (
        <div>
            <h1>My Team</h1>
            <p>Points: {points}</p>
            <ul>

                {team.riders.map((startNumber) => {
                    return <li key={allRiders.find((r) => r.bib === startNumber)?.name}>
                        {allRiders.find((r) => r.bib === startNumber)?.name}

                       
                        </li>
                })}

             </ul>
        </div>
    );
}