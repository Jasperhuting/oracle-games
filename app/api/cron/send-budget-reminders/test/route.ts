import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Resend } from 'resend';
import admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint to send a sample budget reminder notification
 * Usage: POST /api/cron/send-budget-reminders/test
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Vercel Cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('[TEST] Unauthorized access attempt');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TEST] Sending test budget reminder to jasper.huting@gmail.com');

    const testEmail = 'jasper.huting@gmail.com';

    // Sample data
    const gameName = 'Tour de France 2025';
    const gameId = 'test-game-123';
    const periodName = 'Stage 1-5';
    const hoursUntilClose = 6;
    const riderCount = 1;
    const totalBudget = 100000;
    const availableBudget = 85000;
    const committedBudget = 5000;
    const activeBidsCount = 2;
    const budgetPercentageRemaining = Math.round((availableBudget / totalBudget) * 100);

    // Find the actual user
    let actualUserId = 'test-user-id';
    let actualDisplayName = 'Jasper';
    let actualPlayername = 'Jasper';

    try {
      const usersSnapshot = await db
        .collection('users')
        .where('email', '==', testEmail)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        actualUserId = userDoc.id;
        const userData = userDoc.data();
        actualDisplayName = userData?.displayName || userData?.playername || 'Jasper';
        actualPlayername = userData?.playername || 'Jasper';

        console.log('[TEST] Found user in database:', {
          userId: actualUserId,
          displayName: actualDisplayName,
          playername: actualPlayername,
        });
      } else {
        console.log('[TEST] User not found in database, using test data');
      }
    } catch (error) {
      console.error('[TEST] Error finding user:', error);
    }

    // Create in-app message
    const subject = `💰 Je hebt nog veel budget over!`;

    let messageText = `De veiling "${periodName}" in game "${gameName}" sluit over ongeveer ${hoursUntilClose} uur.\n\n`;
    messageText += `Je hebt momenteel ${riderCount} ${riderCount === 1 ? 'renner' : 'renners'} in je team en nog €${availableBudget.toLocaleString('nl-NL')} (${budgetPercentageRemaining}%) van je budget beschikbaar.\n\n`;

    if (activeBidsCount > 0) {
      messageText += `Je hebt ${activeBidsCount} actieve ${activeBidsCount === 1 ? 'bieding' : 'biedingen'} staan voor €${committedBudget.toLocaleString('nl-NL')}.\n\n`;
    } else {
      messageText += `Je hebt momenteel geen actieve biedingen staan.\n\n`;
    }

    messageText += `Vergeet niet om je resterende budget te gebruiken voordat de veiling sluit!`;

    // Create in-app message
    try {
      const now = admin.firestore.Timestamp.now();
      const messageRef = await db.collection('messages').add({
        type: 'individual',
        senderId: 'system',
        senderName: 'Oracle Games',
        recipientId: actualUserId,
        recipientName: actualPlayername,
        gameId: gameId,
        gameName: gameName,
        subject,
        message: messageText,
        sentAt: now,
        read: false,
        emailNotificationSent: false,
      });

      console.log('[TEST] Created budget reminder message:', messageRef.id);
    } catch (messageError) {
      console.error('[TEST] Failed to create message:', messageError);
      return Response.json(
        {
          error: 'Failed to create in-app message',
          details: messageError instanceof Error ? messageError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Send email
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error('[TEST] RESEND_API_KEY not configured');
      return Response.json(
        {
          error: 'Resend not configured',
        },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://oracle-games.online';

    let emailBody = `Hallo ${actualDisplayName},\n\nDe veiling "${periodName}" in game "${gameName}" sluit over ongeveer ${hoursUntilClose} uur!\n\n`;
    emailBody += `Je hebt momenteel ${riderCount} ${riderCount === 1 ? 'renner' : 'renners'} in je team en nog €${availableBudget.toLocaleString('nl-NL')} (${budgetPercentageRemaining}%) van je budget beschikbaar.\n\n`;

    if (activeBidsCount > 0) {
      emailBody += `Je hebt ${activeBidsCount} actieve ${activeBidsCount === 1 ? 'bieding' : 'biedingen'} staan voor €${committedBudget.toLocaleString('nl-NL')}.\n\n`;
    } else {
      emailBody += `Je hebt momenteel geen actieve biedingen staan.\n\n`;
    }

    emailBody += `Vergeet niet om je resterende budget te gebruiken voordat de veiling sluit!\n\n`;
    emailBody += `Log nu in om te bieden:\n${baseUrl}/games/${gameId}\n\nMet vriendelijke groet,\nHet Oracle Games team`;

    try {
      const result = await resend.emails.send({
        from: 'Oracle Games <no-reply@send.oracle-games.online>',
        to: [testEmail],
        subject: `💰 Je hebt nog veel budget over in "${gameName}"`,
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <p>${emailBody.replace(/\n/g, '<br>')}</p>
        </div>`,
      });

      if (result.error) {
        console.error('[TEST] Resend API error:', result.error);
        return Response.json(
          {
            error: 'Failed to send email',
            details: result.error.message,
          },
          { status: 500 }
        );
      }

      console.log('[TEST] Budget reminder email sent successfully (ID:', result.data?.id, ')');

      return Response.json({
        success: true,
        message: 'Test budget reminder sent successfully',
        email: testEmail,
        userId: actualUserId,
        emailId: result.data?.id,
        testData: {
          riderCount,
          totalBudget,
          availableBudget,
          budgetPercentageRemaining,
          activeBidsCount,
        },
        preview: {
          subject,
          body: messageText,
          emailBody,
        },
      });
    } catch (emailError) {
      console.error('[TEST] Failed to send email:', emailError);
      return Response.json(
        {
          error: 'Failed to send email',
          details: emailError instanceof Error ? emailError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[TEST] Error in test endpoint:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
