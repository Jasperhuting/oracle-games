import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { userHandler, ApiError } from '@/lib/api/handler';

export const POST = userHandler('updateUser', async (ctx) => {
  const { request, uid } = ctx;
  const body = await request.json();
  const { userId, playername, firstName, lastName, dateOfBirth, preferredLanguage, emailNotifications, forumNotifications, avatarUrl, updates } = body;

  // If updates object is provided (for admin preferences), handle it separately
  if (updates && userId) {
    // Only admins may use the unrestricted `updates` spread path
    const db = getServerFirebase();
    const callerDoc = await db.collection('users').doc(uid).get();
    if (callerDoc.data()?.userType !== 'admin') {
      throw new ApiError('Unauthorized', 403);
    }

    // Check if user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new ApiError('User not found', 404);
    }

    const oldUserData = userDoc.data();
    const nextPlayername = typeof updates?.playername === 'string' ? updates.playername : undefined;

    // Update with the provided fields
    await db.collection('users').doc(userId).update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    if (nextPlayername && oldUserData?.playername !== nextPlayername) {
      const participantsSnapshot = await db
        .collection('gameParticipants')
        .where('userId', '==', userId)
        .get();

      const docs = participantsSnapshot.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = db.batch();
        for (const doc of docs.slice(i, i + 450)) {
          batch.update(doc.ref, { playername: nextPlayername });
        }
        await batch.commit();
      }
    }

    return {
      success: true,
      message: 'User preferences updated successfully',
    };
  }

  // Regular profile update — caller must be updating their own profile
  if (uid !== userId) {
    throw new ApiError('Forbidden', 403);
  }

  if (!userId || !playername) {
    throw new ApiError('User ID and playername are required', 400);
  }

  // Validate playername
  if (playername.length < 2 || playername.length > 50) {
    throw new ApiError('Playername must be between 2 and 50 characters', 400);
  }

  // Validate optional fields
  if (firstName && firstName.length > 50) {
    throw new ApiError('First name must be less than 50 characters', 400);
  }

  if (lastName && lastName.length > 50) {
    throw new ApiError('Last name must be less than 50 characters', 400);
  }

  if (dateOfBirth) {
    const date = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    if (age < 13 || age > 120) {
      throw new ApiError('Invalid date of birth', 400);
    }
  }

  // Validate preferred language
  if (preferredLanguage && !['en', 'nl'].includes(preferredLanguage)) {
    throw new ApiError('Invalid preferred language', 400);
  }

  const db = getServerFirebase();

  // Check if user exists
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new ApiError('User not found', 404);
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
      throw new ApiError('Deze spelersnaam is al in gebruik', 409);
    }
    // If it's the same user with the same playername, continue to update other fields
  }

  // Update user document
  const updateData: Record<string, unknown> = {
    playername,
    updatedAt: Timestamp.now(),
  };

  // Add optional fields if provided
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
  if (preferredLanguage !== undefined) updateData.preferredLanguage = preferredLanguage;
  if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
  if (forumNotifications !== undefined) {
    if (
      typeof forumNotifications !== 'object' ||
      forumNotifications === null ||
      typeof forumNotifications.replyOnMyTopic !== 'boolean' ||
      typeof forumNotifications.dailyDigest !== 'boolean' ||
      Object.keys(forumNotifications).length !== 2
    ) {
      throw new ApiError('Invalid forumNotifications', 400);
    }
    updateData.forumNotifications = forumNotifications;
  }
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  // Get old user data for comparison
  const oldUserData = userDoc.data();

  await db.collection('users').doc(userId).update(updateData);

  if (oldUserData?.playername !== playername) {
    const participantsSnapshot = await db
      .collection('gameParticipants')
      .where('userId', '==', userId)
      .get();

    const docs = participantsSnapshot.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + 450)) {
        batch.update(doc.ref, { playername });
      }
      await batch.commit();
    }
  }

  // Log the profile update activity
  const changes: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (oldUserData?.playername !== playername) {
    changes.playername = { old: oldUserData?.playername ?? null, new: playername };
  }
  if (firstName !== undefined && oldUserData?.firstName !== firstName) {
    changes.firstName = { old: oldUserData?.firstName ?? null, new: firstName };
  }
  if (lastName !== undefined && oldUserData?.lastName !== lastName) {
    changes.lastName = { old: oldUserData?.lastName ?? null, new: lastName };
  }
  if (dateOfBirth !== undefined && oldUserData?.dateOfBirth !== dateOfBirth) {
    changes.dateOfBirth = { old: oldUserData?.dateOfBirth ?? null, new: dateOfBirth };
  }
  if (preferredLanguage !== undefined && oldUserData?.preferredLanguage !== preferredLanguage) {
    changes.preferredLanguage = { old: oldUserData?.preferredLanguage ?? null, new: preferredLanguage };
  }
  if (emailNotifications !== undefined && oldUserData?.emailNotifications !== emailNotifications) {
    changes.emailNotifications = { old: oldUserData?.emailNotifications ?? null, new: emailNotifications };
  }
  if (avatarUrl !== undefined && oldUserData?.avatarUrl !== avatarUrl) {
    changes.avatarUrl = { old: oldUserData?.avatarUrl ?? null, new: avatarUrl };
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
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });
  }

  return {
    success: true,
    message: 'Playername updated successfully',
  };
});
