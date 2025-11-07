import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getAuth } from 'firebase-admin/auth';

export async function POST(request: NextRequest) {
  try {
    const { adminUserId, targetUserId, block } = await request.json();

    if (!adminUserId || !targetUserId || block === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Prevent admins from blocking themselves
    if (adminUserId === targetUserId) {
      return NextResponse.json(
        { error: 'Je kunt jezelf niet blokkeren' },
        { status: 400 }
      );
    }

    // Prevent blocking other admins
    if (targetUserDoc.data()?.userType === 'admin') {
      return NextResponse.json(
        { error: 'Je kunt geen andere admins blokkeren' },
        { status: 400 }
      );
    }

    // Update user's blocked status
    const updateData: any = {
      blocked: block,
      updatedAt: new Date().toISOString(),
    };

    if (block) {
      updateData.blockedAt = new Date().toISOString();
      updateData.blockedBy = adminUserId;
      
      // Also disable the user in Firebase Auth
      try {
        const auth = getAuth();
        await auth.updateUser(targetUserId, {
          disabled: true,
        });
      } catch (authError) {
        console.error('Error disabling user in Firebase Auth:', authError);
        // Continue anyway - Firestore update is more important
      }
    } else {
      // Remove blocked fields when unblocking
      updateData.blockedAt = null;
      updateData.blockedBy = null;
      
      // Re-enable the user in Firebase Auth
      try {
        const auth = getAuth();
        await auth.updateUser(targetUserId, {
          disabled: false,
        });
      } catch (authError) {
        console.error('Error enabling user in Firebase Auth:', authError);
        // Continue anyway - Firestore update is more important
      }
    }

    await db.collection('users').doc(targetUserId).update(updateData);

    // Log the activity
    const adminData = adminDoc.data();
    const targetData = targetUserDoc.data();
    
    await db.collection('activityLogs').add({
      action: block ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      targetUserId: targetUserId,
      targetUserEmail: targetData?.email,
      targetUserName: targetData?.playername || targetData?.email,
      details: {
        reason: block ? 'Admin blocked user' : 'Admin unblocked user',
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ 
      success: true,
      message: block ? 'User blocked successfully' : 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Error blocking/unblocking user:', error);
    return NextResponse.json(
      { error: 'Failed to update user status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
