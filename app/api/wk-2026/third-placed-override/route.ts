import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET() {
  try {
    const db = getServerFirebase();
    const doc = await db.collection('wk2026Config').doc('thirdPlacedOverride').get();

    if (!doc.exists) {
      return NextResponse.json({ success: true, order: null });
    }

    return NextResponse.json({ success: true, order: doc.data()?.order || null });
  } catch (error) {
    console.error('Error fetching third-placed override:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order } = body;

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: 'order must be an array' }, { status: 400 });
    }

    const db = getServerFirebase();
    await db.collection('wk2026Config').doc('thirdPlacedOverride').set({ order });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving third-placed override:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
