import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Feedback } from '@/lib/types/games';
import { Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { sendFeedbackNotification } from '@/lib/telegram';

// Server-side feedback document type with Firebase Admin Timestamp
interface FeedbackDocument {
  userId: string;
  userEmail: string;
  currentPage: string;
  message: string;
  createdAt: Timestamp;
  status?: 'new' | 'reviewed' | 'resolved';
  adminResponse?: string;
  adminResponseDate?: Timestamp;
}

// GET /api/feedback - Get all feedback (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const feedbackSnapshot = await db.collection('feedback')
      .orderBy('createdAt', 'desc')
      .get();

    const feedback: Feedback[] = [];
    feedbackSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      const adminResponseDate = data.adminResponseDate?.toDate?.();

      feedback.push({
        id: doc.id,
        userId: data.userId,
        userEmail: data.userEmail,
        currentPage: data.currentPage,
        message: data.message,
        createdAt: createdAt.toISOString(),
        status: data.status || 'new',
        adminResponse: data.adminResponse,
        adminResponseDate: adminResponseDate?.toISOString(),
      });
    });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/feedback - Submit new feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, message, currentPage } = body;

    if (!userId || !message) {
      return NextResponse.json(
        { error: 'User ID and message are required' },
        { status: 400 }
      );
    }

    if (message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get user email
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const userEmail = userData?.email || 'unknown';
    const displayName = userData?.displayName || userData?.playername || userEmail;

    const feedbackData: Omit<FeedbackDocument, 'id'> = {
      userId,
      userEmail,
      currentPage,
      message: message.trim(),
      createdAt: Timestamp.now(),
      status: 'new',
    };

    const feedbackRef = await db.collection('feedback').add(feedbackData);

    // Send email notification to admin
    try {
      const apiKey = process.env.RESEND_API_KEY;

      if (apiKey) {
        const resend = new Resend(apiKey);

        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://oracle-games.online';

        const emailBody = `Er is nieuwe feedback ontvangen op Oracle Games.\n\n` +
          `Van: ${displayName} (${userEmail})\n` +
          `Pagina: ${currentPage || 'Niet opgegeven'}\n` +
          `Tijdstip: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}\n\n` +
          `Bericht:\n${message.trim()}\n\n` +
          `Bekijk alle feedback in het admin panel:\n${baseUrl}/admin`;

        await resend.emails.send({
          from: 'Oracle Games <no-reply@send.oracle-games.online>',
          to: ['jasper.huting@gmail.com'],
          subject: `Nieuwe feedback van ${displayName}`,
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>${emailBody.replace(/\n/g, '<br>')}</p>
          </div>`,
        });

        console.log(`[FEEDBACK] Email notification sent to admin for feedback from ${userEmail}`);
      } else {
        console.warn('[FEEDBACK] RESEND_API_KEY not configured, skipping email notification');
      }
    } catch (emailError) {
      // Don't fail the feedback submission if email fails
      console.error('[FEEDBACK] Failed to send email notification:', emailError);
    }

    // Send Telegram notification
    try {
      await sendFeedbackNotification(
        userEmail,
        displayName,
        currentPage || 'Niet opgegeven',
        message.trim()
      );
      console.log(`[FEEDBACK] Telegram notification sent for feedback from ${userEmail}`);
    } catch (telegramError) {
      // Don't fail the feedback submission if Telegram fails
      console.error('[FEEDBACK] Failed to send Telegram notification:', telegramError);
    }

    return NextResponse.json({
      success: true,
      id: feedbackRef.id,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/feedback - Update feedback status or add admin response (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, feedbackId, status, currentPage, adminResponse } = body;

    if (!userId || !feedbackId) {
      return NextResponse.json(
        { error: 'User ID and feedback ID are required' },
        { status: 400 }
      );
    }

    if (status && !['new', 'reviewed', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const updateData: {
      status?: 'new' | 'reviewed' | 'resolved';
      currentPage?: string;
      adminResponse?: string;
      adminResponseDate?: Timestamp;
    } = {};

    if (status) {
      updateData.status = status;
    }

    if (typeof currentPage !== 'undefined') {
      updateData.currentPage = currentPage;
    }

    if (typeof adminResponse !== 'undefined') {
      updateData.adminResponse = adminResponse;
      updateData.adminResponseDate = Timestamp.now();

      // Get the feedback document to find the user who submitted it
      const feedbackDoc = await db.collection('feedback').doc(feedbackId).get();
      if (feedbackDoc.exists) {
        const feedbackData = feedbackDoc.data();
        const feedbackUserId = feedbackData?.userId;
        const feedbackUserEmail = feedbackData?.userEmail;

        // Get admin user info
        const adminUserDoc = await db.collection('users').doc(userId).get();
        const adminName = adminUserDoc.exists
          ? (adminUserDoc.data()?.displayName || adminUserDoc.data()?.email || 'Admin')
          : 'Admin';

        // Send a personal message to the user who submitted the feedback
        if (feedbackUserId && adminResponse.trim()) {
          const messageRef = db.collection('messages').doc();
          await messageRef.set({
            type: 'individual',
            senderId: userId,
            senderName: adminName,
            recipientId: feedbackUserId,
            recipientName: feedbackUserEmail || 'User',
            subject: 'Response to your feedback',
            message: `Thank you for your feedback!\n\nYour original message:\n"${feedbackData?.message || ''}"\n\nOur response:\n${adminResponse}`,
            sentAt: Timestamp.now(),
            read: false,
          });
        }
      }
    }

    await db.collection('feedback').doc(feedbackId).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Feedback updated successfully'
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to update feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedbackId } = body;

    if (!feedbackId) {
      return NextResponse.json(
        { error: 'Feedback ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin

    await db.collection('feedback').doc(feedbackId).delete();

    return NextResponse.json({
      success: true,
      message: 'Feedback deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to delete feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}