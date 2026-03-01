import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// POST: Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { text, userId, userName, userAvatar, replyTo, giphy } = body;
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    const hasGif = Boolean(giphy?.url);

    if ((!trimmedText && !hasGif) || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: text or giphy, userId' },
        { status: 400 }
      );
    }

    // Check room is open
    const roomDoc = await db.collection('chat_rooms').doc(roomId).get();
    if (!roomDoc.exists) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    const roomData = roomDoc.data()!;
    if (roomData.status === 'closed') {
      return NextResponse.json({ error: 'Chat is closed' }, { status: 403 });
    }
    const closesAt = roomData.closesAt?.toDate?.() || new Date(roomData.closesAt);
    if (closesAt <= new Date()) {
      return NextResponse.json({ error: 'Chat has expired' }, { status: 403 });
    }

    // Check if user is muted
    try {
      const mutedSnapshot = await db
        .collection(`chat_rooms/${roomId}/muted_users`)
        .where('userId', '==', userId)
        .get();
      const now = new Date();
      const isMuted = mutedSnapshot.docs.some((doc) => {
        const mutedUntil = doc.data().mutedUntil?.toDate?.() || new Date(doc.data().mutedUntil);
        return mutedUntil > now;
      });
      if (isMuted) {
        return NextResponse.json({ error: 'You are muted' }, { status: 403 });
      }
    } catch (muteCheckError) {
      // If muted_users subcollection doesn't exist yet, that's fine
      console.log('Mute check skipped (no muted_users yet):', muteCheckError);
    }

    // Resolve sender profile from users collection to avoid client-side "Anoniem" fallback.
    let resolvedUserName = 'Anoniem';
    let resolvedUserAvatar: string | null = userAvatar || null;
    try {
      const userDoc = await db.collection('users').doc(String(userId)).get();
      if (userDoc.exists) {
        const profile = userDoc.data() || {};
        resolvedUserName = String(
          profile.playername ||
          profile.displayName ||
          profile.email ||
          userName ||
          'Anoniem'
        );
        resolvedUserAvatar = profile.avatarUrl || resolvedUserAvatar;
      } else if (userName) {
        resolvedUserName = String(userName);
      }
    } catch (profileError) {
      console.log('User profile lookup failed, using request fallback:', profileError);
      if (userName) {
        resolvedUserName = String(userName);
      }
    }

    const messageData = {
      text: trimmedText,
      giphy: hasGif
        ? {
            id: String(giphy.id || ''),
            title: String(giphy.title || 'GIF'),
            url: String(giphy.url || ''),
            previewUrl: String(giphy.previewUrl || giphy.url || ''),
            width: typeof giphy.width === 'number' ? giphy.width : null,
            height: typeof giphy.height === 'number' ? giphy.height : null,
          }
        : null,
      userId,
      userName: resolvedUserName,
      userAvatar: resolvedUserAvatar,
      replyTo: replyTo || null,
      reactions: {},
      deleted: false,
      createdAt: Timestamp.now(),
    };

    const docRef = await db.collection(`chat_rooms/${roomId}/messages`).add(messageData);

    // Increment message count
    await db.collection('chat_rooms').doc(roomId).update({
      messageCount: FieldValue.increment(1),
    });

    return NextResponse.json({ id: docRef.id });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
