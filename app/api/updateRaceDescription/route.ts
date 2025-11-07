import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, raceId, description } = await request.json();

    if (!userId || !raceId) {
      return NextResponse.json(
        { error: 'User ID and race ID are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Update the race description
    await db.collection('races').doc(raceId).update({
      description: description || '',
      updatedAt: new Date().toISOString(),
    });

    // Log the activity
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'RACE_DESCRIPTION_UPDATED',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        raceId,
        newDescription: description || '',
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ 
      success: true,
      message: 'Beschrijving succesvol bijgewerkt'
    });
  } catch (error) {
    console.error('Error updating race description:', error);
    return NextResponse.json(
      { error: 'Failed to update race description', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
