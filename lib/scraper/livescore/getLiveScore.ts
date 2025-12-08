import { getServerFirebaseFootball } from '@/lib/firebase/server';

export async function getLiveScores(): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any


    const clubs = [
  "FC Copenhagen",
  "Kairat Almaty",
  "Pafos FC",
  "AS Monaco",
  "Arsenal",
  "Bayern Munich",
  "Atletico Madrid",
  "Inter",
  "Eintracht Frankfurt",
  "Atalanta",
  "Liverpool",
  "PSV Eindhoven",
  "Olympiacos",
  "Real Madrid",
  "Paris Saint-Germain",
  "Tottenham Hotspur",
  "Sporting CP",
  "Club Brugge"
]

    const getCountryClub = (name: string) => {

        // TESTDATA FOR WK2026

        if (name === clubs[0]) {
            return 'united_states'
        }
        if (name === clubs[1]) {
            return 'morocco'
        }
        if (name === clubs[2]) {
            return 'saudi_arabia'
        }
        if (name === clubs[3]) {
            return 'argentina'
        }        
        if (name === clubs[4]) {
            return 'senegal'
        }
        if (name === clubs[5]) {
            return 'qatar'
        }
        if (name === clubs[6]) {
            return 'rp_congo'
        }

        return name;
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const url = `https://prod-cdn-mev-api.livescore.com/v1/api/app/date/soccer/${year}${month}${day}/1?countryCode=NL&locale=en`;


    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Node Script)',
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();


    const stages = data.Stages;

    // THIS SHOULD BE WK2026 IF THE GAMES ARE LIVE OFFCOURSE

    const championsLeagueStage = stages.filter((stage: any) => stage.Ccd === 'champions-league'); // eslint-disable-line @typescript-eslint/no-explicit-any

    const games = championsLeagueStage[0]?.Events;

    console.log('Champions League games:', games);

    // Save live scores directly to database
    try {
        const db = getServerFirebaseFootball();

        for (const game of games) {
            const homeTeam = game.T1[0];
            const awayTeam = game.T2[0];

            const homeScore = game.Tr1;
            const awayScore = game.Tr2;

            const isHomeWin = homeScore > awayScore;
            const isAwayWin = awayScore > homeScore;
            const isDraw = homeScore === awayScore;

            const gameIsFinished = game.Eps === 'FT';
            const gameIsHalftime = game.Eps === 'HT';


            await db.collection('livescores').doc(game.Eid).set({
                homeTeam: getCountryClub(homeTeam.Nm),
                homeTeamReal: homeTeam.Nm,
                awayTeam: getCountryClub(awayTeam.Nm),
                awayTeamReal: awayTeam.Nm,
                homeScore: Number(homeScore),
                awayScore: Number(awayScore),
                isHomeWin: Boolean(isHomeWin),
                isAwayWin: Boolean(isAwayWin),
                isDraw: Boolean(isDraw),
                gameIsFinished: Boolean(gameIsFinished),
                gameIsHalftime: Boolean(gameIsHalftime),
                updatedAt: new Date().toISOString()
            });
        }

        console.log('Live scores saved successfully');
    } catch (error) {
        console.error('Error saving live scores:', error);
    }

    // TODO: Implement live score fetching logic / mapping
    return games || data;

}