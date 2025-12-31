import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

// GET race lineup
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raceSlug: string }> }
) {
  try {
    const { raceSlug } = await params;
    const db = getServerFirebase();

    const lineupDoc = await db.collection('raceLineups').doc(raceSlug).get();

    if (!lineupDoc.exists) {
      return NextResponse.json(
        { error: 'Race lineup not found' },
        { status: 404 }
      );
    }

    const data = lineupDoc.data();

    return NextResponse.json({
      success: true,
      lineup: {
        id: lineupDoc.id,
        ...data,
        updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt,
        raceRef: data?.raceRef?.path || data?.raceRef,
      },
    });
  } catch (error) {
    console.error('Error fetching race lineup:', error);
    return NextResponse.json(
      { error: 'Failed to fetch race lineup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// CREATE or UPDATE race lineup (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ raceSlug: string }> }
) {
  try {
    const { raceSlug } = await params;
    const { adminUserId, year, teams } = await request.json();

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      );
    }

    if (!teams || !Array.isArray(teams)) {
      return NextResponse.json(
        { error: 'Teams array is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get race reference
    const raceRef = db.collection('races').doc(raceSlug);
    const raceDoc = await raceRef.get();

    if (!raceDoc.exists) {
      return NextResponse.json(
        { error: 'Race not found' },
        { status: 404 }
      );
    }

    const raceData = raceDoc.data();

    // Create or update lineup
    const lineup = {
      raceRef: raceRef,
      year: year || raceData?.year || new Date().getFullYear(),
      updatedAt: new Date(),
      updatedBy: adminUserId,
      teams,
    };

    await db.collection('raceLineups').doc(raceSlug).set(lineup, { merge: true });

    // Extract all rider nameIds and team slugs
    interface TeamWithRiders {
      teamSlug: string;
      riders?: Array<{ nameId: string; [key: string]: unknown }>;
      [key: string]: unknown;
    }
    const eligibleTeams = (teams as TeamWithRiders[]).map((t) => t.teamSlug);
    const eligibleRiders = (teams as TeamWithRiders[]).flatMap((t) =>
      t.riders?.map((r) => r.nameId) || []
    );

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'RACE_LINEUP_UPDATED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        raceSlug,
        raceName: raceData?.name,
        teamsCount: teams.length,
        ridersCount: eligibleRiders.length,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      lineup: {
        id: raceSlug,
        ...lineup,
        updatedAt: lineup.updatedAt.toISOString(),
        raceRef: raceRef.path,
      },
      eligibleTeams,
      eligibleRiders,
    });
  } catch (error) {
    console.error('Error updating race lineup:', error);
    return NextResponse.json(
      { error: 'Failed to update race lineup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
