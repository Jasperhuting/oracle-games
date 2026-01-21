import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getRiders, getStageResult, getRaceResult, getTourGCResult } from '@/lib/scraper';
import { saveScraperData, type ScraperDataKey } from '@/lib/firebase/scraper-service';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Initialize Firebase Admin with error handling
  let db;
  
  try {
    try {
      db = getServerFirebase();
      console.log('[SCRAPER] Firebase Admin initialized successfully');
      
      // Test connection with a simple query
      await db.collection('users').limit(1).get();
      console.log('[SCRAPER] Firebase connection test successful');
    } catch (error) {
      console.error('[SCRAPER] Firebase Admin initialization failed:', error);
      return Response.json({ 
        error: 'Firebase initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }, { status: 500 });
    }
    const { race, year, type, stage, userId, userEmail, userName } = await request.json();

    // Validation
    if (!race || !year || !type) {
      return Response.json({ 
        error: 'Missing required fields: race, year, type' 
      }, { status: 400 });
    }

    if (!['startlist', 'stage', 'all-stages', 'result', 'tour-gc'].includes(type)) {
      return Response.json({
        error: 'Invalid type. Must be "startlist", "stage", "all-stages", "result", or "tour-gc"'
      }, { status: 400 });
    }

    if (type === 'stage' && (stage === undefined || stage === null || stage === '')) {
      return Response.json({ 
        error: 'Stage number required for stage type' 
      }, { status: 400 });
    }

    // Log scrape start
    try {
      await db.collection('activityLogs').add({
        action: 'SCRAPE_STARTED',
        userId: userId || 'unknown',
        userEmail: userEmail || null,
        userName: userName || null,
        details: {
          scrapeType: type,
          race,
          year: Number(year),
          stage: stage || null,
        },
        timestamp: Timestamp.now(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });
      console.log('[SCRAPER] Activity log entry created successfully');
    } catch (logError) {
      console.error('[SCRAPER] Failed to write activity log:', logError);
      // Don't fail the scrape if logging fails, but continue
    }

    // Handle all-stages scraping
    if (type === 'all-stages') {
      const results = [];
      let totalDataCount = 0;
      const errors = [];

      // Determine number of stages based on race
      let maxStages = 21; // default for grand tours
      if (race === 'tour-down-under') {
        maxStages = 6; // Tour Down Under 2026 has 6 stages
      } else if (race === 'paris-nice') {
        maxStages = 8; // Paris-Nice typically has 8 stages
      } else if (race === 'tirreno-adriatico') {
        maxStages = 8; // Tirreno-Adriatico typically has 8 stages
      } else if (race === 'volta-a-catalunya') {
        maxStages = 7; // Volta a Catalunya typically has 7 stages
      } else if (race === 'dauphine') {
        maxStages = 8; // Dauphine typically has 8 stages
      } else if (race === 'vuelta-al-tachira') {
        maxStages = 10; // Vuelta al Táchira has 10 stages
      }

      // Scrape stages 1-maxStages
      for (let stageNum = 1; stageNum <= maxStages; stageNum++) {
        try {
          const stageData = await getStageResult({
            race,
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

      // Calculate execution time and cost (EUR, ~0.92 USD/EUR rate)
      const executionTimeMs = Date.now() - startTime;
      const executionTimeSec = executionTimeMs / 1000;
      const estimatedCostEur = executionTimeSec * 0.00005 * 0.92;

      // Log completion
      await db.collection('activityLogs').add({
        action: 'SCRAPE_COMPLETED',
        userId: userId || 'unknown',
        userEmail: userEmail || null,
        userName: userName || null,
        details: {
          scrapeType: type,
          race,
          year: Number(year),
          successfulStages: results.filter(r => r.success).length,
          failedStages: errors.length,
          totalDataCount,
          executionTimeMs,
          executionTimeSec: Math.round(executionTimeSec * 10) / 10,
          estimatedCostEur: Math.round(estimatedCostEur * 100000) / 100000,
        },
        timestamp: Timestamp.now(),
      });

      return Response.json({
        success: true,
        message: `All stages scraped. ${results.filter(r => r.success).length} successful, ${errors.length} failed.`,
        type: 'all-stages',
        totalStages: maxStages,
        successfulStages: results.filter(r => r.success).length,
        failedStages: errors.length,
        totalDataCount,
        results,
        errors: errors.length > 0 ? errors : null,
        timestamp: Timestamp.now(),
        executionTimeMs,
        estimatedCostEur,
      });
    }

    // Handle single scrape (startlist, single stage, race result, or tour GC)
    const key: ScraperDataKey = {
      race,
      year: Number(year),
      type: type as 'startlist' | 'stage' | 'result' | 'tour-gc',
      stage: type === 'stage' ? Number(stage) : undefined,
    };

    // Scrape the data
    let scraperData;
    if (type === 'startlist') {
      scraperData = await getRiders({
        race,
        year: Number(year)
      });
    } else if (type === 'result') {
      // Single-day race results (e.g., ITT, one-day classics)
      scraperData = await getRaceResult({
        race,
        year: Number(year)
      });
    } else if (type === 'tour-gc') {
      // Tour General Classification results
      scraperData = await getTourGCResult({
        race,
        year: Number(year)
      });
    } else {
      scraperData = await getStageResult({
        race,
        year: Number(year),
        stage: Number(stage)
      });
    }

    // Save to Firebase (this will overwrite existing data)
    try {
      await saveScraperData(key, scraperData);
      console.log('[SCRAPER] Data saved successfully to Firebase');
    } catch (saveError) {
      console.error('[SCRAPER] Failed to save data to Firebase:', saveError);
      return Response.json({ 
        error: 'Failed to save data to Firebase',
        details: saveError instanceof Error ? saveError.message : 'Unknown error',
        success: false,
      }, { status: 500 });
    }

    // Trigger points calculation for stage results, single-day race results, and tour GC results
    if (type === 'stage' || type === 'result' || type === 'tour-gc') {
      try {
        console.log(`[scraper] Triggering points calculation for ${race} ${type === 'result' ? 'result' : type === 'tour-gc' ? 'tour-gc' : `stage ${stage}`}`);
        const calculatePointsModule = await import('@/app/api/games/calculate-points/route');
        const calculatePoints = calculatePointsModule.POST;
        
        const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
          method: 'POST',
          body: JSON.stringify({
            raceSlug: race,
            stage: type === 'result' ? 'result' : type === 'tour-gc' ? 'tour-gc' : Number(stage),
            year: Number(year),
          }),
        });

        const calculatePointsResponse = await calculatePoints(mockRequest);
        const pointsResult = await calculatePointsResponse.json();
        
        if (calculatePointsResponse.status === 200) {
          console.log('[scraper] Points calculation completed:', pointsResult);
        } else {
          console.error('[scraper] Failed to calculate points:', pointsResult);
        }
      } catch (error) {
        console.error('[scraper] Error calculating points:', error);
        // Don't fail the scrape if points calculation fails
      }
    }

    // Calculate data count based on type
    let dataCount = 0;
    if (type === 'startlist') {
      dataCount = 'riders' in scraperData ? scraperData.riders.length : 0;
    } else {
      dataCount = 'stageResults' in scraperData ? scraperData.stageResults.length : 0;
    }

    // Calculate execution time and cost (EUR, ~0.92 USD/EUR rate)
    const executionTimeMs = Date.now() - startTime;
    const executionTimeSec = executionTimeMs / 1000;
    const estimatedCostEur = executionTimeSec * 0.00005 * 0.92;

    // Log completion
    await db.collection('activityLogs').add({
      action: 'SCRAPE_COMPLETED',
      userId: userId || 'unknown',
      userEmail: userEmail || undefined,
      userName: userName || undefined,
      details: {
        scrapeType: type,
        race,
        year: Number(year),
        stage: stage || null,
        dataCount,
        executionTimeMs,
        executionTimeSec: Math.round(executionTimeSec * 10) / 10,
        estimatedCostEur: Math.round(estimatedCostEur * 100000) / 100000,
      },
      timestamp: Timestamp.now(),
    });

    return Response.json({
      success: true,
      message: 'Data scraped and saved to Firebase',
      key,
      dataCount,
      timestamp: Timestamp.now(),
      executionTimeMs,
      estimatedCostEur,
    });

  } catch (error) {
    console.error('Scraper error:', error);

    // Calculate execution time for failed scrape
    const executionTimeMs = Date.now() - startTime;

    // Log failure
    try {
      if (db) {
        await db.collection('activityLogs').add({
          action: 'SCRAPE_FAILED',
          userId: 'unknown',
          details: {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            executionTimeMs,
          },
          timestamp: Timestamp.now(),
        });
      }
    } catch {
      // Ignore logging errors
    }
    
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
        type: type as 'startlist' | 'stage' | 'result' | 'tour-gc',
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