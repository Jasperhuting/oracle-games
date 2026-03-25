import { adminHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = adminHandler('change-user-type', async ({ uid, request }) => {
  const { targetUserId, newUserType } = await request.json();

  if (!targetUserId || !newUserType) {
    throw new ApiError('Missing required fields', 400);
  }

  // Validate newUserType
  if (!['user', 'admin'].includes(newUserType)) {
    throw new ApiError('Invalid user type. Must be "user" or "admin"', 400);
  }

  const db = getServerFirebase();

  // Check if target user exists
  const targetUserDoc = await db.collection('users').doc(targetUserId).get();
  if (!targetUserDoc.exists) {
    throw new ApiError('Target user not found', 404);
  }

  const targetUserData = targetUserDoc.data();

  // Prevent admins from changing their own user type
  if (uid === targetUserId) {
    throw new ApiError('You cannot change your own user type', 400);
  }

  // Prevent changing admin to user
  if (targetUserData?.userType === 'admin' && newUserType === 'user') {
    throw new ApiError('It is not allowed to downgrade an admin to a user', 400);
  }

  // If the user type is already the same, no need to update
  if (targetUserData?.userType === newUserType) {
    return {
      success: true,
      message: 'User type is already set to this value'
    };
  }

  // Update user's type
  const updateData: Record<string, unknown> = {
    userType: newUserType,
    updatedAt: new Date().toISOString(),
  };

  await db.collection('users').doc(targetUserId).update(updateData);

  // Log the activity
  const adminDoc = await db.collection('users').doc(uid).get();
  const adminData = adminDoc.data();

  await db.collection('activityLogs').add({
    action: 'USER_TYPE_CHANGED',
    userId: uid,
    userEmail: adminData?.email,
    userName: adminData?.playername || adminData?.email,
    targetUserId: targetUserId,
    targetUserEmail: targetUserData?.email,
    targetUserName: targetUserData?.playername || targetUserData?.email,
    details: {
      oldUserType: targetUserData?.userType,
      newUserType: newUserType,
    },
    timestamp: Timestamp.now(),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  });

  return {
    success: true,
    message: `User type changed to ${newUserType} successfully`
  };
});
