import { getServerFirebase } from '@/lib/firebase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const db = getServerFirebase();

    const scraperDataSnapshot = await db.collection('scraper-data')
      .orderBy('__name__')
      .limit(50)
      .get();

    const docs = scraperDataSnapshot.docs.map(doc => ({
      id: doc.id,
      race: doc.data().race,
      year: doc.data().year,
      stage: doc.data().stage,
      stageResultsCount: doc.data().stageResults?.length || 0,
    }));

    return NextResponse.json({
      count: docs.length,
      documents: docs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list scraper data', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
