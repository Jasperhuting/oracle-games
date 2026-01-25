import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated PHASE 3: This endpoint is deprecated and no longer functional.
 *
 * This endpoint previously migrated the gameParticipants.team[] array
 * (renaming 'amount' field to 'pricePaid'). Since team[] is now deprecated
 * and playerTeams is the single source of truth, this migration is no longer needed.
 *
 * All team data should be read from the playerTeams collection, which already
 * uses 'pricePaid' as the field name.
 *
 * This endpoint is kept for backwards compatibility but returns a deprecation notice.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  console.log(`[MIGRATE_PARTICIPANT_TEAMS] DEPRECATED: This endpoint no longer modifies team[]`);
  console.log(`[MIGRATE_PARTICIPANT_TEAMS] playerTeams is now the source of truth`);

  return NextResponse.json({
    success: false,
    deprecated: true,
    message: 'DEPRECATED: This endpoint no longer modifies team[].',
    note: 'The gameParticipants.team[] array is being phased out. All team data should be read from the playerTeams collection instead.',
    gameId,
    action: 'none',
    recommendation: 'Use the playerTeams collection directly. It already uses "pricePaid" as the field name.',
  });
}
