import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Resend } from 'resend';
import admin from 'firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Cron job to send email notifications for unread messages
 * Runs every 5 minutes (same as Motia send-messages)
 *
 * This replaces: send-messages.step.ts
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

    // Dry-run mode: test without actually sending emails
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
    if (dryRun) {
      console.log('[CRON] Running in DRY-RUN mode (no emails will be sent)');
    }

    console.log('[CRON] Starting message notification job');

    const now = admin.firestore.Timestamp.now();
    const results = {
      messagesFound: 0,
      recipientsProcessed: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    // Get all unread messages where email notification hasn't been sent
    // Note: We can't use multiple inequality filters, so we filter in memory
    const messagesSnapshot = await db
      .collection('messages')
      .where('read', '==', false)
      .get();

    // Filter out messages that already have emailNotificationSent = true
    const unsentMessages = messagesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.emailNotificationSent !== true;
    });

    if (unsentMessages.length === 0) {
      console.log('[CRON] No unread messages found that need email notifications');
      return Response.json({
        success: true,
        timestamp: new Date().toISOString(),
        ...results,
      });
    }

    results.messagesFound = unsentMessages.length;
    console.log(`[CRON] Found ${unsentMessages.length} unread messages to process`);

    // Group messages by recipient
    const messagesByRecipient = new Map<string, any[]>();

    for (const doc of unsentMessages) {
      const message = doc.data();
      const recipientId = message.recipientId;

      if (!recipientId) {
        console.warn(`[CRON] Message ${doc.id} has no recipientId, skipping`);
        continue;
      }

      if (!messagesByRecipient.has(recipientId)) {
        messagesByRecipient.set(recipientId, []);
      }

      messagesByRecipient.get(recipientId)!.push({
        ...message,
        id: doc.id,
      });
    }

    results.recipientsProcessed = messagesByRecipient.size;
    console.log(`[CRON] Processing messages for ${messagesByRecipient.size} recipients`);

    // Helper function to add delay between emails (Resend rate limit: 2 requests/second)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Send email per recipient
    let emailIndex = 0;
    for (const [recipientId, messages] of messagesByRecipient.entries()) {
      try {
        // Get user data
        const userDoc = await db.collection('users').doc(recipientId).get();

        if (!userDoc.exists) {
          console.warn(`[CRON] User ${recipientId} not found, skipping`);
          continue;
        }

        const userData = userDoc.data();
        const email = userData?.email;

        if (!email) {
          console.warn(`[CRON] User ${recipientId} has no email, skipping`);
          continue;
        }

        // Check if user has email notifications enabled (default to true)
        const emailNotificationsEnabled = userData?.emailNotifications !== false;

        if (!emailNotificationsEnabled) {
          console.log(`[CRON] User ${recipientId} has email notifications disabled, skipping`);
          results.errors.push(`User ${recipientId} has notifications disabled`);

          // Still mark messages as processed to avoid checking them again
          const batch = db.batch();
          for (const message of messages) {
            const messageRef = db.collection('messages').doc(message.id);
            batch.update(messageRef, {
              emailNotificationSent: false, // Mark as false to indicate user preference
              emailNotificationSentAt: now,
            });
          }
          await batch.commit();
          continue;
        }

        // Prepare email
        const messageCount = messages.length;
        const firstMessage = messages[0];

        console.log(`[CRON] Preparing to send email to ${email} (${messageCount} message(s))`);
        console.log(`[CRON] Email notifications enabled: ${emailNotificationsEnabled}`);
        const subject =
          messageCount === 1
            ? `Nieuw bericht: ${firstMessage?.subject || 'Geen onderwerp'}`
            : `Je hebt ${messageCount} nieuwe berichten`;

        const displayName = userData?.displayName || userData?.playername || 'daar';
        let messageBody = `Hallo ${displayName},\n\n`;

        if (messageCount === 1 && firstMessage) {
          messageBody += `Je hebt een nieuw bericht ontvangen van ${firstMessage.senderName || 'onbekend'}.\n\n`;
          messageBody += `Onderwerp: ${firstMessage.subject || 'Geen onderwerp'}\n\n`;
          messageBody += `Bericht:\n${firstMessage.message || ''}\n\n`;
        } else {
          messageBody += `Je hebt ${messageCount} nieuwe berichten ontvangen:\n\n`;
          messages.forEach((msg: any, index: number) => {
            messageBody += `${index + 1}. Van ${msg.senderName || 'onbekend'}: ${msg.subject || 'Geen onderwerp'}\n`;
          });
          messageBody += `\n`;
        }

        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://oracle-games.online';

        messageBody += `Log in op Oracle Games om je berichten te lezen:\n`;
        messageBody += `${baseUrl}/inbox\n\n`;
        messageBody += `Met vriendelijke groet,\nHet Oracle Games team`;

        // Send email via Resend
        try {
          if (dryRun) {
            console.log(`[CRON] DRY-RUN: Would send email to ${email} with subject "${subject}"`);
            results.emailsSent++;
          } else {
            const apiKey = process.env.RESEND_API_KEY;

            if (!apiKey) {
              console.error('[CRON] RESEND_API_KEY not configured');
              results.errors.push('Resend not configured');
              continue;
            }

            const resend = new Resend(apiKey);

            const result = await resend.emails.send({
              from: 'Oracle Games <no-reply@send.oracle-games.online>',
              to: [email],
              subject: subject,
              html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <p>${messageBody.replace(/\n/g, '<br>')}</p>
              </div>`,
            });

            // Check if the email was actually sent successfully
            if (result.error) {
              console.error(`[CRON] Resend API error for ${email}:`, result.error);
              results.errors.push(`Resend error for ${email}: ${result.error.message}`);
              continue;
            }

            results.emailsSent++;
            console.log(`[CRON] Email sent successfully to ${email} (ID: ${result.data?.id}) for ${messageCount} message(s)`);

            // Add delay to respect Resend rate limit (2 requests/second = 500ms between requests)
            emailIndex++;
            if (emailIndex < messagesByRecipient.size) {
              console.log(`[CRON] Waiting 600ms before next email (rate limiting)...`);
              await delay(600);
            }
          }
        } catch (emailError) {
          console.error(`[CRON] Failed to send email to ${email}:`, emailError);
          results.errors.push(`Email send failed for ${email}`);
          continue;
        }

        // Mark all messages as email sent (skip in dry-run mode)
        if (!dryRun) {
          const batch = db.batch();
          for (const message of messages) {
            const messageRef = db.collection('messages').doc(message.id);
            batch.update(messageRef, {
              emailNotificationSent: true,
              emailNotificationSentAt: now,
            });
          }

          await batch.commit();
          console.log(`[CRON] Marked ${messageCount} message(s) as email sent for user ${recipientId}`);
        } else {
          console.log(`[CRON] DRY-RUN: Would mark ${messageCount} message(s) as sent for user ${recipientId}`);
        }
      } catch (error) {
        console.error(`[CRON] Error processing messages for user ${recipientId}:`, error);
        results.errors.push(`Error for user ${recipientId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('[CRON] Message notification job completed', results);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error('[CRON] Error in send-message-notifications:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
