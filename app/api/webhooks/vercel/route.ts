import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    // Verify the webhook secret (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.VERCEL_WEBHOOK_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await request.json();
    const { type, payload: eventPayload } = payload;
    
    // Only process deployment events
    if (!type.startsWith('deployment.')) {
      return NextResponse.json({ received: true });
    }

    const db = getServerFirebase();
    const timestamp = new Date().toISOString();
    
    // Map Vercel event types to our activity log actions
    let action = 'VERCEL_' + type.toUpperCase().replace(/\./g, '_');
    
    // Create activity log entry
    await db.collection('activityLogs').add({
      action,
      userId: 'system', // or use a specific system user ID
      userEmail: 'deploy@oraclegames.com', // or your deployment email
      userName: 'Vercel Deploy Bot',
      timestamp,
      details: {
        ...eventPayload,
        // Add any additional details you want to track
        environment: process.env.VERCEL_ENV || 'development',
        branch: process.env.VERCEL_GIT_COMMIT_REF,
        commit: process.env.VERCEL_GIT_COMMIT_SHA,
        commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: 'Vercel-Webhook',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Vercel webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Ensure this route is server-side rendered
