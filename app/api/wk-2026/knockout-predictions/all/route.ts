import { NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET() {
  try {
    const db = getServerFirebase();

    const snapshot = await db.collection('wk2026KnockoutPredictions').get();

    const predictions = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    return NextResponse.json({
      success: true,
      predictions,
    });
  } catch (error) {
    console.error('Error fetching all knockout predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
