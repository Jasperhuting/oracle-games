import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { messageId } = params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get the message to verify ownership
    const messageRef = adminDb.collection('messages').doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const messageData = messageDoc.data();

    // Verify that the user is either the sender or recipient
    const isSender = messageData?.senderId === userId;
    const isRecipient = messageData?.recipientId === userId;

    if (!isSender && !isRecipient) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only delete your own messages' },
        { status: 403 }
      );
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

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
