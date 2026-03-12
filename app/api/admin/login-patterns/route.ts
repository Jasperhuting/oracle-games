import { NextRequest, NextResponse } from 'next/server';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getServerFirebase } from '@/lib/firebase/server';

const ANALYSIS_TIME_ZONE = 'Europe/Amsterdam';
const WEEKDAY_ORDER = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const;

type CountBucket = {
  label: string;
  count: number;
};

type LoginPatternsResponse = {
  history: {
    days: number;
    totalLogins: number;
    uniqueUsers: number;
    since: string | null;
    daily: CountBucket[];
    hourly: CountBucket[];
    weekday: CountBucket[];
  };
  snapshot: {
    totalUsersWithLastLogin: number;
    hourly: CountBucket[];
    weekday: CountBucket[];
  };
};

function getAmsterdamDateKey(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: ANALYSIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getAmsterdamHourKey(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ANALYSIS_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function getAmsterdamWeekdayKey(date: Date): string {
  const weekday = new Intl.DateTimeFormat('nl-NL', {
    timeZone: ANALYSIS_TIME_ZONE,
    weekday: 'short',
  }).format(date).toLowerCase();

  return weekday.replace('.', '');
}

function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function createHourlyBuckets(): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => [String(hour).padStart(2, '0'), 0])
  );
}

function createWeekdayBuckets(): Record<string, number> {
  return Object.fromEntries(WEEKDAY_ORDER.map((day) => [day, 0]));
}

function mapBuckets(buckets: Record<string, number>, labels: string[]): CountBucket[] {
  return labels.map((label) => ({
    label,
    count: buckets[label] || 0,
  }));
}

function aggregateDates(dates: Date[]) {
  const hourly = createHourlyBuckets();
  const weekday = createWeekdayBuckets();

  for (const date of dates) {
    hourly[getAmsterdamHourKey(date)] += 1;
    const weekdayKey = getAmsterdamWeekdayKey(date);
    if (weekdayKey in weekday) {
      weekday[weekdayKey] += 1;
    }
  }

  return {
    hourly: mapBuckets(hourly, Object.keys(hourly)),
    weekday: mapBuckets(weekday, [...WEEKDAY_ORDER]),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const days = Math.min(parseInt(searchParams.get('days') || '90', 10) || 90, 365);

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const db = getServerFirebase();
    const requestingUserDoc = await db.collection('users').doc(userId).get();
    if (!requestingUserDoc.exists || requestingUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const loginLogsSnapshot = await db
      .collection('activityLogs')
      .where('action', '==', 'USER_LOGIN')
      .get();

    const loginDocs = loginLogsSnapshot.docs.filter((doc: QueryDocumentSnapshot<DocumentData>) => {
      const date = timestampToDate(doc.data().timestamp);
      return date !== null && date >= startDate;
    });

    const loginDates: Date[] = [];
    const uniqueUsers = new Set<string>();
    const dailyBuckets: Record<string, number> = {};

    for (const doc of loginDocs) {
      const data = doc.data();
      const loginDate = timestampToDate(data.timestamp);
      if (!loginDate) continue;

      loginDates.push(loginDate);
      if (typeof data.userId === 'string') {
        uniqueUsers.add(data.userId);
      }

      const dateKey = getAmsterdamDateKey(loginDate);
      dailyBuckets[dateKey] = (dailyBuckets[dateKey] || 0) + 1;
    }

    const historyAggregates = aggregateDates(loginDates);
    const daily = Object.entries(dailyBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([label, count]) => ({ label, count }));

    const usersSnapshot = await db.collection('users').get();
    const lastLoginDates = usersSnapshot.docs
      .map((doc) => timestampToDate(doc.data().lastLoginAt))
      .filter((date): date is Date => date !== null);
    const snapshotAggregates = aggregateDates(lastLoginDates);

    const response: LoginPatternsResponse = {
      history: {
        days,
        totalLogins: loginDates.length,
        uniqueUsers: uniqueUsers.size,
        since: loginDates.length > 0 ? loginDates.reduce((min, current) => current < min ? current : min, loginDates[0]).toISOString() : null,
        daily,
        hourly: historyAggregates.hourly,
        weekday: historyAggregates.weekday,
      },
      snapshot: {
        totalUsersWithLastLogin: lastLoginDates.length,
        hourly: snapshotAggregates.hourly,
        weekday: snapshotAggregates.weekday,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching login patterns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch login patterns', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
