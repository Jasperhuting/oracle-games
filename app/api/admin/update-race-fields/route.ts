import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { raceId, adminUserId } = await request.json();

    if (!raceId || !adminUserId) {
      return NextResponse.json(
        { error: 'Race ID and admin user ID are required' },
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

    // Get the race document
    const raceRef = db.collection('races').doc(raceId);
    const raceDoc = await raceRef.get();

    if (!raceDoc.exists) {
      return NextResponse.json(
        { error: `Race ${raceId} not found` },
        { status: 404 }
      );
    }

    const raceData = raceDoc.data();

    // Add missing fields if they don't exist
    const updates: Record<string, unknown> = {};

    if (!raceData?.createdAt) {
      updates.createdAt = raceData?.scrapedAt || new Date().toISOString();
    }

    if (raceData?.active === undefined) {
      updates.active = true;
    }

    if (!raceData?.description) {
      updates.description = '';
    }

    if (!raceData?.createdBy) {
      updates.createdBy = adminUserId;
    }

    if (Object.keys(updates).length > 0) {
      await raceRef.update(updates);
      return NextResponse.json({
        success: true,
        message: `Race ${raceId} updated`,
        updates
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No updates needed - all fields already exist'
    });

  } catch (error) {
    console.error('Error updating race:', error);
    return NextResponse.json(
      { error: 'Failed to update race', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
