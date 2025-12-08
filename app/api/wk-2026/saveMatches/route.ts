import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";

interface Match {
    id: string;
    pouleId: string;
    team1Id: string;
    team2Id: string;
    team1Score: number | null;
    team2Score: number | null;
}

export async function POST(request: NextRequest) {
    try {
        const { matches } = await request.json();

        const db = getServerFirebaseFootball();

        console.log("Matches to save:", matches.length);

        // Group matches by poule
        const matchesByPoule: { [pouleId: string]: Match[] } = {};

        matches.forEach((match: Match) => {
            if (!matchesByPoule[match.pouleId]) {
                matchesByPoule[match.pouleId] = [];
            }
            matchesByPoule[match.pouleId].push(match);
        });

        // Save matches for each poule
        const updatePromises = Object.entries(matchesByPoule).map(async ([pouleId, pouleMatches]) => {
            const matchesData = pouleMatches.reduce((acc, match) => {
                acc[match.id] = {
                    team1Id: match.team1Id,
                    team2Id: match.team2Id,
                    team1Score: match.team1Score,
                    team2Score: match.team2Score
                };
                return acc;
            }, {} as any); // eslint-disable-line @typescript-eslint/no-explicit-any

            console.log(`Saving matches for poule ${pouleId}`);

            return db.collection('poules').doc(`poule_${pouleId}`).update({
                matches: matchesData,
                matchesUpdatedAt: new Date().toISOString()
            });
        });

        await Promise.all(updatePromises);

        return NextResponse.json({
            message: 'Matches saved successfully',
            poulesUpdated: Object.keys(matchesByPoule).length,
            matchesSaved: matches.length
        });

    } catch (error) {
        console.error('Error saving matches:', error);
        return NextResponse.json({
            error: 'Failed to save matches',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
