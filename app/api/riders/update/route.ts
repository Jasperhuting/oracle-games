import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import process from "process";

const DEFAULT_YEAR = process.env.NEXT_PUBLIC_PLAYING_YEAR;

// PATCH - Update a rider
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminUserId, riderId, country, teamId, jerseyImage, retired, year } = body;
    const YEAR = year || DEFAULT_YEAR;

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      );
    }

    if (!riderId) {
      return NextResponse.json(
        { error: 'Rider ID is required' },
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

    // Check if rider exists

    const riderDoc = await db.collection(`rankings_${YEAR}`).doc(riderId).get();

    if (!riderDoc.exists) {
      return NextResponse.json(
        { error: `Rider not found in database. Rider ID: ${riderId}. Please ensure the rider exists in Firestore before editing.` },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (country !== undefined) updateData.country = country;
    if (jerseyImage !== undefined) updateData.jerseyImage = jerseyImage;
    if (retired !== undefined) updateData.retired = retired;

    // Handle team reference
    if (teamId) {
      const teamRef = db.collection('teams').doc(teamId);
      updateData.teamRef = teamRef;
    } else if (teamId === null) {
      updateData.teamRef = null;
    }

    // Update existing rider
    await db.collection(`rankings_${YEAR}`).doc(riderId).update(updateData);

    // Get updated rider
    const updatedRider = await db.collection(`rankings_${YEAR}`).doc(riderId).get();
    const riderData = updatedRider.data();

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'RIDER_UPDATED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        riderId,
        riderName: riderData?.name,
        updatedFields: Object.keys(updateData).filter(k => k !== 'updatedAt'),
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      rider: {
        id: riderId,
        ...riderData,
        teamRef: riderData?.teamRef?.path || riderData?.teamRef,
      },
    });
  } catch (error) {
    console.error('Error updating rider:', error);
    return NextResponse.json(
      { error: 'Failed to update rider', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
