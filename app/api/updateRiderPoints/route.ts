import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

// POST - Update rider points in database
export async function POST(request: NextRequest) {
  try {
    const { riderId, correctPoints, participantId } = await request.json();

    if (!riderId || typeof correctPoints !== 'number') {
      return NextResponse.json(
        { error: 'Rider ID and correct points are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Update the rider's pointsScored in playerTeams collection
    const riderDoc = await db.collection('playerTeams').doc(riderId).get();
    
    if (!riderDoc.exists) {
      return NextResponse.json(
        { error: 'Rider not found' },
        { status: 404 }
      );
    }

    await riderDoc.ref.update({
      pointsScored: correctPoints,
      points: correctPoints, // Also update the points field for consistency
    });

    // If participantId is provided, update the participant's total points
    if (participantId) {
      // Get all riders for this participant to recalculate total
      const allRidersSnapshot = await db.collection('playerTeams')
        .where('participantId', '==', participantId)
        .where('active', '==', true)
        .get();

      const newTotalPoints = allRidersSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.pointsScored || 0);
      }, 0);

      // Update participant total points
      await db.collection('gameParticipants').doc(participantId).update({
        totalPoints: newTotalPoints
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Rider points updated successfully',
      riderId,
      oldPoints: riderDoc.data()?.pointsScored,
      newPoints: correctPoints,
    });
  } catch (error) {
    console.error('Error updating rider points:', error);
    return NextResponse.json(
      { error: 'Failed to update rider points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
