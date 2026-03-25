import { adminHandler, ApiError } from '@/lib/api/handler';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { sendMessageNotification, sendBroadcastNotification } from '@/lib/telegram';

export const POST = adminHandler('send-message', async ({ uid, request }) => {
  const body = await request.json();
  const { type, recipientId, recipientName, gameId, gameName, division, subject, message } = body;

  // Validate required fields
  if (!type || !subject || !message) {
    throw new ApiError('Missing required fields', 400);
  }

  // Fetch sender info from Firestore using verified uid
  const senderDoc = await adminDb.collection('users').doc(uid).get();
  const senderName = senderDoc.data()?.playername || senderDoc.data()?.displayName || senderDoc.data()?.email || 'Admin';

  if (type === 'broadcast') {
    // Send message to all users
    const usersSnapshot = await adminDb.collection('users').get();
    const batch = adminDb.batch();
    let messageCount = 0;

    usersSnapshot.docs.forEach((userDoc) => {
      const userId = userDoc.id;
      // Don't send to the sender themselves
      if (userId !== uid) {
        const messageRef = adminDb.collection('messages').doc();
        batch.set(messageRef, {
          type: 'broadcast',
          senderId: uid,
          senderName,
          recipientId: userId,
          recipientName: userDoc.data()?.displayName || userDoc.data()?.email || 'User',
          subject,
          message,
          sentAt: Timestamp.now(),
          read: false,
        });
        messageCount++;
      }
    });

    await batch.commit();

    // Log activity
    const activityLogRef = adminDb.collection('activityLogs').doc();
    await activityLogRef.set({
      action: 'MESSAGE_BROADCAST',
      userId: uid,
      userName: senderName,
      details: {
        subject,
        recipientCount: messageCount,
      },
      timestamp: Timestamp.now(),
    });

    // Send Telegram notification
    try {
      await sendBroadcastNotification(senderName, subject, messageCount);
      console.log(`[MESSAGE] Telegram notification sent for broadcast from ${senderName}`);
    } catch (telegramError) {
      console.error('[MESSAGE] Failed to send Telegram notification:', telegramError);
    }

    return {
      success: true,
      message: `Broadcast message sent to ${messageCount} users`,
      messageCount,
    };
  } else if (type === 'individual') {
    // Send message to specific user
    if (!recipientId) {
      throw new ApiError('Recipient ID is required for individual messages', 400);
    }

    // Verify recipient exists
    const recipientDoc = await adminDb.collection('users').doc(recipientId).get();
    if (!recipientDoc.exists) {
      throw new ApiError('Recipient not found', 404);
    }

    const finalRecipientName = recipientName || recipientDoc.data()?.displayName || recipientDoc.data()?.email || 'User';

    const messageRef = adminDb.collection('messages').doc();
    await messageRef.set({
      type: 'individual',
      senderId: uid,
      senderName,
      recipientId,
      recipientName: finalRecipientName,
      subject,
      message,
      sentAt: Timestamp.now(),
      read: false,
    });

    // Log activity
    const activityLogRef = adminDb.collection('activityLogs').doc();
    await activityLogRef.set({
      action: 'MESSAGE_SENT',
      userId: uid,
      userName: senderName,
      targetUserId: recipientId,
      targetUserName: finalRecipientName,
      details: {
        subject,
        messageId: messageRef.id,
      },
      timestamp: Timestamp.now(),
    });

    // Send Telegram notification
    try {
      const senderEmail = senderDoc.data()?.email || 'Onbekend';
      await sendMessageNotification(
        senderName,
        senderEmail,
        finalRecipientName,
        subject,
        message
      );
      console.log(`[MESSAGE] Telegram notification sent for message from ${senderName} to ${finalRecipientName}`);
    } catch (telegramError) {
      console.error('[MESSAGE] Failed to send Telegram notification:', telegramError);
    }

    return {
      success: true,
      message: 'Message sent successfully',
      messageId: messageRef.id,
    };
  } else if (type === 'game' || type === 'game_division') {
    // Validate game ID
    if (!gameId) {
      throw new ApiError('Game ID is required for game messages', 400);
    }

    // Validate division for game_division type
    if (type === 'game_division' && !division) {
      throw new ApiError('Division is required for division messages', 400);
    }

    // Fetch game participants
    let participantsQuery = adminDb.collection('gameParticipants').where('gameId', '==', gameId);

    // Filter by division if specified
    if (type === 'game_division' && division) {
      participantsQuery = participantsQuery.where('assignedDivision', '==', division);
    }

    const participantsSnapshot = await participantsQuery.get();

    if (participantsSnapshot.empty) {
      throw new ApiError('No participants found for this game' + (division ? ' and division' : ''), 404);
    }

    // Send message to all participants
    const batch = adminDb.batch();
    let messageCount = 0;

    participantsSnapshot.docs.forEach((participantDoc) => {
      const participant = participantDoc.data();
      const userId = participant.userId;

      // Don't send to the sender themselves
      if (userId !== uid) {
        const messageRef = adminDb.collection('messages').doc();

        // Build message data object, only including defined fields
        const messageData: any = {
          type,
          senderId: uid,
          senderName,
          recipientId: userId,
          recipientName: participant.playername || 'Player',
          gameId,
          gameName,
          subject,
          message,
          sentAt: Timestamp.now(),
          read: false,
        };

        // Only add division field if it exists
        if (type === 'game_division' && division) {
          messageData.division = division;
        }

        batch.set(messageRef, messageData);
        messageCount++;
      }
    });

    await batch.commit();

    // Log activity
    const activityLogRef = adminDb.collection('activityLogs').doc();
    const activityDetails: any = {
      subject,
      gameId,
      gameName,
      recipientCount: messageCount,
    };

    // Only add division to details if it exists
    if (type === 'game_division' && division) {
      activityDetails.division = division;
    }

    await activityLogRef.set({
      action: type === 'game_division' ? 'message_game_division' : 'message_game',
      userId: uid,
      userName: senderName,
      details: activityDetails,
      timestamp: Timestamp.now(),
    });

    return {
      success: true,
      message: `Message sent to ${messageCount} participant${messageCount !== 1 ? 's' : ''} of ${gameName}${type === 'game_division' ? ` (${division})` : ''}`,
      messageCount,
    };
  } else {
    throw new ApiError('Invalid message type', 400);
  }
});
