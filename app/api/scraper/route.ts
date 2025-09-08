import { NextRequest } from 'next/server';
import { getRiders, getStageResult, type RaceSlug } from '@/lib/scraper';
import { saveScraperData, type ScraperDataKey } from '@/lib/firebase/scraper-service';

export async function POST(request: NextRequest) {
  try {
    const { race, year, type, stage } = await request.json();

    // Validation
    if (!race || !year || !type) {
      return Response.json({ 
        error: 'Missing required fields: race, year, type' 
      }, { status: 400 });
    }

    if (!['startlist', 'stage', 'all-stages'].includes(type)) {
      return Response.json({ 
        error: 'Invalid type. Must be "startlist", "stage", or "all-stages"' 
      }, { status: 400 });
    }

    if (type === 'stage' && !stage) {
      return Response.json({ 
        error: 'Stage number required for stage type' 
      }, { status: 400 });
    }

    // Handle all-stages scraping
    if (type === 'all-stages') {
      const results = [];
      let totalDataCount = 0;
      const errors = [];

      // Scrape stages 1-21 (common for most grand tours)
      for (let stageNum = 1; stageNum <= 21; stageNum++) {
        try {
          const stageData = await getStageResult({
            race: race as RaceSlug,
            year: Number(year),
            stage: stageNum
          });

          const stageKey: ScraperDataKey = {
            race,
            year: Number(year),
            type: 'stage',
            stage: stageNum,
          };

          await saveScraperData(stageKey, stageData);
          
          const stageCount = 'stageResults' in stageData ? stageData.stageResults.length : 0;
          totalDataCount += stageCount;
          
          results.push({
            stage: stageNum,
            success: true,
            dataCount: stageCount
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ stage: stageNum, error: errorMsg });
          results.push({
            stage: stageNum,
            success: false,
            error: errorMsg
          });
        }
      }

      return Response.json({
        success: true,
        message: `All stages scraped. ${results.filter(r => r.success).length} successful, ${errors.length} failed.`,
        type: 'all-stages',
        totalStages: 21,
        successfulStages: results.filter(r => r.success).length,
        failedStages: errors.length,
        totalDataCount,
        results,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle single scrape (startlist or single stage)
    const key: ScraperDataKey = {
      race,
      year: Number(year),
      type: type as 'startlist' | 'stage',
      stage: type === 'stage' ? Number(stage) : undefined,
    };

    // Scrape the data
    let scraperData;
    if (type === 'startlist') {
      scraperData = await getRiders({ 
        race: race as RaceSlug, 
        year: Number(year) 
      });
    } else {
      scraperData = await getStageResult({ 
        race: race as RaceSlug, 
        year: Number(year), 
        stage: Number(stage) 
      });
    }

    // Save to Firebase (this will overwrite existing data)
    await saveScraperData(key, scraperData);

    console.log('scraperData', scraperData);

    // Calculate data count based on type
    let dataCount = 0;
    if (type === 'startlist') {
      dataCount = 'riders' in scraperData ? scraperData.riders.length : 0;
    } else {
      dataCount = 'stageResults' in scraperData ? scraperData.stageResults.length : 0;
    }

    return Response.json({
      success: true,
      message: 'Data scraped and saved to Firebase',
      key,
      dataCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Scraper error:', error);
    
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Unknown scraping error',
      success: false,
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const race = searchParams.get('race');
  const year = searchParams.get('year');
  const type = searchParams.get('type');
  const stage = searchParams.get('stage');

  if (race && year && type) {
    // Return specific data from Firebase
    try {
      const { getScraperData } = await import('@/lib/firebase/scraper-service');
      
      const key: ScraperDataKey = {
        race,
        year: Number(year),
        type: type as 'startlist' | 'stage',
        stage: stage ? Number(stage) : undefined,
      };

      const data = await getScraperData(key);
      
      if (!data) {
        return Response.json({ 
          error: 'Data not found',
          key 
        }, { status: 404 });
      }

      return Response.json({ 
        success: true,
        data,
        key 
      });

    } catch (error) {
      return Response.json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 500 });
    }
  }

  // Return list of available data
  try {
    const { listScraperData } = await import('@/lib/firebase/scraper-service');
    const availableData = await listScraperData();
    
    return Response.json({
      success: true,
      availableData,
      count: availableData.length,
    });
    
  } catch (error) {
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}