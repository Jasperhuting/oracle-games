import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
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

    // Fetch activity logs
    const logsSnapshot = await db
      .collection('activityLogs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const logs: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    logsSnapshot.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
