import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { listScraperData, type ScraperDataKey } from '@/lib/firebase/scraper-service';

export interface StageStatus {
  stageNumber: number | string;
  status: 'scraped' | 'pending' | 'failed';
  scrapedAt: string | null;
  riderCount: number;
  hasValidationErrors: boolean;
  validationWarnings: number;
  docId: string;
}

export interface RaceStatus {
  raceSlug: string;
  raceName: string;
  year: number;
  totalStages: number;
  scrapedStages: number;
  failedStages: number;
  pendingStages: number;
  hasStartlist: boolean;
  startlistRiderCount: number;
  lastScrapedAt: string | null;
  hasValidationErrors: boolean;
  isSingleDay: boolean;
  hasPrologue: boolean;
  stages: StageStatus[];
  // Calendar info
  startDate: string | null;
  endDate: string | null;
  raceStatus: 'upcoming' | 'in-progress' | 'finished' | 'unknown';
  classification: string | null;
}

export interface RaceStatusResponse {
  races: RaceStatus[];
  summary: {
    totalRaces: number;
    racesWithData: number;
    totalStagesScraped: number;
    totalStagesFailed: number;
    validationErrors: number;
  };
}

// Known race stage counts (fallback if not in database)
// Note: This is the number of regular stages, NOT including prologue
const KNOWN_RACE_STAGES: Record<string, number> = {
  // Grand Tours
  'tour-de-france': 21,
  'giro-d-italia': 21,
  'vuelta-a-espana': 21,
  // Major stage races
  'tour-down-under': 5, // Has prologue + 5 stages
  'paris-nice': 8,
  'tirreno-adriatico': 7,
  'volta-a-catalunya': 7,
  'dauphine': 8,
  'tour-de-suisse': 8,
  'vuelta-al-tachira': 10,
  'tour-de-romandie': 5, // Typically has prologue + 5 stages
  'tour-of-the-alps': 5,
  'itzulia-basque-country': 6,
  'tour-of-oman': 6,
  'uae-tour': 7,
  'tour-of-california': 7,
  'tour-of-turkey': 8,
  'tour-de-langkawi': 8,
  'tour-of-guangxi': 6,
  'tour-of-britain': 8,
};

// Races that typically have a prologue
const RACES_WITH_PROLOGUE: Set<string> = new Set([
  'tour-down-under',
  'tour-de-romandie',
  'tour-de-suisse',
  // Grand tours sometimes have prologues
]);

// Known single-day races (common one-day classics and championships)
const KNOWN_SINGLE_DAY_PATTERNS: string[] = [
  // National Championships patterns
  'nc-',
  'national-championships',
  // Time Trials
  '-itt',
  '-time-trial',
];

const KNOWN_SINGLE_DAY_RACES: Set<string> = new Set([
  // Monuments
  'milano-sanremo',
  'ronde-van-vlaanderen',
  'paris-roubaix',
  'liege-bastogne-liege',
  'il-lombardia',
  // World Tour one-day races
  'amstel-gold-race',
  'la-fleche-wallone',
  'strade-bianche',
  'e3-harelbeke',
  'gent-wevelgem',
  'san-sebastian',
  'bretagne-classic',
  'cyclassics-hamburg',
  'gp-quebec',
  'gp-montreal',
  'omloop-het-nieuwsblad',
  'kuurne-brussel-kuurne',
  'dwars-door-vlaanderen',
  'eschborn-frankfurt',
  // World Championships
  'world-championship',
  'world-championship-itt',
  'world-championship-me',
]);

/**
 * Check if a race slug indicates a single-day race
 */
function isSingleDayRaceBySlug(slug: string): boolean {
  // Check exact matches
  if (KNOWN_SINGLE_DAY_RACES.has(slug)) {
    return true;
  }
  // Check patterns
  return KNOWN_SINGLE_DAY_PATTERNS.some(pattern => slug.includes(pattern));
}

