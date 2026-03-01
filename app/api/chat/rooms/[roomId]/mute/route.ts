import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// POST: Mute a user (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { userId, mutedBy, durationMinutes, reason } = body;

    if (!userId || !mutedBy || !durationMinutes) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, mutedBy, durationMinutes' },
        { status: 400 }
      );
    }

    const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    await db.collection(`chat_rooms/${roomId}/muted_users`).add({
      userId,
      mutedBy,
      mutedUntil: Timestamp.fromDate(mutedUntil),
      reason: reason || null,
    });

    return NextResponse.json({ success: true, mutedUntil: mutedUntil.toISOString() });
  } catch (error) {
    console.error('Error muting user:', error);
    return NextResponse.json({ error: 'Failed to mute user' }, { status: 500 });
  }
}
