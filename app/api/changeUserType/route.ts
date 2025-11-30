import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { adminUserId, targetUserId, newUserType } = await request.json();

    if (!adminUserId || !targetUserId || !newUserType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate newUserType
    if (!['user', 'admin'].includes(newUserType)) {
      return NextResponse.json(
        { error: 'Invalid user type. Must be "user" or "admin"' },
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

    // Check if target user exists
    const targetUserDoc = await db.collection('users').doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    const targetUserData = targetUserDoc.data();

    // Prevent admins from changing their own user type
    if (adminUserId === targetUserId) {
      return NextResponse.json(
        { error: 'You cannot change your own user type' },
        { status: 400 }
      );
    }

    // Prevent changing admin to user
    if (targetUserData?.userType === 'admin' && newUserType === 'user') {
      return NextResponse.json(
        { error: 'It is not allowed to downgrade an admin to a user' }, 
        { status: 400 }
      );
    }

    // If the user type is already the same, no need to update
    if (targetUserData?.userType === newUserType) {
      return NextResponse.json({
        success: true,
        message: 'User type is already set to this value'
      });
    }

    // Update user's type
    const updateData: Record<string, unknown> = {
      userType: newUserType,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(targetUserId).update(updateData);

    // Log the activity
    const adminData = adminDoc.data();

    await db.collection('activityLogs').add({
      action: 'USER_TYPE_CHANGED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      targetUserId: targetUserId,
      targetUserEmail: targetUserData?.email,
      targetUserName: targetUserData?.playername || targetUserData?.email,
      details: {
        oldUserType: targetUserData?.userType,
        newUserType: newUserType,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `User type changed to ${newUserType} successfully`
    });
  } catch (error) {
    console.error('Error changing user type:', error);
    return NextResponse.json(
      { error: 'Failed to change user type', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
