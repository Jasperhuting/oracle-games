import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint to send a sample birthday notification
 * Usage: POST /api/cron/send-birthday-notifications/test
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

    console.log('[TEST] Sending test birthday notification to jasper.huting@gmail.com');

    const testEmail = 'jasper.huting@gmail.com';

    // Find the actual user
    let actualUserId = 'test-user-id';
    let actualDisplayName = 'Jasper';
    let actualPlayername = 'Jasper';
    let actualAge = 30; // Default test age

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

        // Calculate actual age if dateOfBirth exists
        if (userData.dateOfBirth) {
          const [birthYear] = userData.dateOfBirth.split('-');
          if (birthYear) {
            const now = new Date();
            actualAge = now.getFullYear() - parseInt(birthYear, 10);
          }
        }

        console.log('[TEST] Found user in database:', {
          userId: actualUserId,
          displayName: actualDisplayName,
          playername: actualPlayername,
          age: actualAge,
        });
      } else {
        console.log('[TEST] User not found in database, using test data');
      }
    } catch (error) {
      console.error('[TEST] Error finding user:', error);
    }

    // Prepare birthday message
    const subject = `🎉 Van harte gefeliciteerd met je verjaardag!`;
    const messageText = `Van harte gefeliciteerd met je ${actualAge}e verjaardag, ${actualDisplayName}! 🎂🎈\n\nHet hele Oracle Games team wenst je een fantastische dag toe!\n\nVeel plezier en hopelijk nog vele jaren vol wielerspanning! 🚴‍♂️`;

    // Create in-app message
    try {
      const now = admin.firestore.Timestamp.now();
      const messageRef = await db.collection('messages').add({
        type: 'individual',
        senderId: 'system',
        senderName: 'Oracle Games',
        recipientId: actualUserId,
        recipientName: actualPlayername,
        subject,
        message: messageText,
        sentAt: now,
        read: false,
        emailNotificationSent: false,
      });

      console.log('[TEST] Created birthday message:', messageRef.id);
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

    // Send birthday email
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

    const emailBody = `Beste ${actualDisplayName},\n\nVan harte gefeliciteerd met je ${actualAge}e verjaardag! 🎂🎈\n\nHet hele Oracle Games team wenst je een fantastische dag toe vol vreugde en geluk.\n\nMoge je nog vele jaren genieten van spannende wielerwedstrijden en gezellige games met ons!\n\nVeel plezier vandaag! 🚴‍♂️\n\nMet de beste wensen,\nHet Oracle Games team`;

    try {
      const result = await resend.emails.send({
        from: 'Oracle Games <no-reply@send.oracle-games.online>',
        to: [testEmail],
        subject: `🎉 Van harte gefeliciteerd met je ${actualAge}e verjaardag!`,
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

      console.log('[TEST] Birthday email sent successfully (ID:', result.data?.id, ')');

      return Response.json({
        success: true,
        message: 'Test birthday notification sent successfully',
        email: testEmail,
        userId: actualUserId,
        age: actualAge,
        emailId: result.data?.id,
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
        timestamp: Timestamp.now(),
      },
      { status: 500 }
    );
  }
}
