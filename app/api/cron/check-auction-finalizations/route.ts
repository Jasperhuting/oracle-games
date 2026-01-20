import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { finalizeAuction } from '@/lib/auction/finalize';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Cron job to check and finalize auction periods
 * Runs every minute via Vercel Cron
 *
 * Handles:
 * - Automatic period status transitions (pending → active → closed)
 * - Automatic finalization when finalizeDate is reached
 * - Game status updates (registration → bidding)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify Vercel Cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('[CRON] Unauthorized access attempt');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const checkTime = new Date();
    console.log('[CRON] Checking auction finalizations and status updates', {
      checkTime: checkTime.toISOString(),
    });

    const results = {
      gamesChecked: 0,
      statusUpdates: 0,
      finalizationsTriggered: 0,
      errors: [] as string[],
    };

    // Get all games with auction periods
    const gamesSnapshot = await db.collection('games').get();

    results.gamesChecked = gamesSnapshot.size;
    console.log(`[CRON] Found ${gamesSnapshot.size} games to check`);

    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      const gameId = gameDoc.id;

      // Only process games with auction periods
      if (!game.config?.auctionPeriods || !Array.isArray(game.config.auctionPeriods)) {
        continue;
      }

      try {
        let gameNeedsUpdate = false;
        let gameStatusNeedsUpdate = false;
        let newGameStatus = game.status;
        const updatedPeriods = [];

        for (const period of game.config.auctionPeriods) {
          let updatedPeriod = { ...period };
          let periodChanged = false;

          // Convert dates to Date objects
          const toDate = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value === 'string') return new Date(value);
            if (typeof value.toDate === 'function') return value.toDate();
            return null;
          };

          const startDate = toDate(period.startDate);
          const endDate = toDate(period.endDate);
          const finalizeDate = period.finalizeDate ? toDate(period.finalizeDate) : null;

          // Automatic status transitions based on dates
          if (startDate && endDate) {
            // 1. Check if auction should become active
            if (period.status === 'pending' && checkTime >= startDate && checkTime < endDate) {
              updatedPeriod.status = 'active';
              periodChanged = true;
              console.log('[CRON] Auto-updating period status to active', {
                gameId,
                periodName: period.name,
              });

              // Also update game status to 'bidding' if not already
              if (game.status === 'registration') {
                newGameStatus = 'bidding';
                gameStatusNeedsUpdate = true;
                console.log('[CRON] Auto-updating game status to bidding', {
                  gameId,
                  periodName: period.name,
                });
              }
            }

            // 2. Check if auction should be closed (but not finalized yet)
            if (period.status === 'active' && checkTime >= endDate) {
              // Only close if we don't have a finalize date, or if finalize date hasn't been reached
              if (!finalizeDate || checkTime < finalizeDate) {
                updatedPeriod.status = 'closed';
                periodChanged = true;
                console.log('[CRON] Auto-updating period status to closed', {
                  gameId,
                  periodName: period.name,
                });
              }
            }
          }

          // 3. Check if auction should be finalized
          if (finalizeDate && checkTime >= finalizeDate) {
            // Skip periods that are already finalized
            if (period.status === 'finalized') {
              console.log('[CRON] Skipping already finalized period', {
                gameId,
                periodName: period.name,
              });
              updatedPeriods.push(updatedPeriod);
              continue;
            }

            // Only finalize if status is active or closed (NOT if already finalized or pending)
            if (period.status === 'active' || period.status === 'closed') {
              console.log('[CRON] Finalizing auction period', {
                gameId,
                gameName: game.name,
                periodName: period.name,
                finalizeDate: finalizeDate.toISOString(),
                currentStatus: period.status,
              });

              // Call the finalize function directly (no HTTP call needed)
              // The finalize function will handle updating the period status in the database
              try {
                console.log('[CRON] Calling finalize function directly:', {
                  gameId,
                  periodName: period.name,
                });

                const result = await finalizeAuction({
                  gameId,
                  auctionPeriodName: period.name,
                });

                if (!result.success) {
                  console.error('[CRON] Finalize failed', {
                    gameId,
                    periodName: period.name,
                    error: result.error,
                    details: result.details,
                  });
                  results.errors.push(`Finalize failed for ${gameId}/${period.name}: ${result.error}`);
                } else {
                  results.finalizationsTriggered++;
                  console.log('[CRON] Auction finalized successfully', {
                    gameId,
                    periodName: period.name,
                    winnersAssigned: result.results?.winnersAssigned,
                    totalParticipants: result.results?.totalParticipants,
                    processedParticipants: result.results?.processedParticipants,
                  });

                  // Check if finalization was incomplete
                  if (result.results && 
                      result.results.processedParticipants < result.results.totalParticipants) {
                    console.warn('[CRON] Finalization was incomplete!', {
                      gameId,
                      periodName: period.name,
                      processed: result.results.processedParticipants,
                      total: result.results.totalParticipants,
                      lastProcessedUserId: result.results.lastProcessedUserId,
                    });
                    
                    // Try to resume from where it left off
                    console.log('[CRON] Attempting to resume finalization...');
                    const resumeResult = await finalizeAuction({
                      gameId,
                      auctionPeriodName: period.name,
                      resumeFromUserId: result.results.lastProcessedUserId,
                    });

                    if (resumeResult.success) {
                      console.log('[CRON] Resume successful', {
                        gameId,
                        periodName: period.name,
                        additionalProcessed: resumeResult.results?.processedParticipants,
                      });
                      results.finalizationsTriggered++; // Count as additional finalization
                    } else {
                      console.error('[CRON] Resume failed', {
                        gameId,
                        periodName: period.name,
                        error: resumeResult.error,
                      });
                      results.errors.push(`Resume failed for ${gameId}/${period.name}: ${resumeResult.error}`);
                    }
                  }
                }
              } catch (error) {
                console.error('[CRON] Error finalizing auction', {
                  gameId,
                  periodName: period.name,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
                results.errors.push(`Finalize error for ${gameId}/${period.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }

              // Skip the rest of the loop - finalize function already updated the database
              // Don't add to updatedPeriods to avoid duplicate updates
              continue;
            }
          }

          if (periodChanged) {
            results.statusUpdates++;
            gameNeedsUpdate = true;
          }

          updatedPeriods.push(updatedPeriod);
        }

        // Update game if any periods changed or game status needs update
        if (gameNeedsUpdate || gameStatusNeedsUpdate) {
          // CRITICAL SAFETY CHECK: Validate that we're not accidentally deleting periods
          const originalPeriods = game.config?.auctionPeriods || [];
          if (gameNeedsUpdate && originalPeriods.length > 0 && updatedPeriods.length !== originalPeriods.length) {
            console.error('[CRON] CRITICAL ERROR: Period count mismatch detected!', {
              gameId,
              originalCount: originalPeriods.length,
              updatedCount: updatedPeriods.length,
              originalPeriods: originalPeriods.map((p: any) => p.name),
              updatedPeriods: updatedPeriods.map((p: any) => p.name),
            });
            results.errors.push(`CRITICAL: Period count mismatch for ${gameId}. Skipping update to prevent data loss.`);
            continue; // Skip this game to prevent data corruption
          }

          const updateData: any = {
            updatedAt: new Date().toISOString(),
          };

          if (gameStatusNeedsUpdate) {
            updateData.status = newGameStatus;
          }

          if (gameNeedsUpdate) {
            updateData['config.auctionPeriods'] = updatedPeriods;
          }

          await gameDoc.ref.update(updateData);

          console.log('[CRON] Successfully auto-updated game', {
            gameId,
            statusUpdated: gameStatusNeedsUpdate,
            periodsUpdated: gameNeedsUpdate,
          });
        }
      } catch (error) {
        console.error(`[CRON] Error processing game ${gameId}:`, error);
        results.errors.push(`Error processing ${gameId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('[CRON] Check complete', results);

    return Response.json({
      success: true,
      timestamp: checkTime.toISOString(),
      ...results,
    });
  } catch (error) {
    console.error('[CRON] Error in check-auction-finalizations:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Timestamp.now(),
      },
      { status: 500 }
    );
  }
}
