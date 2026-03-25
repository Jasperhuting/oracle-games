import { NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidateTag } from 'next/cache';
import { RANKINGS_CACHE_TAG } from '@/app/api/getRankings/route';
import { PLAYER_TEAMS_CACHE_TAG } from '@/app/api/getPlayerTeams/route';

export async function POST() {
  try {
    const db = getServerFirebase();

    // Get current version from Firestore
    const configRef = db.collection('config').doc('cache');
    const configDoc = await configRef.get();

    const currentVersion = configDoc.exists ? (configDoc.data()?.version || 1) : 1;
    const newVersion = currentVersion + 1;

    // Update version in Firestore with timestamp
    await configRef.set({
      version: newVersion,
      updatedAt: Timestamp.now()
    }, { merge: true });

    // Bust server-side data cache so the next request reads fresh Firestore data
    revalidateTag(RANKINGS_CACHE_TAG, {});
    revalidateTag(PLAYER_TEAMS_CACHE_TAG, {});

    return NextResponse.json({
      success: true,
      newVersion,
    });

  } catch (error) {
    console.error('Error incrementing cache version:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to increment cache version' },
      { status: 500 }
    );
  }
}