// GET /api/admin/race-status - Get scrape status for all races
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);
    const raceFilter = searchParams.get('race'); // Optional: filter to specific race

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
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

    // Get all scraper data documents
    const allScraperData = await listScraperData();

    // Filter by year
    const yearData = allScraperData.filter(d => d.key?.year === year);

    // Group by race
    const raceMap = new Map<string, {
      key: ScraperDataKey;
      updatedAt: string;
      id: string;
    }[]>();

    yearData.forEach(doc => {
      if (!doc.key) return;
      const raceSlug = doc.key.race;

      if (raceFilter && raceSlug !== raceFilter) return;

      if (!raceMap.has(raceSlug)) {
        raceMap.set(raceSlug, []);
      }
      raceMap.get(raceSlug)!.push(doc);
    });

    // Get validation metadata for each document
    const scraperDataSnapshot = await db.collection('scraper-data').get();
    const validationMap = new Map<string, {
      valid: boolean;
      errorCount: number;
      warningCount: number;
      riderCount: number;
    }>();

    scraperDataSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data._validation) {
        validationMap.set(doc.id, {
          valid: data._validation.valid ?? true,
          errorCount: data._validation.errorCount ?? 0,
          warningCount: data._validation.warningCount ?? 0,
          riderCount: data._validation.metadata?.riderCount ?? data.count ?? 0,
        });
      } else {
        // For documents without validation metadata, use count
        validationMap.set(doc.id, {
          valid: true,
          errorCount: 0,
          warningCount: 0,
          riderCount: data.count ?? 0,
        });
      }
    });

    // Get race configurations for stage counts - filter by year
    const racesSnapshot = await db.collection('races').where('year', '==', year).get();
    const raceConfigs = new Map<string, {
      name: string;
      totalStages: number;
      isSingleDay: boolean;
      startDate: string | null;
      endDate: string | null;
      classification: string | null;
    }>();

    racesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || doc.id;
      raceConfigs.set(slug, {
        name: data.name || slug,
        totalStages: data.totalStages || data.stages || 1,
        isSingleDay: data.isSingleDay ?? false,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        classification: data.classification || null,
      });
    });

    // Helper to determine race status based on dates
    const getRaceStatus = (startDate: string | null, endDate: string | null): 'upcoming' | 'in-progress' | 'finished' | 'unknown' => {
      if (!startDate) return 'unknown';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(endDate) : start;
      end.setHours(23, 59, 59, 999);

      if (today < start) return 'upcoming';
      if (today > end) return 'finished';
      return 'in-progress';
    };

    // Build race status list
    const races: RaceStatus[] = [];
    let totalStagesScraped = 0;
    let totalStagesFailed = 0;
    let totalValidationErrors = 0;

    raceMap.forEach((docs, raceSlug) => {
      const raceConfig = raceConfigs.get(raceSlug);

      // Detect if this is a single-day race based on:
      // 1. Database config (isSingleDay flag)
      // 2. Known single-day race list/patterns
      // 3. Document types (has 'result' but no 'stage' documents)
      const hasResultDoc = docs.some(d => d.key.type === 'result');
      const hasStageDocs = docs.some(d => d.key.type === 'stage');
      const isSingleDay = raceConfig?.isSingleDay ||
        isSingleDayRaceBySlug(raceSlug) ||
        (hasResultDoc && !hasStageDocs);

      // Check if race has a prologue (stage 0)
      // Either from scraped data or from known races with prologues
      const hasPrologueScrapedData = docs.some(d => d.key.type === 'stage' && d.key.stage === 0);
      const hasPrologue = hasPrologueScrapedData || RACES_WITH_PROLOGUE.has(raceSlug);

      // Determine total stages (numbered stages only, not including prologue)
      let numberedStages: number;
      if (isSingleDay) {
        numberedStages = 1;
      } else if (raceConfig?.totalStages && raceConfig.totalStages > 1) {
        numberedStages = raceConfig.totalStages;
      } else if (KNOWN_RACE_STAGES[raceSlug]) {
        numberedStages = KNOWN_RACE_STAGES[raceSlug];
      } else {
        // Try to infer from scraped stages
        const maxStage = Math.max(
          ...docs
            .filter(d => d.key.type === 'stage' && typeof d.key.stage === 'number')
            .map(d => d.key.stage as number),
          0
        );
        numberedStages = maxStage > 0 ? maxStage : 1;
      }

      // Total stages includes prologue if present
      const totalStages = hasPrologue ? numberedStages + 1 : numberedStages;

      // Find startlist
      const startlistDoc = docs.find(d => d.key.type === 'startlist');
      const hasStartlist = !!startlistDoc;
      const startlistValidation = startlistDoc ? validationMap.get(startlistDoc.id) : null;

      // Find stages
      const stageDocs = docs.filter(d => d.key.type === 'stage' || d.key.type === 'result' || d.key.type === 'tour-gc');

      // Build stage status
      const stages: StageStatus[] = [];
      let scrapedStages = 0;
      let failedStages = 0;
      let lastScrapedAt: string | null = null;
      let hasValidationErrors = false;

      // Process existing stage documents
      stageDocs.forEach(doc => {
        const validation = validationMap.get(doc.id);
        const riderCount = validation?.riderCount ?? 0;
        const isFailed = riderCount === 0 || (validation && !validation.valid);

        // GC (tour-gc) is supplementary data, not a race stage - don't count it
        const isSupplementary = doc.key.type === 'tour-gc';

        if (!isSupplementary) {
          if (isFailed) {
            failedStages++;
            totalStagesFailed++;
          } else {
            scrapedStages++;
            totalStagesScraped++;
          }
        }

        if (validation && !validation.valid) {
          hasValidationErrors = true;
          totalValidationErrors++;
        }

        if (!lastScrapedAt || doc.updatedAt > lastScrapedAt) {
          lastScrapedAt = doc.updatedAt;
        }

        // Determine stage number/label
        // Stage 0 = Prologue, result = single-day result, tour-gc = GC
        let stageNumber: number | string;
        if (doc.key.type === 'result') {
          stageNumber = 'result';
        } else if (doc.key.type === 'tour-gc') {
          stageNumber = 'gc';
        } else if (doc.key.stage === 0) {
          stageNumber = 'prologue';
        } else {
          stageNumber = doc.key.stage ?? 0;
        }

        stages.push({
          stageNumber,
          status: isFailed ? 'failed' : 'scraped',
          scrapedAt: doc.updatedAt,
          riderCount,
          hasValidationErrors: validation ? !validation.valid : false,
          validationWarnings: validation?.warningCount ?? 0,
          docId: doc.id,
        });
      });

      // Sort stages: prologue first, then numbered stages, then special types (gc, result) last
      const stageOrder = (s: StageStatus): number => {
        if (s.stageNumber === 'prologue') return -1;
        if (typeof s.stageNumber === 'number') return s.stageNumber;
        if (s.stageNumber === 'gc') return 1000;
        if (s.stageNumber === 'result') return 1001;
        return 999;
      };

      stages.sort((a, b) => stageOrder(a) - stageOrder(b));

      // Calculate pending stages (stages not yet scraped)
      // For single-day races, check if we have the 'result' entry
      // For multi-stage races, check for numbered stages

      if (isSingleDay) {
        // Single-day race: check if 'result' is scraped
        const hasResult = stages.some(s => s.stageNumber === 'result');
        if (!hasResult && stages.length === 0) {
          stages.push({
            stageNumber: 'result',
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
          });
        }
      } else {
        // Multi-stage race: add pending for missing stage numbers
        const scrapedStageNumbers = new Set(
          stages
            .filter(s => typeof s.stageNumber === 'number')
            .map(s => s.stageNumber as number)
        );
        const hasPrologueScraped = stages.some(s => s.stageNumber === 'prologue');

        // Add pending prologue if the race has one but it's not scraped
        // We detect this from the race config or if other races of same type typically have prologues
        if (hasPrologue && !hasPrologueScraped) {
          stages.push({
            stageNumber: 'prologue',
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
          });
        }

        // Add pending numbered stages (1 to numberedStages, not including prologue)
        for (let i = 1; i <= numberedStages; i++) {
          if (!scrapedStageNumbers.has(i)) {
            stages.push({
              stageNumber: i,
              status: 'pending',
              scrapedAt: null,
              riderCount: 0,
              hasValidationErrors: false,
              validationWarnings: 0,
              docId: '',
            });
          }
        }
      }

      // Re-sort after adding pending (using same sorting logic)
      stages.sort((a, b) => stageOrder(a) - stageOrder(b));

      // Deduplicate stages (keep the first one of each stageNumber)
      // This handles cases where there might be duplicate GC documents etc.
      const seenStageNumbers = new Set<string | number>();
      const deduplicatedStages = stages.filter(stage => {
        const key = stage.stageNumber;
        if (seenStageNumbers.has(key)) {
          return false;
        }
        seenStageNumbers.add(key);
        return true;
      });

      // Replace stages array with deduplicated version
      stages.length = 0;
      stages.push(...deduplicatedStages);

      const pendingStages = totalStages - scrapedStages - failedStages;

      races.push({
        raceSlug,
        raceName: raceConfig?.name || raceSlug,
        year,
        totalStages,
        scrapedStages,
        failedStages,
        pendingStages: Math.max(0, pendingStages),
        hasStartlist,
        startlistRiderCount: startlistValidation?.riderCount ?? 0,
        lastScrapedAt,
        hasValidationErrors,
        isSingleDay,
        hasPrologue,
        stages,
        startDate: raceConfig?.startDate || null,
        endDate: raceConfig?.endDate || null,
        raceStatus: getRaceStatus(raceConfig?.startDate || null, raceConfig?.endDate || null),
        classification: raceConfig?.classification || null,
      });
    });

    // Track which races already have scraper data
    const racesWithScraperData = new Set(races.map(r => r.raceSlug));

    // Add races from the database that don't have any scraper data yet
    raceConfigs.forEach((config, raceSlug) => {
      if (racesWithScraperData.has(raceSlug)) return;
      if (raceFilter && raceSlug !== raceFilter) return;

      const isSingleDay = config.isSingleDay || isSingleDayRaceBySlug(raceSlug);
      const hasPrologue = RACES_WITH_PROLOGUE.has(raceSlug);

      // Determine total stages
      let numberedStages: number;
      if (isSingleDay) {
        numberedStages = 1;
      } else if (config.totalStages > 1) {
        numberedStages = config.totalStages;
      } else if (KNOWN_RACE_STAGES[raceSlug]) {
        numberedStages = KNOWN_RACE_STAGES[raceSlug];
      } else {
        numberedStages = 1;
      }

      const totalStages = hasPrologue ? numberedStages + 1 : numberedStages;

      // Build pending stages
      const stages: StageStatus[] = [];

      if (isSingleDay) {
        stages.push({
          stageNumber: 'result',
          status: 'pending',
          scrapedAt: null,
          riderCount: 0,
          hasValidationErrors: false,
          validationWarnings: 0,
          docId: '',
        });
      } else {
        // Add prologue if race has one
        if (hasPrologue) {
          stages.push({
            stageNumber: 'prologue',
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
          });
        }

        // Add numbered stages
        for (let i = 1; i <= numberedStages; i++) {
          stages.push({
            stageNumber: i,
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
          });
        }
      }

      races.push({
        raceSlug,
        raceName: config.name,
        year,
        totalStages,
        scrapedStages: 0,
        failedStages: 0,
        pendingStages: totalStages,
        hasStartlist: false,
        startlistRiderCount: 0,
        lastScrapedAt: null,
        hasValidationErrors: false,
        isSingleDay,
        hasPrologue,
        stages,
        startDate: config.startDate,
        endDate: config.endDate,
        raceStatus: getRaceStatus(config.startDate, config.endDate),
        classification: config.classification,
      });
    });

    // Sort races by start date (upcoming/in-progress first), then by name
    races.sort((a, b) => {
      // Priority: in-progress > upcoming > finished > unknown
      const statusOrder = { 'in-progress': 0, 'upcoming': 1, 'finished': 2, 'unknown': 3 };
      const statusDiff = statusOrder[a.raceStatus] - statusOrder[b.raceStatus];
      if (statusDiff !== 0) return statusDiff;

      // Within same status, sort by start date
      if (a.startDate && b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }

      // Fallback to name
      return a.raceName.localeCompare(b.raceName);
    });

    const response: RaceStatusResponse = {
      races,
      summary: {
        totalRaces: races.length,
        racesWithData: races.filter(r => r.scrapedStages > 0 || r.hasStartlist).length,
        totalStagesScraped,
        totalStagesFailed,
        validationErrors: totalValidationErrors,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching race status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch race status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
