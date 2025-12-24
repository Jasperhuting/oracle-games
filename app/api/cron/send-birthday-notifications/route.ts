import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Resend } from 'resend';
import admin from 'firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Cron job to send birthday notifications to users
 * Runs daily at 12:00 noon (Amsterdam time) via Vercel Cron
 *
 * Handles:
 * - Finds users with birthday today
 * - Calculates their new age
 * - Sends congratulations message in-app
 * - Sends birthday email
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

    const now = new Date();
    console.log('[CRON] Checking for birthdays', {
      timestamp: now.toISOString(),
    });

    const results = {
      usersChecked: 0,
      birthdaysFound: 0,
      messagesCreated: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    // Get today's month and day (format: MM-DD)
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
    const todayDay = String(now.getDate()).padStart(2, '0');
    const todayMMDD = `${todayMonth}-${todayDay}`;

    console.log('[CRON] Looking for birthdays on:', todayMMDD);

    // Get all users with a dateOfBirth
    const usersSnapshot = await db.collection('users').get();
    results.usersChecked = usersSnapshot.size;

    console.log(`[CRON] Checking ${usersSnapshot.size} users for birthdays`);

    // Helper function to add delay between emails (Resend rate limit: 2 requests/second)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let emailIndex = 0;
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Skip users without dateOfBirth
      if (!userData.dateOfBirth) {
        continue;
      }

      // Skip deleted users
      if (userData.deletedAt) {
        continue;
      }

      // Skip blocked users
      if (userData.blocked) {
        continue;
      }

      try {
        // Parse dateOfBirth (format: YYYY-MM-DD)
        const dateOfBirth = userData.dateOfBirth;
        const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-');

        if (!birthYear || !birthMonth || !birthDay) {
          console.warn(`[CRON] Invalid dateOfBirth format for user ${userId}:`, dateOfBirth);
          continue;
        }

        const birthMMDD = `${birthMonth}-${birthDay}`;

        // Check if today is their birthday
        if (birthMMDD !== todayMMDD) {
          continue;
        }

        // Calculate age
        const age = now.getFullYear() - parseInt(birthYear, 10);

        console.log('[CRON] Found birthday!', {
          userId,
          playername: userData.playername,
          age,
          dateOfBirth,
        });

        results.birthdaysFound++;

        // Prepare birthday message
        const subject = `🎉 Van harte gefeliciteerd met je verjaardag!`;
        const messageText = `Van harte gefeliciteerd met je ${age}e verjaardag, ${userData.displayName || userData.playername || 'daar'}! 🎂🎈\n\nHet hele Oracle Games team wenst je een fantastische dag toe!\n\nVeel plezier en hopelijk nog vele jaren vol wielerspanning! 🚴‍♂️`;

        // Create in-app message
        if (!dryRun) {
          try {
            const timestamp = admin.firestore.Timestamp.now();
            await db.collection('messages').add({
              type: 'individual',
              senderId: 'system',
              senderName: 'Oracle Games',
              recipientId: userId,
              recipientName: userData.playername,
              subject,
              message: messageText,
              sentAt: timestamp,
              read: false,
              emailNotificationSent: false,
            });

            results.messagesCreated++;
            console.log(`[CRON] Created birthday message for user ${userId}`);
          } catch (messageError) {
            console.error(`[CRON] Failed to create message for user ${userId}:`, messageError);
            results.errors.push(`Message creation failed for ${userId}`);
          }
        } else {
          console.log(`[CRON] DRY-RUN: Would create birthday message for user ${userId}`);
          results.messagesCreated++;
        }

        // Send birthday email
        const email = userData.email;

        if (!email) {
          console.warn(`[CRON] User ${userId} has no email, skipping email`);
          continue;
        }

        // Check if user has email notifications enabled (default to true)
        const emailNotificationsEnabled = userData.emailNotifications !== false;

        if (!emailNotificationsEnabled) {
          console.log(`[CRON] User ${userId} has email notifications disabled, skipping email`);
          continue;
        }

        if (dryRun) {
          console.log(`[CRON] DRY-RUN: Would send birthday email to ${email}`);
          results.emailsSent++;
        } else {
          const apiKey = process.env.RESEND_API_KEY;

          if (!apiKey) {
            console.error('[CRON] RESEND_API_KEY not configured');
            results.errors.push('Resend not configured');
            continue;
          }

          const resend = new Resend(apiKey);

          const displayName = userData.displayName || userData.playername || 'daar';

          const emailBody = `Beste ${displayName},\n\nVan harte gefeliciteerd met je ${age}e verjaardag! 🎂🎈\n\nHet hele Oracle Games team wenst je een fantastische dag toe vol vreugde en geluk.\n\nMoge je nog vele jaren genieten van spannende wielerwedstrijden en gezellige games met ons!\n\nVeel plezier vandaag! 🚴‍♂️\n\nMet de beste wensen,\nHet Oracle Games team`;

          try {
            const result = await resend.emails.send({
              from: 'Oracle Games <no-reply@send.oracle-games.online>',
              to: [email],
              subject: `🎉 Van harte gefeliciteerd met je ${age}e verjaardag!`,
              html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <p>${emailBody.replace(/\n/g, '<br>')}</p>
              </div>`,
            });

            if (result.error) {
              console.error(`[CRON] Resend API error for ${email}:`, result.error);
              results.errors.push(`Resend error for ${email}: ${result.error.message}`);
            } else {
              results.emailsSent++;
              console.log(`[CRON] Birthday email sent successfully to ${email} (ID: ${result.data?.id})`);

              // Add delay to respect Resend rate limit
              emailIndex++;
              await delay(600);
            }
          } catch (emailError) {
            console.error(`[CRON] Failed to send birthday email to ${email}:`, emailError);
            results.errors.push(`Email send failed for ${email}`);
          }
        }
      } catch (error) {
        console.error(`[CRON] Error processing user ${userId}:`, error);
        results.errors.push(`Error processing ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('[CRON] Birthday check complete', results);

    return Response.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    });
  } catch (error) {
    console.error('[CRON] Error in send-birthday-notifications:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
