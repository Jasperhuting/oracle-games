import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

// This endpoint initializes the existing races in the database
export async function POST(request: NextRequest) {
  try {
    const { adminUserId } = await request.json();

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
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

    const existingRaces = [
      {
        slug: 'giro-d-italia_2025',
        name: 'Giro d\'Italia',
        year: 2025,
        description: 'De Giro d\'Italia 2025',
      },
      {
        slug: 'tour-de-france_2025',
        name: 'Tour de France',
        year: 2025,
        description: 'De Tour de France 2025',
      },
      {
        slug: 'vuelta-a-espana_2025',
        name: 'Vuelta a España',
        year: 2025,
        description: 'De Vuelta a España 2025',
      },
    ];

    const batch = db.batch();
    const timestamp = new Date().toISOString();

    for (const race of existingRaces) {
      const raceRef = db.collection('races').doc(race.slug);
      const existingRace = await raceRef.get();
      
      // Only create if doesn't exist
      if (!existingRace.exists) {
        batch.set(raceRef, {
          ...race,
          createdAt: timestamp,
          createdBy: adminUserId,
          updatedAt: timestamp,
          active: true,
        });
      }
    }

    await batch.commit();

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'RACES_INITIALIZED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        racesCount: existingRaces.length,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ 
      success: true,
      message: 'Races initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing races:', error);
    return NextResponse.json(
      { error: 'Failed to initialize races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
