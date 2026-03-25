import { adminHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export const POST = adminHandler('delete-user', async ({ uid, request }) => {
  const { targetUserId, deleteUser } = await request.json();

  if (!targetUserId || deleteUser === undefined) {
    throw new ApiError('Missing required fields', 400);
  }

  const db = getServerFirebase();

  // Check if target user exists
  const targetUserDoc = await db.collection('users').doc(targetUserId).get();
  if (!targetUserDoc.exists) {
    throw new ApiError('Target user not found', 404);
  }

  // Prevent admins from deleting themselves
  if (uid === targetUserId) {
    throw new ApiError('Je kunt jezelf niet verwijderen', 400);
  }

  // Prevent deleting other admins
  if (targetUserDoc.data()?.userType === 'admin') {
    throw new ApiError('Je kunt geen andere admins verwijderen', 400);
  }

  // Update user's deleted status
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (deleteUser) {
    updateData.deletedAt = new Date().toISOString();
    updateData.deletedBy = uid;

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
  const adminDoc = await db.collection('users').doc(uid).get();
  const adminData = adminDoc.data();
  const targetData = targetUserDoc.data();

  await db.collection('activityLogs').add({
    action: deleteUser ? 'USER_DELETED' : 'USER_RESTORED',
    userId: uid,
    userEmail: adminData?.email,
    userName: adminData?.playername || adminData?.email,
    targetUserId: targetUserId,
    targetUserEmail: targetData?.email,
    targetUserName: targetData?.playername || targetData?.email,
    details: {
      reason: deleteUser ? 'Admin soft-deleted user' : 'Admin restored deleted user',
    },
    timestamp: Timestamp.now(),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  });

  return {
    success: true,
    message: deleteUser ? 'User deleted successfully' : 'User restored successfully'
  };
});
