import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetUserId, adminUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      );
    }

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      );
    }

    // Verify the user is an admin
    const adminUserDoc = await adminDb.collection('users').doc(adminUserId).get();
    const adminUserData = adminUserDoc.data();

    if (!adminUserData || adminUserData.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get the target user data
    const targetUserDoc = await adminDb.collection('users').doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    const targetUserData = targetUserDoc.data();
    const targetAuthUser = await adminAuth.getUser(targetUserId);

    // Create a custom token for the target user
    const customToken = await adminAuth.createCustomToken(targetUserId);
    
    // Create a custom token for the admin to restore session later
    const adminToken = await adminAuth.createCustomToken(adminUserId);

    // Store impersonation info in a separate cookie
    const impersonationData = {
      realAdminId: adminUserId,
      impersonatedUserId: targetUserId,
      startedAt: new Date().toISOString(),
    };

    const response = NextResponse.json({
      success: true,
      customToken,
      adminToken,
      impersonatedUser: {
        uid: targetAuthUser.uid,
        email: targetAuthUser.email,
        displayName: targetUserData?.playername || targetAuthUser.displayName,
      },
      realAdmin: {
        uid: adminUserId,
        email: adminUserData.email,
        displayName: adminUserData.playername,
      },
    });

    // Set impersonation cookie
    response.cookies.set('impersonation', JSON.stringify(impersonationData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Log the impersonation action
    await adminDb.collection('activityLogs').add({
      action: 'IMPERSONATION_STARTED',
      userId: adminUserId,
      userEmail: adminUserData.email,
      userName: adminUserData.playername,
      details: {
        targetUserId,
        targetUserEmail: targetAuthUser.email,
        targetUserName: targetUserData?.playername,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return response;
  } catch (error) {
    console.error('Error starting impersonation:', error);
    return NextResponse.json(
      { error: 'Failed to start impersonation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
