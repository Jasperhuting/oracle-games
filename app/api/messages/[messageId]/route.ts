import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { userHandler, ApiError } from '@/lib/api/handler';

export const DELETE = userHandler('messages/DELETE', async (ctx) => {
  const { uid, params } = ctx;
  const { messageId } = params;

  // Get the message to verify ownership
  const messageRef = adminDb.collection('messages').doc(messageId);
  const messageDoc = await messageRef.get();

  if (!messageDoc.exists) {
    throw new ApiError('Message not found', 404);
  }

  const messageData = messageDoc.data();

  // Verify that the user is either the sender or recipient
  const isSender = messageData?.senderId === uid;
  const isRecipient = messageData?.recipientId === uid;

  if (!isSender && !isRecipient) {
    throw new ApiError('Unauthorized: You can only delete your own messages', 403);
  }

  // Soft delete: mark as deleted by sender or recipient
  const updateData: { deletedBySender?: boolean; deletedByRecipient?: boolean } = {};

  if (isSender) {
    updateData.deletedBySender = true;
  }

  if (isRecipient) {
    updateData.deletedByRecipient = true;
  }

  await messageRef.update(updateData);

  return {
    success: true,
    message: 'Message deleted successfully',
  };
});
