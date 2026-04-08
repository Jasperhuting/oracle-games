import { POULES, TeamInPoule } from '@/app/wk-2026/page';
import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const { teams } = await request.json();

        const db = getServerFirebaseFootball();

        console.log("Teams to update:", teams);

        // Group teams by poule
        const pouleMap: { [key: string]: TeamInPoule[] } = {};

        teams.forEach((team: TeamInPoule) => {
            if (team.poule) {
                if (!pouleMap[team.poule]) {
                    pouleMap[team.poule] = [];
                }
                pouleMap[team.poule].push(team);
            }
        });

        // Update each poule with all its teams
        const updatePromises = Object.entries(pouleMap).map(async ([pouleId, pouleTeams]) => {
            const teamIds = pouleTeams.map(t => t.id);
            const teamData = pouleTeams.reduce((acc, team) => {
                // Derive position from pot if not explicitly set (pot 1→0, 2→1, 3→2, 4→3)
                const position = (team.position !== null && team.position !== undefined)
                    ? team.position
                    : (typeof team.pot === 'number' ? team.pot - 1 : null);
                acc[team.id] = {
                    name: team.name,
                    pot: team.pot,
                    position,
                    ...(team.possibleTeams ? { possibleTeams: team.possibleTeams } : {})
                };
                return acc;
            }, {} as any); // eslint-disable-line @typescript-eslint/no-explicit-any

            console.log(`Updating poule ${pouleId} with teams:`, teamIds);

            return db.collection('poules').doc(`poule_${pouleId}`).set({
                pouleId: pouleId,
                teamIds: teamIds,
                teams: teamData,
                updatedAt: new Date().toISOString()
            });
        });

        await Promise.all(updatePromises);

        return NextResponse.json({
            message: 'Poules updated successfully',
            poulesUpdated: Object.keys(pouleMap).length,
            teamsAssigned: teams.length
        });

    } catch (error) {
        console.error('Error updating poules:', error);
        return NextResponse.json({
            error: 'Failed to update poules',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}