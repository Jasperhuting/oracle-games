import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { sendMessageNotification, sendBroadcastNotification } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, senderName, type, recipientId, recipientName, gameId, gameName, division, subject, message } = body;

    // Validate required fields
    if (!senderId || !senderName || !type || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify sender exists
    const senderDoc = await adminDb.collection('users').doc(senderId).get();
    if (!senderDoc.exists) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      );
    }

    const isAdmin = senderDoc.data()?.userType === 'admin';

    if (type === 'broadcast') {
      // Only admins can send broadcast messages
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Unauthorized: Only admins can send broadcast messages' },
          { status: 403 }
        );
      }
      // Send message to all users
      const usersSnapshot = await adminDb.collection('users').get();
      const batch = adminDb.batch();
      let messageCount = 0;

      usersSnapshot.docs.forEach((userDoc) => {
        const userId = userDoc.id;
        // Don't send to the sender themselves
        if (userId !== senderId) {
          const messageRef = adminDb.collection('messages').doc();
          batch.set(messageRef, {
            type: 'broadcast',
            senderId,
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
        action: 'message_broadcast',
        userId: senderId,
        userName: senderName,
        details: {
          subject,
          recipientCount: messageCount,
        },
        timestamp: new Date().toISOString(),
      });

      // Send Telegram notification
      try {
        await sendBroadcastNotification(senderName, subject, messageCount);
        console.log(`[MESSAGE] Telegram notification sent for broadcast from ${senderName}`);
      } catch (telegramError) {
        console.error('[MESSAGE] Failed to send Telegram notification:', telegramError);
      }

      return NextResponse.json({
        success: true,
        message: `Broadcast message sent to ${messageCount} users`,
        messageCount,
      });
    } else if (type === 'individual') {
      // Send message to specific user
      if (!recipientId) {
        return NextResponse.json(
          { error: 'Recipient ID is required for individual messages' },
          { status: 400 }
        );
      }

      // Verify recipient exists
      const recipientDoc = await adminDb.collection('users').doc(recipientId).get();
      if (!recipientDoc.exists) {
        return NextResponse.json(
          { error: 'Recipient not found' },
          { status: 404 }
        );
      }

      const finalRecipientName = recipientName || recipientDoc.data()?.displayName || recipientDoc.data()?.email || 'User';
      
      const messageRef = adminDb.collection('messages').doc();
      await messageRef.set({
        type: 'individual',
        senderId,
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
        action: 'message_sent',
        userId: senderId,
        userName: senderName,
        targetUserId: recipientId,
        targetUserName: finalRecipientName,
        details: {
          subject,
          messageId: messageRef.id,
        },
        timestamp: new Date().toISOString(),
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

      return NextResponse.json({
        success: true,
        message: 'Message sent successfully',
        messageId: messageRef.id,
      });
    } else if (type === 'game' || type === 'game_division') {
      // Only admins can send game messages
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Unauthorized: Only admins can send game messages' },
          { status: 403 }
        );
      }

      // Validate game ID
      if (!gameId) {
        return NextResponse.json(
          { error: 'Game ID is required for game messages' },
          { status: 400 }
        );
      }

      // Validate division for game_division type
      if (type === 'game_division' && !division) {
        return NextResponse.json(
          { error: 'Division is required for division messages' },
          { status: 400 }
        );
      }

      // Fetch game participants
      let participantsQuery = adminDb.collection('gameParticipants').where('gameId', '==', gameId);

      // Filter by division if specified
      if (type === 'game_division' && division) {
        participantsQuery = participantsQuery.where('assignedDivision', '==', division);
      }

      const participantsSnapshot = await participantsQuery.get();

      if (participantsSnapshot.empty) {
        return NextResponse.json(
          { error: 'No participants found for this game' + (division ? ' and division' : '') },
          { status: 404 }
        );
      }

      // Send message to all participants
      const batch = adminDb.batch();
      let messageCount = 0;

      participantsSnapshot.docs.forEach((participantDoc) => {
        const participant = participantDoc.data();
        const userId = participant.userId;

        // Don't send to the sender themselves
        if (userId !== senderId) {
          const messageRef = adminDb.collection('messages').doc();

          // Build message data object, only including defined fields
          const messageData: any = {
            type,
            senderId,
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
        userId: senderId,
        userName: senderName,
        details: activityDetails,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Message sent to ${messageCount} participant${messageCount !== 1 ? 's' : ''} of ${gameName}${type === 'game_division' ? ` (${division})` : ''}`,
        messageCount,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
