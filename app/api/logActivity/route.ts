import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { sendErrorNotification } from '@/lib/telegram';

export interface ActivityLog {
  action: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  targetUserName?: string;
  details?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action, 
      userId, 
      userEmail, 
      userName,
      targetUserId, 
      targetUserEmail,
      targetUserName,
      details 
    } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Action and userId are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get IP address and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create activity log entry
    const activityLog: ActivityLog = {
      action,
      userId,
      userEmail,
      userName,
      targetUserId,
      targetUserEmail,
      targetUserName,
      details,
      timestamp: Timestamp.now(),
      ipAddress,
      userAgent,
    };

    // Save to Firestore
    await db.collection('activityLogs').add(activityLog);

    // Send Telegram notification for errors
    if (action === 'ERROR') {
      try {
        await sendErrorNotification(
          userEmail || 'Onbekend',
          userName || 'Onbekend',
          details?.operation || 'Onbekende operatie',
          details?.errorMessage || 'Geen error bericht beschikbaar',
          {
            gameId: details?.gameId,
            endpoint: details?.endpoint,
            errorDetails: details?.errorDetails,
          }
        );
        console.log(`[ERROR] Telegram notification sent for error from ${userEmail}`);
      } catch (telegramError) {
        // Don't fail the activity log if Telegram fails
        console.error('[ERROR] Failed to send Telegram notification:', telegramError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Activity logged successfully'
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    return NextResponse.json(
      { error: 'Failed to log activity', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
