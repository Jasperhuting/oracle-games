import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import admin from 'firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Cron job to notify users about auctions closing in 1 hour
 * Runs every 15 minutes via Vercel Cron
 *
 * Handles:
 * - Finds active auction periods ending in 55-65 minutes (1 hour window with 10 min buffer)
 * - Notifies all participants with available budget
 * - Creates in-app message
 * - Sends email notification directly (if user has emailNotifications enabled)
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

    // Dry-run mode: test without actually sending notifications
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
    if (dryRun) {
      console.log('[CRON] Running in DRY-RUN mode (no notifications will be sent)');
    }

    const checkTime = new Date();
    console.log('[CRON] Checking for auctions closing soon', {
      checkTime: checkTime.toISOString(),
    });

    const results = {
      gamesChecked: 0,
      auctionsClosingSoon: 0,
      participantsNotified: 0,
      messagesCreated: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    // Calculate time window: 55-65 minutes from now (1 hour with 10 min buffer)
    const oneHourFromNow = new Date(checkTime.getTime() + 55 * 60 * 1000);
    const oneHourUpperBound = new Date(checkTime.getTime() + 65 * 60 * 1000);

    console.log('[CRON] Looking for auctions ending between:', {
      from: oneHourFromNow.toISOString(),
      to: oneHourUpperBound.toISOString(),
    });

    // Get all games
    const gamesSnapshot = await db.collection('games').get();
    results.gamesChecked = gamesSnapshot.size;

    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      const gameId = gameDoc.id;

      // Only process games with auction periods
      if (!game.config?.auctionPeriods || !Array.isArray(game.config.auctionPeriods)) {
        continue;
      }

      try {
        // Find active auction periods that end in ~1 hour
        for (const period of game.config.auctionPeriods) {
          // Only check active periods
          if (period.status !== 'active') {
            continue;
          }

          // Convert endDate to Date object
          const toDate = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value === 'string') return new Date(value);
            if (typeof value.toDate === 'function') return value.toDate();
            return null;
          };

          const endDate = toDate(period.endDate);
          if (!endDate) {
            continue;
          }

          // Check if auction ends in 55-65 minutes
          if (endDate >= oneHourFromNow && endDate <= oneHourUpperBound) {
            console.log('[CRON] Found auction closing in ~1 hour', {
              gameId,
              gameName: game.name,
              periodName: period.name,
              endDate: endDate.toISOString(),
              minutesUntilClose: Math.round((endDate.getTime() - checkTime.getTime()) / 60000),
            });

            results.auctionsClosingSoon++;

            // Check if we already sent notifications for this period
            // We store this in the period object to prevent duplicate notifications
            if (period.closingNotificationSent) {
              console.log('[CRON] Already sent closing notification for this period, skipping', {
                gameId,
                periodName: period.name,
              });
              continue;
            }

            // Get all participants with available budget
            const participantsSnapshot = await db
              .collection('gameParticipants')
              .where('gameId', '==', gameId)
              .where('status', '==', 'active')
              .get();

            console.log(`[CRON] Found ${participantsSnapshot.size} active participants in game ${gameId}`);

            // Calculate minutes until close for notification text
            const minutesUntilClose = Math.round((endDate.getTime() - checkTime.getTime()) / 60000);

            // Helper function to add delay between emails (Resend rate limit: 2 requests/second)
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            // Process each participant
            let emailIndex = 0;
            for (const participantDoc of participantsSnapshot.docs) {
              const participant = participantDoc.data();
              const userId = participant.userId;

              // Calculate available budget
              const totalBudget = participant.budget || 0;
              const spentBudget = participant.spentBudget || 0;

              // Get active bids to calculate committed budget
              const activeBidsSnapshot = await db
                .collection('bids')
                .where('gameId', '==', gameId)
                .where('userId', '==', userId)
                .where('status', '==', 'active')
                .get();

              const committedBudget = activeBidsSnapshot.docs.reduce((sum, bidDoc) => {
                return sum + (bidDoc.data().amount || 0);
              }, 0);

              const availableBudget = totalBudget - spentBudget - committedBudget;

              // Only notify if user has available budget OR has active bids
              if (availableBudget <= 0 && activeBidsSnapshot.size === 0) {
                console.log(`[CRON] Skipping user ${userId} - no available budget and no active bids`, {
                  totalBudget,
                  spentBudget,
                  committedBudget,
                  availableBudget,
                  activeBids: 0,
                });
                continue;
              }

              console.log(`[CRON] Notifying user ${userId} (${participant.playername})`, {
                availableBudget,
                activeBids: activeBidsSnapshot.size,
              });

              // Create in-app message
              const subject = `⏰ Veiling sluit over ${minutesUntilClose} minuten!`;

              let messageText = `De veiling "${period.name}" in game "${game.name}" sluit over ongeveer ${minutesUntilClose} minuten.\n\n`;

              if (activeBidsSnapshot.size > 0) {
                messageText += `Je hebt ${activeBidsSnapshot.size} actieve ${activeBidsSnapshot.size === 1 ? 'bieding' : 'biedingen'} staan voor een totaal van €${committedBudget.toLocaleString('nl-NL')}.\n\n`;
              }

              if (availableBudget > 0) {
                messageText += `Je hebt nog €${availableBudget.toLocaleString('nl-NL')} beschikbaar om te bieden.\n\n`;
              }

              messageText += `Haast je om je laatste biedingen te plaatsen of aan te passen!`;

              const message = messageText;

              if (!dryRun) {
                try {
                  const now = admin.firestore.Timestamp.now();
                  await db.collection('messages').add({
                    type: 'individual',
                    senderId: 'system',
                    senderName: 'Oracle Games',
                    recipientId: userId,
                    recipientName: participant.playername,
                    gameId: gameId,
                    gameName: game.name,
                    subject,
                    message,
                    sentAt: now,
                    read: false,
                    emailNotificationSent: false, // Will be picked up by send-message-notifications cron
                  });

                  results.messagesCreated++;
                  console.log(`[CRON] Created in-app message for user ${userId}`);
                } catch (messageError) {
                  console.error(`[CRON] Failed to create message for user ${userId}:`, messageError);
                  results.errors.push(`Message creation failed for ${userId}`);
                }
              } else {
                console.log(`[CRON] DRY-RUN: Would create message for user ${userId}`);
                results.messagesCreated++;
              }

              // Send direct email notification
              try {
                // Get user email
                const userDoc = await db.collection('users').doc(userId).get();

                if (!userDoc.exists) {
                  console.warn(`[CRON] User ${userId} not found, skipping email`);
                  continue;
                }

                const userData = userDoc.data();
                const email = userData?.email;

                if (!email) {
                  console.warn(`[CRON] User ${userId} has no email, skipping`);
                  continue;
                }

                // Check if user has email notifications enabled (default to true)
                const emailNotificationsEnabled = userData?.emailNotifications !== false;

                if (!emailNotificationsEnabled) {
                  console.log(`[CRON] User ${userId} has email notifications disabled, skipping email`);
                  continue;
                }

                if (dryRun) {
                  console.log(`[CRON] DRY-RUN: Would send email to ${email}`);
                  results.emailsSent++;
                } else {
                  const apiKey = process.env.RESEND_API_KEY;

                  if (!apiKey) {
                    console.error('[CRON] RESEND_API_KEY not configured');
                    results.errors.push('Resend not configured');
                    continue;
                  }

                  const resend = new Resend(apiKey);

                  const displayName = userData?.displayName || participant.playername || 'daar';
                  const baseUrl = process.env.VERCEL_URL
                    ? `https://${process.env.VERCEL_URL}`
                    : 'https://oracle-games.online';

                  let emailBody = `Hallo ${displayName},\n\nDe veiling "${period.name}" in game "${game.name}" sluit over ongeveer ${minutesUntilClose} minuten!\n\n`;

                  if (activeBidsSnapshot.size > 0) {
                    emailBody += `Je hebt ${activeBidsSnapshot.size} actieve ${activeBidsSnapshot.size === 1 ? 'bieding' : 'biedingen'} staan voor een totaal van €${committedBudget.toLocaleString('nl-NL')}.\n\n`;
                  }

                  if (availableBudget > 0) {
                    emailBody += `Je hebt nog €${availableBudget.toLocaleString('nl-NL')} beschikbaar om te bieden.\n\n`;
                  }

                  emailBody += `Log nu in om je laatste biedingen te plaatsen of aan te passen:\n${baseUrl}/games/${gameId}\n\nMet vriendelijke groet,\nHet Oracle Games team`;

                  const result = await resend.emails.send({
                    from: 'Oracle Games <no-reply@send.oracle-games.online>',
                    to: [email],
                    subject: `⏰ Veiling "${period.name}" sluit over ${minutesUntilClose} minuten!`,
                    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                      <p>${emailBody.replace(/\n/g, '<br>')}</p>
                    </div>`,
                  });

                  if (result.error) {
                    console.error(`[CRON] Resend API error for ${email}:`, result.error);
                    results.errors.push(`Resend error for ${email}: ${result.error.message}`);
                  } else {
                    results.emailsSent++;
                    console.log(`[CRON] Email sent successfully to ${email} (ID: ${result.data?.id})`);

                    // Add delay to respect Resend rate limit (2 requests/second = 500ms between requests)
                    emailIndex++;
                    if (emailIndex < participantsSnapshot.size) {
                      await delay(600);
                    }
                  }
                }
              } catch (emailError) {
                console.error(`[CRON] Failed to send email to user ${userId}:`, emailError);
                results.errors.push(`Email send failed for ${userId}`);
              }

              results.participantsNotified++;
            }

            // Mark this period as notification sent to prevent duplicates
            if (!dryRun) {
              try {
                const updatedPeriods = game.config.auctionPeriods.map((p: any) => {
                  if (p.name === period.name) {
                    return {
                      ...p,
                      closingNotificationSent: true,
                      closingNotificationSentAt: new Date().toISOString(),
                    };
                  }
                  return p;
                });

                await gameDoc.ref.update({
                  'config.auctionPeriods': updatedPeriods,
                  updatedAt: new Date().toISOString(),
                });

                console.log('[CRON] Marked period as notification sent', {
                  gameId,
                  periodName: period.name,
                });
              } catch (updateError) {
                console.error('[CRON] Failed to mark period as notified:', updateError);
                results.errors.push(`Failed to mark period ${period.name} as notified`);
              }
            } else {
              console.log(`[CRON] DRY-RUN: Would mark period ${period.name} as notification sent`);
            }
          }
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
    console.error('[CRON] Error in check-auction-closing-soon:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Timestamp.now(),
      },
      { status: 500 }
    );
  }
}
