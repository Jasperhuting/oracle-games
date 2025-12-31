import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { ActivityLogsResponse, ApiErrorResponse, ApiActivityLog } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<ActivityLogsResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if requesting user is admin
    const requestingUserDoc = await db.collection('users').doc(userId).get();
    if (!requestingUserDoc.exists || requestingUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Fetch activity logs, excluding deployment logs
    const logsSnapshot = await db
      .collection('activityLogs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    // Filter out VERCEL_DEPLOYMENT_* actions since they have their own tab
    const logs = logsSnapshot.docs
      .map((doc) => {
        const data = doc.data();

        // Convert Firestore Timestamp to ISO string
        let timestamp: string;
        if (data.timestamp?.toDate) {
          timestamp = data.timestamp.toDate().toISOString();
        } else if (data.timestamp?._seconds) {
          // Handle serialized Firestore Timestamp
          const milliseconds = data.timestamp._seconds * 1000 + Math.floor((data.timestamp._nanoseconds || 0) / 1000000);
          timestamp = new Date(milliseconds).toISOString();
        } else {
          timestamp = data.timestamp;
        }

        return {
          id: doc.id,
          ...data,
          timestamp
        } as ApiActivityLog;
      })
      .filter((log) => !log.action.startsWith('VERCEL_DEPLOYMENT'));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
