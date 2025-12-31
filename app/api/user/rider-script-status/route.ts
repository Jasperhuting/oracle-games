import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

const DAILY_RIDER_LIMIT = 5;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is verplicht' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Gebruiker niet gevonden' },
        { status: 404 }
      );
    }

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Count successful rider additions today
    const logsSnapshot = await db.collection('activityLogs')
      .where('userId', '==', userId)
      .where('action', '==', 'USER_RIDER_SCRIPT_SUCCESS')
      .where('timestamp', '>=', todayISO)
      .get();

    const usedToday = logsSnapshot.size;
    const remaining = Math.max(0, DAILY_RIDER_LIMIT - usedToday);

    // Get recent activity (last 10 successful additions)
    const recentLogsSnapshot = await db.collection('activityLogs')
      .where('userId', '==', userId)
      .where('action', '==', 'USER_RIDER_SCRIPT_SUCCESS')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const recentActivity = recentLogsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        timestamp: data.timestamp,
        riderName: data.details?.riderName,
        year: data.details?.year,
      };
    });

    return NextResponse.json({
      dailyLimit: DAILY_RIDER_LIMIT,
      usedToday,
      remaining,
      recentActivity,
    });

  } catch (error) {
    console.error('Error getting rider script status:', error);
    return NextResponse.json(
      { error: 'Er is een fout opgetreden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
