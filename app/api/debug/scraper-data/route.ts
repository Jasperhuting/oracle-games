import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('docId');

    if (!docId) {
      return NextResponse.json(
        { error: 'docId query parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[DEBUG_SCRAPER] Inspecting scraper data for: ${docId}`);

    const db = getServerFirebase();
    const doc = await db.collection('scraper-data').doc(docId).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: `No scraper data found for ${docId}` },
        { status: 404 }
      );
    }

    const data = doc.data();
    
    const debugInfo = {
      docId,
      exists: doc.exists,
      stageResultsType: typeof data?.stageResults,
      stageResultsLength: data?.stageResults?.length || 0,
      stageResults: null,
      parsedResults: null,
    };

    // Show raw stage results
    if (data?.stageResults) {
      if (typeof data.stageResults === 'string') {
        debugInfo.stageResults = data.stageResults;
        
        try {
          const parsed = JSON.parse(data.stageResults);
          debugInfo.parsedResults = {
            length: parsed.length,
            firstThree: parsed.slice(0, 3).map((result: any) => ({
              name: result.name,
              nameID: result.nameID,
              shortName: result.shortName,
              place: result.place,
              points: result.points,
            }))
          };
        } catch (e) {
          debugInfo.parsedResults = { error: 'Failed to parse JSON' };
        }
      } else if (Array.isArray(data.stageResults)) {
        debugInfo.stageResults = {
          type: 'array',
          length: data.stageResults.length,
          firstThree: data.stageResults.slice(0, 3).map((result: any) => ({
            name: result.name,
            nameID: result.nameID,
            shortName: result.shortName,
            place: result.place,
            points: result.points,
          }))
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: debugInfo,
    });

  } catch (error) {
    console.error('[DEBUG_SCRAPER] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to debug scraper data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
