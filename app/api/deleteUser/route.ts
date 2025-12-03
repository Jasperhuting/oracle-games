import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getAuth } from 'firebase-admin/auth';

export async function POST(request: NextRequest) {
  try {
    const { adminUserId, targetUserId, deleteUser } = await request.json();

    if (!adminUserId || !targetUserId || deleteUser === undefined) {
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

    // Prevent admins from deleting themselves
    if (adminUserId === targetUserId) {
      return NextResponse.json(
        { error: 'Je kunt jezelf niet verwijderen' },
        { status: 400 }
      );
    }

    // Prevent deleting other admins
    if (targetUserDoc.data()?.userType === 'admin') {
      return NextResponse.json(
        { error: 'Je kunt geen andere admins verwijderen' },
        { status: 400 }
      );
    }

    // Update user's deleted status
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (deleteUser) {
      updateData.deletedAt = new Date().toISOString();
      updateData.deletedBy = adminUserId;

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
      // Remove deleted fields when restoring
      updateData.deletedAt = null;
      updateData.deletedBy = null;

      // Re-enable the user in Firebase Auth (only if not blocked)
      const targetData = targetUserDoc.data();
      if (!targetData?.blocked) {
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
    }

    await db.collection('users').doc(targetUserId).update(updateData);

    // Log the activity
    const adminData = adminDoc.data();
    const targetData = targetUserDoc.data();

    await db.collection('activityLogs').add({
      action: deleteUser ? 'USER_DELETED' : 'USER_RESTORED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      targetUserId: targetUserId,
      targetUserEmail: targetData?.email,
      targetUserName: targetData?.playername || targetData?.email,
      details: {
        reason: deleteUser ? 'Admin soft-deleted user' : 'Admin restored deleted user',
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: deleteUser ? 'User deleted successfully' : 'User restored successfully'
    });
  } catch (error) {
    console.error('Error deleting/restoring user:', error);
    return NextResponse.json(
      { error: 'Failed to update user status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
