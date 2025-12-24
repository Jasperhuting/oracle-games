import { NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST() {
  try {
    const db = getServerFirebase();

    // Get current version from Firestore
    const systemRef = db.collection('system').doc('cache');
    const systemDoc = await systemRef.get();

    const currentVersion = systemDoc.exists ? (systemDoc.data()?.version || 1) : 1;
    const newVersion = currentVersion + 1;

    // Update version in Firestore
    await systemRef.set({ version: newVersion }, { merge: true });

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
