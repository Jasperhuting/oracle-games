import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import admin from 'firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Cron job to remind users about unused budget
 * Runs every 30 minutes via Vercel Cron
 *
 * Sends reminders to users who:
 * - Have an active auction closing in 5-7 hours
 * - Have less than 3 riders in their team
 * - Have more than 70% of their budget remaining
 * - Haven't received a reminder for this period yet
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
    console.log('[CRON] Checking for budget reminders', {
      checkTime: checkTime.toISOString(),
    });

    const results = {
      gamesChecked: 0,
      auctionsClosingSoon: 0,
      participantsChecked: 0,
      remindersNeeded: 0,
      messagesCreated: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    // Calculate time window: 5-7 hours from now (6 hours with 1 hour buffer)
    const sixHoursFromNow = new Date(checkTime.getTime() + 5 * 60 * 60 * 1000);
    const sixHoursUpperBound = new Date(checkTime.getTime() + 7 * 60 * 60 * 1000);

    console.log('[CRON] Looking for auctions ending between:', {
      from: sixHoursFromNow.toISOString(),
      to: sixHoursUpperBound.toISOString(),
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
        // Find active auction periods that end in ~6 hours
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

          // Check if auction ends in 5-7 hours
          if (endDate >= sixHoursFromNow && endDate <= sixHoursUpperBound) {
            console.log('[CRON] Found auction closing in ~6 hours', {
              gameId,
              gameName: game.name,
              periodName: period.name,
              endDate: endDate.toISOString(),
              hoursUntilClose: Math.round((endDate.getTime() - checkTime.getTime()) / (60 * 60 * 1000)),
            });

            results.auctionsClosingSoon++;

            // Check if we already sent budget reminders for this period
            if (period.budgetReminderSent) {
              console.log('[CRON] Already sent budget reminders for this period, skipping', {
                gameId,
                periodName: period.name,
              });
              continue;
            }

            // Get all active participants
            const participantsSnapshot = await db
              .collection('gameParticipants')
              .where('gameId', '==', gameId)
              .where('status', '==', 'active')
              .get();

            console.log(`[CRON] Checking ${participantsSnapshot.size} participants for budget reminders`);
            results.participantsChecked += participantsSnapshot.size;

            // Helper function to add delay between emails (Resend rate limit: 2 requests/second)
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            let emailIndex = 0;
            for (const participantDoc of participantsSnapshot.docs) {
              const participant = participantDoc.data();
              const userId = participant.userId;

              try {
                // Get total budget
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

                // Get rider count in team
                const playerTeamSnapshot = await db
                  .collection('playerTeams')
                  .where('gameId', '==', gameId)
                  .where('userId', '==', userId)
                  .where('active', '==', true)
                  .get();

                const riderCount = playerTeamSnapshot.size;

                // Calculate budget percentage remaining
                const budgetPercentageRemaining = totalBudget > 0 ? (availableBudget / totalBudget) * 100 : 0;

                // Check if user needs a reminder:
                // - Less than 3 riders
                // - More than 70% budget remaining
                if (riderCount < 3 && budgetPercentageRemaining > 70) {
                  console.log(`[CRON] User needs budget reminder`, {
                    userId,
                    playername: participant.playername,
                    riderCount,
                    budgetPercentageRemaining: Math.round(budgetPercentageRemaining),
                    availableBudget,
                    totalBudget,
                  });

                  results.remindersNeeded++;

                  // Calculate hours until close for notification text
                  const hoursUntilClose = Math.round((endDate.getTime() - checkTime.getTime()) / (60 * 60 * 1000));

                  // Create in-app message
                  const subject = `💰 Je hebt nog veel budget over!`;

                  let messageText = `De veiling "${period.name}" in game "${game.name}" sluit over ongeveer ${hoursUntilClose} uur.\n\n`;
                  messageText += `Je hebt momenteel ${riderCount} ${riderCount === 1 ? 'renner' : 'renners'} in je team en nog €${availableBudget.toLocaleString('nl-NL')} (${Math.round(budgetPercentageRemaining)}%) van je budget beschikbaar.\n\n`;

                  if (activeBidsSnapshot.size > 0) {
                    messageText += `Je hebt ${activeBidsSnapshot.size} actieve ${activeBidsSnapshot.size === 1 ? 'bieding' : 'biedingen'} staan voor €${committedBudget.toLocaleString('nl-NL')}.\n\n`;
                  } else {
                    messageText += `Je hebt momenteel geen actieve biedingen staan.\n\n`;
                  }

                  messageText += `Vergeet niet om je resterende budget te gebruiken voordat de veiling sluit!`;

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
                        emailNotificationSent: false,
                      });

                      results.messagesCreated++;
                      console.log(`[CRON] Created budget reminder message for user ${userId}`);
                    } catch (messageError) {
                      console.error(`[CRON] Failed to create message for user ${userId}:`, messageError);
                      results.errors.push(`Message creation failed for ${userId}`);
                    }
                  } else {
                    console.log(`[CRON] DRY-RUN: Would create budget reminder for user ${userId}`);
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
                      console.log(`[CRON] DRY-RUN: Would send budget reminder email to ${email}`);
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

                      let emailBody = `Hallo ${displayName},\n\nDe veiling "${period.name}" in game "${game.name}" sluit over ongeveer ${hoursUntilClose} uur!\n\n`;
                      emailBody += `Je hebt momenteel ${riderCount} ${riderCount === 1 ? 'renner' : 'renners'} in je team en nog €${availableBudget.toLocaleString('nl-NL')} (${Math.round(budgetPercentageRemaining)}%) van je budget beschikbaar.\n\n`;

                      if (activeBidsSnapshot.size > 0) {
                        emailBody += `Je hebt ${activeBidsSnapshot.size} actieve ${activeBidsSnapshot.size === 1 ? 'bieding' : 'biedingen'} staan voor €${committedBudget.toLocaleString('nl-NL')}.\n\n`;
                      } else {
                        emailBody += `Je hebt momenteel geen actieve biedingen staan.\n\n`;
                      }

                      emailBody += `Vergeet niet om je resterende budget te gebruiken voordat de veiling sluit!\n\n`;
                      emailBody += `Log nu in om te bieden:\n${baseUrl}/games/${gameId}\n\nMet vriendelijke groet,\nHet Oracle Games team`;

                      const result = await resend.emails.send({
                        from: 'Oracle Games <no-reply@send.oracle-games.online>',
                        to: [email],
                        subject: `💰 Je hebt nog veel budget over in "${game.name}"`,
                        html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                          <p>${emailBody.replace(/\n/g, '<br>')}</p>
                        </div>`,
                      });

                      if (result.error) {
                        console.error(`[CRON] Resend API error for ${email}:`, result.error);
                        results.errors.push(`Resend error for ${email}: ${result.error.message}`);
                      } else {
                        results.emailsSent++;
                        console.log(`[CRON] Budget reminder email sent to ${email} (ID: ${result.data?.id})`);

                        // Add delay to respect Resend rate limit
                        emailIndex++;
                        await delay(600);
                      }
                    }
                  } catch (emailError) {
                    console.error(`[CRON] Failed to send email to user ${userId}:`, emailError);
                    results.errors.push(`Email send failed for ${userId}`);
                  }
                }
              } catch (userError) {
                console.error(`[CRON] Error processing user ${userId}:`, userError);
                results.errors.push(`Error processing user ${userId}`);
              }
            }

            // Mark this period as budget reminder sent to prevent duplicates
            if (!dryRun && results.remindersNeeded > 0) {
              try {
                const updatedPeriods = game.config.auctionPeriods.map((p: any) => {
                  if (p.name === period.name) {
                    return {
                      ...p,
                      budgetReminderSent: true,
                      budgetReminderSentAt: new Date().toISOString(),
                    };
                  }
                  return p;
                });

                await gameDoc.ref.update({
                  'config.auctionPeriods': updatedPeriods,
                  updatedAt: new Date().toISOString(),
                });

                console.log('[CRON] Marked period as budget reminder sent', {
                  gameId,
                  periodName: period.name,
                });
              } catch (updateError) {
                console.error('[CRON] Failed to mark period as reminded:', updateError);
                results.errors.push(`Failed to mark period ${period.name} as reminded`);
              }
            } else if (dryRun && results.remindersNeeded > 0) {
              console.log(`[CRON] DRY-RUN: Would mark period ${period.name} as budget reminder sent`);
            }
          }
        }
      } catch (error) {
        console.error(`[CRON] Error processing game ${gameId}:`, error);
        results.errors.push(`Error processing ${gameId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('[CRON] Budget reminder check complete', results);

    return Response.json({
      success: true,
      timestamp: checkTime.toISOString(),
      ...results,
    });
  } catch (error) {
    console.error('[CRON] Error in send-budget-reminders:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Timestamp.now(),
      },
      { status: 500 }
    );
  }
}
