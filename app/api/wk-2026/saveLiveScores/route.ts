import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const data = await request.json();
    console.log('Received live scores data:', data);

    const db = getServerFirebaseFootball();


    for (const game of data) {

        const homeTeam = game.T1[0];
        const awayTeam = game.T2[0];

        const homeScore = game.Tr1;
        const awayScore = game.Tr2;

        const isHomeWin = homeScore > awayScore;
        const isAwayWin = awayScore > homeScore;
        const isDraw = homeScore === awayScore;

        const gameIsFinished = game.Eps === 'FT';
        const gameIsHalftime = game.Eps === 'HT';

        
        await db.collection('livescores').doc(game.id).set({
            homeTeam,
            awayTeam,
            homeScore,
            awayScore,
            isHomeWin,
            isAwayWin,
            isDraw,
            gameIsFinished,
            gameIsHalftime,
            updatedAt: new Date().toISOString()
        });
        

    }

    return NextResponse.json({ message: 'Live scores saved' });
}
