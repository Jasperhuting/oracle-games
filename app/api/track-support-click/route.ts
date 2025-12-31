import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    const db = getServerFirebase();

    // Get IP address from request headers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Store the click in the database
    const clickData: {
      userId?: string;
      ipAddress?: string;
      clickedAt: Timestamp;
      timestamp: Timestamp;
    } = {
      clickedAt: Timestamp.now(),
      timestamp: Timestamp.now()
    };

    // Add userId if available, otherwise add IP address
    if (userId) {
      clickData.userId = userId;
    } else {
      clickData.ipAddress = ip;
    }

    await db.collection('support_clicks').add(clickData);

    return NextResponse.json({
      success: true,
      message: 'Support click tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking support click:', error);
    return NextResponse.json(
      { error: 'Failed to track support click', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
