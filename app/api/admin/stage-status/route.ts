import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import {
  getScraperDataWithMetadata,
  listScraperDataBackups,
  generateDocumentId,
  type ScraperDataKey,
} from '@/lib/firebase/scraper-service';
import { validateScraperData } from '@/lib/validation/scraper-validation';

export interface StageDetailResponse {
  race: string;
  year: number;
  stage: number | string;
  docId: string;
  exists: boolean;
  updatedAt: string | null;

  // Data summary
  riderCount: number;
  hasGC: boolean;
  hasPointsClassification: boolean;
  hasMountainsClassification: boolean;
  hasYouthClassification: boolean;
  hasTeamClassification: boolean;

  // Validation
  validation: {
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  } | null;

  // Backup info
  backups: Array<{
    id: string;
    backedUpAt: string;
    backupReason: string;
  }>;

  // Sample data (first 5 riders)
  sampleRiders: Array<{
    place: number;
    name: string;
    team: string;
    points: string | number;
  }>;
}

// GET /api/admin/stage-status - Get detailed status for a specific stage
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const race = searchParams.get('race');
    const yearParam = searchParams.get('year');
    const stageParam = searchParams.get('stage');
    const typeParam = searchParams.get('type') || 'stage'; // stage, startlist, result, tour-gc

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!race || !yearParam) {
      return NextResponse.json(
        { error: 'Race and year are required' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10);
    const parsedStage = stageParam !== null ? Number(stageParam) : NaN;
    const stage = stageParam !== null && Number.isFinite(parsedStage) ? parsedStage : undefined;

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Build key
    const key: ScraperDataKey = {
      race,
      year,
      type: typeParam as 'startlist' | 'stage' | 'result' | 'tour-gc',
      ...(stage !== undefined && { stage }),
    };

    const docId = generateDocumentId(key);

    // Get data with metadata
    const dataWithMeta = await getScraperDataWithMetadata(key);

    if (!dataWithMeta) {
      // Document doesn't exist
      return NextResponse.json<StageDetailResponse>({
        race,
        year,
        stage: stage ?? typeParam,
        docId,
        exists: false,
        updatedAt: null,
        riderCount: 0,
        hasGC: false,
        hasPointsClassification: false,
        hasMountainsClassification: false,
        hasYouthClassification: false,
        hasTeamClassification: false,
        validation: null,
        backups: [],
        sampleRiders: [],
      });
    }

    // Run fresh validation
    const validation = validateScraperData(dataWithMeta.data);

    // Get backups
    const backups = await listScraperDataBackups(docId);

    const toArray = (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const getSampleSourceRows = (): Array<Record<string, unknown>> => {
      const data = dataWithMeta.data as Record<string, unknown>;
      const stageRows = toArray(data.stageResults);
      const gcRows = toArray(data.generalClassification);

      const normalized = (rows: unknown[]) =>
        rows.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);

      if (typeParam === 'tour-gc') {
        return normalized(gcRows);
      }
      if (typeParam === 'result') {
        return normalized(stageRows);
      }
      return normalized(stageRows.length > 0 ? stageRows : gcRows);
    };

    // Extract sample riders - show top finishers even if points are missing (common for GC docs).
    const sampleRiders: StageDetailResponse['sampleRiders'] = [];
    const sampleRows = getSampleSourceRows();
    sampleRows.forEach((row) => {
      // Skip TTT aggregate rows.
      if (Array.isArray(row.riders)) return;

      const placeRaw = row.place;
      const place = typeof placeRaw === 'number' ? placeRaw : Number(placeRaw);
      if (!Number.isFinite(place) || place <= 0) return;

      const firstName = typeof row.firstName === 'string' ? row.firstName : '';
      const lastName = typeof row.lastName === 'string' ? row.lastName : '';
      const riderName = typeof row.rider === 'string' ? row.rider : '';
      const shortName = typeof row.shortName === 'string' ? row.shortName : '';
      const fallbackName = `${firstName} ${lastName}`.trim();
      const name = shortName || riderName || fallbackName || 'Unknown';
      const team = typeof row.team === 'string' ? row.team : '';
      const points = row.points ?? row.pointsTotal ?? row.timeDifference ?? row.gc ?? '-';

      sampleRiders.push({
        place,
        name,
        team,
        points: typeof points === 'number' || typeof points === 'string' ? points : '-',
      });
    });

    sampleRiders.sort((a, b) => a.place - b.place);

    const response: StageDetailResponse = {
      race,
      year,
      stage: stage ?? typeParam,
      docId,
      exists: true,
      updatedAt: dataWithMeta.updatedAt,
      riderCount: validation.metadata.riderCount,
      hasGC: validation.metadata.hasGC,
      hasPointsClassification: validation.metadata.hasPointsClassification,
      hasMountainsClassification: validation.metadata.hasMountainsClassification,
      hasYouthClassification: validation.metadata.hasYouthClassification,
      hasTeamClassification: validation.metadata.hasTeamClassification,
      validation: {
        valid: validation.valid,
        errors: validation.errors.map(e => ({ field: e.field, message: e.message })),
        warnings: validation.warnings.map(w => ({ field: w.field, message: w.message })),
      },
      backups,
      sampleRiders,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching stage status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stage status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/stage-status - Trigger scrape for a stage
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, race, year, stage, type = 'stage' } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!race || !year) {
      return NextResponse.json(
        { error: 'Race and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const userData = userDoc.data();

    // Determine the correct scraper type
    // Handle special stage numbers like 'prologue', 'gc', 'result'
    let scraperType = type;
    let scraperStage = stage;

    if (stage === 'prologue') {
      scraperType = 'stage';
      scraperStage = 0;
    } else if (stage === 'gc') {
      scraperType = 'tour-gc';
      scraperStage = undefined;
    } else if (stage === 'result') {
      scraperType = 'result';
      scraperStage = undefined;
    }

    // Build scraper request body, excluding undefined values
    const scraperBody: Record<string, unknown> = {
      race,
      year: Number(year),
      type: scraperType,
      userId,
    };

    // Only add optional fields if they have values
    if (scraperStage !== undefined) {
      scraperBody.stage = scraperStage;
    }
    if (userData?.email) {
      scraperBody.userEmail = userData.email;
    }
    if (userData?.displayName) {
      scraperBody.userName = userData.displayName;
    }

    // Call the actual scraper API
    const scraperResponse = await fetch(`${request.nextUrl.origin}/api/scraper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scraperBody),
    });

    const scraperResult = await scraperResponse.json();

    if (!scraperResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: scraperResult.error || 'Scrape failed',
          details: scraperResult.details,
        },
        { status: scraperResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully scraped ${race} ${year} ${type === 'stage' ? `stage ${stage}` : stage || type}`,
      dataCount: scraperResult.dataCount,
      executionTimeMs: scraperResult.executionTimeMs,
    });
  } catch (error) {
    console.error('Error triggering scrape:', error);
    return NextResponse.json(
      { error: 'Failed to trigger scrape', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
