import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { NextResponse } from 'next/server';
export const runtime = "nodejs";

export async function GET() {
    try {
        const db = getServerFirebaseFootball();

        // Fetch all poule documents which contain matches
        const poulesSnapshot = await db.collection('poules').get();

        interface Match {
            [key: string]: unknown;
        }
        
        const allMatches: Match[] = [];

        poulesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.matches) {
                // Convert matches object to array
                Object.entries(data.matches).forEach(([matchId, matchData]: [string, any]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    allMatches.push({
                        id: matchId,
                        pouleId: data.pouleId,
                        ...matchData
                    });
                });
            }
        });

        return NextResponse.json({
            matches: allMatches,
            count: allMatches.length
        });

    } catch (error) {
        console.error('Error fetching matches:', error);
        return NextResponse.json({
            error: 'Failed to fetch matches',
            details: error instanceof Error ? error.message : 'Unknown error',
            matches: []
        }, { status: 500 });
    }
}
