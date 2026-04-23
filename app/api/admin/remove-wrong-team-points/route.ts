import { getServerFirebase } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { PointsEvent } from '@/lib/types/games';

/**
 * Verwijder onterecht toegekende ploegenklassement-punten uit de database.
 * Alleen punten met teamPoints voor races != 'giro-d-italia' worden verwijderd.
 *
 * POST /api/admin/remove-wrong-team-points
 * Body: { dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = true } = body;

    const db = getServerFirebase();

    const snapshot = await db.collection('playerTeams').get();

    const results = {
      total: snapshot.size,
      affected: 0,
      pointsRemoved: 0,
      errors: [] as string[],
      samples: [] as object[],
    };

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const breakdown: PointsEvent[] = Array.isArray(data.pointsBreakdown) ? data.pointsBreakdown : [];

        const wrongEntries = breakdown.filter(
          (e) => e.teamPoints && e.teamPoints > 0 && e.raceSlug !== 'giro-d-italia'
        );

        if (wrongEntries.length === 0) continue;

        const cleanedBreakdown = breakdown.map((e) => {
          if (e.teamPoints && e.teamPoints > 0 && e.raceSlug !== 'giro-d-italia') {
            const correctedTotal = (e.total || 0) - e.teamPoints;
            if (correctedTotal <= 0) return null;
            const { teamPoints, ...rest } = e;
            return { ...rest, total: correctedTotal };
          }
          return e;
        }).filter(Boolean) as PointsEvent[];

        const removedPoints = wrongEntries.reduce((sum, e) => sum + (e.teamPoints || 0), 0);
        const newTotal = cleanedBreakdown.reduce((sum, e) => sum + (e.total || 0), 0);

        if (results.samples.length < 5) {
          results.samples.push({
            id: doc.id,
            riderName: data.riderName,
            wrongEntries: wrongEntries.map((e) => ({ raceSlug: e.raceSlug, stage: e.stage, teamPoints: e.teamPoints })),
            oldPointsScored: data.pointsScored,
            newPointsScored: newTotal,
          });
        }

        if (!dryRun) {
          await doc.ref.update({
            pointsBreakdown: cleanedBreakdown,
            pointsScored: newTotal,
          });
        }

        results.affected++;
        results.pointsRemoved += removedPoints;
      } catch (error) {
        results.errors.push(`${doc.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run: ${results.affected} renners gevonden met onterechte ploegenklassement-punten (${results.pointsRemoved} pts).`
        : `Klaar: ${results.affected} renners gecorrigeerd, ${results.pointsRemoved} onterechte punten verwijderd.`,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Mislukt', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
