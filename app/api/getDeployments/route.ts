import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { ApiErrorResponse, ApiActivityLog } from '@/lib/types';

interface DeploymentsResponse {
  deployments: ApiActivityLog[];
}

export async function GET(request: NextRequest): Promise<NextResponse<DeploymentsResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '1000');

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

    // Fetch deployment logs (all VERCEL_DEPLOYMENT_* actions)
    const logsSnapshot = await db
      .collection('activityLogs')
      .where('action', '>=', 'VERCEL_DEPLOYMENT')
      .where('action', '<', 'VERCEL_DEPLOYMENU')
      .orderBy('action')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const deployments = logsSnapshot.docs.map((doc) => {
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
    });

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error('Error fetching deployments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
