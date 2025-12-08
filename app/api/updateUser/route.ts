import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, playername, firstName, lastName, dateOfBirth } = await request.json();

    if (!userId || !playername) {
      return NextResponse.json(
        { error: 'User ID and playername are required' },
        { status: 400 }
      );
    }

    // Validate playername
    if (playername.length < 2 || playername.length > 50) {
      return NextResponse.json(
        { error: 'Playername must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    // Validate optional fields
    if (firstName && firstName.length > 50) {
      return NextResponse.json(
        { error: 'First name must be less than 50 characters' },
        { status: 400 }
      );
    }

    if (lastName && lastName.length > 50) {
      return NextResponse.json(
        { error: 'Last name must be less than 50 characters' },
        { status: 400 }
      );
    }

    if (dateOfBirth) {
      const date = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - date.getFullYear();
      if (age < 13 || age > 120) {
        return NextResponse.json(
          { error: 'Invalid date of birth' },
          { status: 400 }
        );
      }
    }

    const db = getServerFirebase();
    
    // Check if user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if playername is already taken by another user
    const existingUserSnapshot = await db
      .collection('users')
      .where('playername', '==', playername)
      .limit(1)
      .get();

    if (!existingUserSnapshot.empty) {
      const existingUser = existingUserSnapshot.docs[0];
      // If the playername belongs to a different user, reject the update
      if (existingUser.id !== userId) {
        return NextResponse.json(
          { error: 'Deze spelersnaam is al in gebruik' },
          { status: 409 }
        );
      }
      // If it's the same user with the same playername, continue to update other fields
    }

    // Update user document
    const updateData: Record<string, unknown> = {
      playername,
      updatedAt: new Date().toISOString(),
    };

    // Add optional fields if provided
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;

    // Get old user data for comparison
    const oldUserData = userDoc.data();
    
    await db.collection('users').doc(userId).update(updateData);

    // Log the profile update activity
    const changes: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (oldUserData?.playername !== playername) {
      changes.playername = { old: oldUserData?.playername, new: playername };
    }
    if (firstName !== undefined && oldUserData?.firstName !== firstName) {
      changes.firstName = { old: oldUserData?.firstName, new: firstName };
    }
    if (lastName !== undefined && oldUserData?.lastName !== lastName) {
      changes.lastName = { old: oldUserData?.lastName, new: lastName };
    }
    if (dateOfBirth !== undefined && oldUserData?.dateOfBirth !== dateOfBirth) {
      changes.dateOfBirth = { old: oldUserData?.dateOfBirth, new: dateOfBirth };
    }

    // Only log if there were actual changes
    if (Object.keys(changes).length > 0) {
      await db.collection('activityLogs').add({
        action: 'USER_PROFILE_UPDATED',
        userId: userId,
        userEmail: oldUserData?.email,
        userName: oldUserData?.playername || oldUserData?.email,
        details: {
          changes: changes,
        },
        timestamp: new Date().toISOString(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Playername updated successfully' 
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
