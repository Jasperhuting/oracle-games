import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { type ScraperDataKey } from '@/lib/firebase/scraper-service';
import { shouldExcludeRace } from '@/lib/utils/race-filters';
import type { StageStatus, RaceStatus, RaceStatusResponse } from '@/lib/types/race-status';

/**
 * Infer stage count from start/end date range.
 * Returns null when dates are missing, equal (single-day), or invalid.
 */
function stagesFromDateRange(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const [sy, sm, sd] = start.substring(0, 10).split('-').map(Number);
  const [ey, em, ed] = end.substring(0, 10).split('-').map(Number);
  const diff = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000);
  return diff > 0 ? diff + 1 : null;
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

    // Calculate date cutoff from query param, default to today + 14 days
    const maxDateParam = searchParams.get('maxDate');
    const maxDate = maxDateParam ? new Date(maxDateParam) : new Date();
    if (!maxDateParam) {
      maxDate.setDate(maxDate.getDate() + 7);
    }
    maxDate.setHours(23, 59, 59, 999);

    // Get race configurations for stage counts - filter by year
    const racesSnapshot = await db.collection('races').where('year', '==', year).get();
    const raceConfigs = new Map<string, {
      name: string;
      totalStages: number;
      isSingleDay: boolean;
      hasPrologue: boolean;
      startDate: string | null;
      endDate: string | null;
      classification: string | null;
      excludeFromScraping: boolean;
      restDays: string[];
    }>();

    racesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || doc.id;
      const classification = data.classification || null;

      // Skip races with excluded classifications or patterns in name
      const name = data.name || slug;
      const excludeFromScraping = data.excludeFromScraping === true;
      if (shouldExcludeRace(name, classification, slug, excludeFromScraping)) {
        return;
      }

      // Skip races that start after the date cutoff (today + 7 days)
      const startDate = data.startDate || null;
      if (startDate) {
        const raceStart = new Date(startDate);
        if (raceStart > maxDate) {
          return;
        }
      }

      const hasPrologue = data.hasPrologue ?? false;
      // restDays is stored as string[] of ISO date strings (e.g. ["2026-04-30"]).
      // Backward compat: plain number → treat as count with unknown dates → empty array.
      const rawRestDays = data.restDays;
      const restDays: string[] = Array.isArray(rawRestDays)
        ? rawRestDays.filter((d: unknown) => typeof d === 'string')
        : [];
      // Dates are authoritative: if there is no end date or start === end, it is always
      // a single-day race regardless of any stored isSingleDay value.
      const datesConfirmSingleDay = !data.endDate || data.startDate === data.endDate;
      const isSingleDay = datesConfirmSingleDay || (data.isSingleDay ?? false);
      const endDate: string | null = data.endDate || null;

      // Infer totalStages from date range if not set in Firestore:
      // subtract rest days and prologue day so only numbered stages remain
      const inferredStages = stagesFromDateRange(startDate, endDate);
      const totalStagesFromRange = inferredStages !== null
        ? Math.max(1, inferredStages - (hasPrologue ? 1 : 0) - restDays.length)
        : null;

      raceConfigs.set(slug, {
        name: data.name || slug,
        totalStages: data.totalStages ?? data.stages ?? totalStagesFromRange ?? 1,
        isSingleDay,
        hasPrologue,
        startDate,
        endDate,
        classification,
        excludeFromScraping,
        restDays,
      });
    });

    // Build set of relevant race slugs for filtering scraper data
    const relevantRaceSlugs = new Set(raceConfigs.keys());

    // Get all scraper data documents (single fetch for both listing and validation)
    const scraperDataSnapshot = await db.collection('scraper-data').get();

    // Build raceMap and validationMap from a single fetch
    const raceMap = new Map<string, {
      key: ScraperDataKey;
      updatedAt: string;
      id: string;
    }[]>();
    const hasResultsFromData = (data: any): boolean => {
      const stageResults = data?.stageResults;
      const gcResults = data?.generalClassification;

      const checkArray = (arr: any[]): boolean => {
        return arr.some((r) => {
          if (!r) return false;
          if (Array.isArray((r as any).riders)) {
            return typeof r.place === 'number' && r.place > 0;
          }
          return typeof r.place === 'number' && r.place > 0;
        });
      };

      if (Array.isArray(stageResults)) {
        return checkArray(stageResults);
      }
      if (typeof stageResults === 'string') {
        try {
          const parsed = JSON.parse(stageResults);
          if (Array.isArray(parsed)) return checkArray(parsed);
        } catch {
          // ignore
        }
      }

      if (Array.isArray(gcResults)) {
        return checkArray(gcResults);
      }
      if (typeof gcResults === 'string') {
        try {
          const parsed = JSON.parse(gcResults);
          if (Array.isArray(parsed)) return checkArray(parsed);
        } catch {
          // ignore
        }
      }

      return false;
    };

    const validationMap = new Map<string, {
      valid: boolean;
      errorCount: number;
      warningCount: number;
      riderCount: number;
      hasResults: boolean;
    }>();

    scraperDataSnapshot.docs.forEach(doc => {
      const data = doc.data();

      // Build validation map for all docs
      if (data._validation) {
        const riderCount = data._validation.metadata?.riderCount ?? data.count ?? 0;
        const hasResults = data._validation.metadata?.hasResults ?? hasResultsFromData(data) ?? (riderCount > 0);
        validationMap.set(doc.id, {
          valid: data._validation.valid ?? true,
          errorCount: data._validation.errorCount ?? 0,
          warningCount: data._validation.warningCount ?? 0,
          riderCount,
          hasResults,
        });
      } else {
        const riderCount = data.count ?? 0;
        const hasResults = hasResultsFromData(data) ?? (riderCount > 0);
        validationMap.set(doc.id, {
          valid: true,
          errorCount: 0,
          warningCount: 0,
          riderCount,
          hasResults,
        });
      }

      // Build race map (only for relevant races in the right year)
      const key = data.key as ScraperDataKey | undefined;
      if (!key || key.year !== year) return;
      const raceSlug = key.race;
      if (raceFilter && raceSlug !== raceFilter) return;
      if (!relevantRaceSlugs.has(raceSlug)) return;

      if (!raceMap.has(raceSlug)) {
        raceMap.set(raceSlug, []);
      }
      raceMap.get(raceSlug)!.push({
        key,
        updatedAt: data.updatedAt as string,
        id: doc.id,
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

    // Get stage dates only for relevant races (reuse racesSnapshot instead of fetching all races)
    const stageDatesMap = new Map<string, Map<number | string, string>>();

    const normalizeDate = (value: unknown): string | null => {
      if (!value) return null;
      if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
      }
      if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        const parsed = (value as { toDate: () => Date }).toDate();
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }
      return null;
    };

    for (const raceDoc of racesSnapshot.docs) {
      const raceSlug = raceDoc.data().slug || raceDoc.id;
      // Only fetch stage subcollections for relevant races
      if (!relevantRaceSlugs.has(raceSlug)) continue;
      const stagesSnapshot = await raceDoc.ref.collection('stages').get();
      const stageMap = new Map<number | string, string>();
      
      stagesSnapshot.forEach((stageDoc) => {
        const stageData = stageDoc.data();
        const stageNum = stageData.stage;
        const stageDate = normalizeDate(
          stageData.date ??
          stageData.stageDate ??
          stageData.raceDate ??
          stageData.startDate ??
          stageData.day ??
          stageData.scrapedAt
        );
        
        if (stageDate && stageNum !== undefined && stageNum !== null) {
          stageMap.set(stageNum, stageDate);
        }
      });
      
      stageDatesMap.set(raceSlug, stageMap);
    }

    const getStageDate = (raceSlug: string, stageNumber: number | string): string | null => {
      const raceStageDates = stageDatesMap.get(raceSlug);
      let stageDate =
        raceStageDates?.get(stageNumber) ||
        (stageNumber === 'prologue' ? raceStageDates?.get(0) : null) ||
        null;

      const raceConfig = raceConfigs.get(raceSlug);
      const startDate = normalizeDate(raceConfig?.startDate || null);
      const endDate = normalizeDate(raceConfig?.endDate || null);

      if (!stageDate) {
        if (stageNumber === 'result') {
          stageDate = endDate || startDate;
        } else if (stageNumber === 'gc') {
          stageDate = endDate || startDate;
        } else if (stageNumber === 'prologue') {
          stageDate = startDate;
        } else if (typeof stageNumber === 'number' && startDate) {
          const base = new Date(startDate);
          if (!Number.isNaN(base.getTime())) {
            // Without prologue Stage 1 = startDate (offset 0); with prologue Stage 1 = startDate+1.
            const hasPrologue = raceConfig?.hasPrologue ?? false;
            const restDayDates = new Set((raceConfig?.restDays ?? []).map(d => d.substring(0, 10)));
            // Base offset ignoring rest days.
            const baseOffset = hasPrologue ? stageNumber : stageNumber - 1;
            // Count rest day dates that fall strictly before startDate+baseOffset; each
            // one pushes all subsequent stages one calendar day later.
            const baseDate = new Date(startDate);
            baseDate.setDate(baseDate.getDate() + baseOffset);
            const baseDateStr = baseDate.toISOString().substring(0, 10);
            let restDaysBefore = 0;
            for (const rd of restDayDates) {
              if (rd < baseDateStr) restDaysBefore++;
            }
            base.setDate(base.getDate() + Math.max(0, baseOffset + restDaysBefore));
            stageDate = base.toISOString();
          }
        }
      }

      return stageDate;
    };

    // Build race status list
    const races: RaceStatus[] = [];
    let totalStagesScraped = 0;
    let totalStagesFailed = 0;
    let totalValidationErrors = 0;

    raceMap.forEach((docs, raceSlug) => {
      const raceConfig = raceConfigs.get(raceSlug);

      // Skip races that are not in raceConfigs (they were filtered out due to excluded classification)
      // Only show races that have a valid config (ME classification or no classification)
      if (!raceConfig) {
        return;
      }

      // Detect if this is a single-day race based on:
      // 1. Database config (isSingleDay flag)
      // 2. Known single-day race list/patterns
      // 3. Document types (has 'result' but no 'stage' documents)
      const hasResultDoc = docs.some(d => d.key.type === 'result');
      const hasStageDocs = docs.some(d => d.key.type === 'stage');
      const isSingleDay = raceConfig?.isSingleDay ||
        (hasResultDoc && !hasStageDocs);

      // Check if race has a prologue (stage 0)
      // Either from scraped data or from the Firestore config field
      const hasPrologueScrapedData = docs.some(d => d.key.type === 'stage' && d.key.stage === 0);
      const hasPrologue = hasPrologueScrapedData || (raceConfig?.hasPrologue ?? false);

      // Determine total stages (numbered stages only, not including prologue)
      let numberedStages: number;
      if (isSingleDay) {
        numberedStages = 1;
      } else if (raceConfig?.totalStages && raceConfig.totalStages > 1) {
        numberedStages = raceConfig.totalStages;
      } else {
        // Infer from scraped stages as last resort
        const maxStage = Math.max(
          ...docs
            .filter(d => d.key.type === 'stage' && typeof d.key.stage === 'number')
            .map(d => d.key.stage as number),
          0,
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
      let emptyStages = 0;
      let lastScrapedAt: string | null = null;
      let hasValidationErrors = false;

      // Process existing stage documents
      stageDocs.forEach(doc => {
        const validation = validationMap.get(doc.id);
        const riderCount = validation?.riderCount ?? 0;
        const hasResults = validation?.hasResults ?? (riderCount > 0);
        const isFailed = !!(validation && !validation.valid);
        const isEmpty = !hasResults;

        // GC (tour-gc) is supplementary data, not a race stage - don't count it
        const isSupplementary = doc.key.type === 'tour-gc';

        if (!isSupplementary) {
          if (isFailed) {
            failedStages++;
            totalStagesFailed++;
          } else {
            // Both scraped-with-data and scraped-empty count as "done"
            scrapedStages++;
            totalStagesScraped++;
            if (isEmpty) emptyStages++;
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

        // Get stage date from the stage dates map
        const stageDate = getStageDate(raceSlug, stageNumber);

        const stageStatus: StageStatus['status'] = isFailed
          ? 'failed'
          : isEmpty
            ? 'empty'
            : 'scraped';

        stages.push({
          stageNumber,
          status: stageStatus,
          scrapedAt: doc.updatedAt,
          riderCount,
          hasValidationErrors: validation ? !validation.valid : false,
          validationWarnings: validation?.warningCount ?? 0,
          docId: doc.id,
          stageDate,
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
          // For single-day race, try to get stage date from stage dates map
          const stageDate = getStageDate(raceSlug, 'result');

          stages.push({
            stageNumber: 'result',
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
            stageDate,
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
          // Get prologue stage date from stage dates map
          const stageDate = getStageDate(raceSlug, 'prologue');

          stages.push({
            stageNumber: 'prologue',
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
            stageDate,
          });
        }

        // Add pending numbered stages (1 to numberedStages, not including prologue)
        for (let i = 1; i <= numberedStages; i++) {
          if (!scrapedStageNumbers.has(i)) {
            // Get stage date from stage dates map
            const stageDate = getStageDate(raceSlug, i);

            stages.push({
              stageNumber: i,
              status: 'pending',
              scrapedAt: null,
              riderCount: 0,
              hasValidationErrors: false,
              validationWarnings: 0,
              docId: '',
              stageDate,
            });
          }
        }

        // Add pending General Classification if not already scraped
        const hasGCScraped = stages.some(s => s.stageNumber === 'gc');
        if (!hasGCScraped) {
          // GC doesn't have a specific stage date, it's usually after the last stage
          const stageDate = getStageDate(raceSlug, 'gc');

          stages.push({
            stageNumber: 'gc',
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
            stageDate,
          });
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
        excludeFromScraping: raceConfig?.excludeFromScraping ?? false,
        restDays: raceConfig?.restDays ?? [] as string[],
      });
    });

    // Track which races already have scraper data
    const racesWithScraperData = new Set(races.map(r => r.raceSlug));

    // Add races from the database that don't have any scraper data yet
    raceConfigs.forEach((config, raceSlug) => {
      if (racesWithScraperData.has(raceSlug)) return;
      if (raceFilter && raceSlug !== raceFilter) return;

      const isSingleDay = config.isSingleDay;
      const hasPrologue = config.hasPrologue;

      // Determine total stages
      let numberedStages: number;
      if (isSingleDay) {
        numberedStages = 1;
      } else if (config.totalStages > 1) {
        numberedStages = config.totalStages;
      } else {
        // Fall back to date range inference when totalStages is not configured
        const dateRange = stagesFromDateRange(config.startDate, config.endDate);
        numberedStages = dateRange !== null
          ? Math.max(1, dateRange - (hasPrologue ? 1 : 0) - config.restDays.length)
          : 1;
      }

      const totalStages = hasPrologue ? numberedStages + 1 : numberedStages;

      // Build pending stages
      const stages: StageStatus[] = [];

      if (isSingleDay) {
        // Get stage date from stage dates map
        const stageDate = getStageDate(raceSlug, 'result');

        stages.push({
          stageNumber: 'result',
          status: 'pending',
          scrapedAt: null,
          riderCount: 0,
          hasValidationErrors: false,
          validationWarnings: 0,
          docId: '',
          stageDate,
        });
      } else {
        // Add prologue if race has one
        if (hasPrologue) {
          // Get prologue stage date from stage dates map
          const stageDate = getStageDate(raceSlug, 'prologue');

          stages.push({
            stageNumber: 'prologue',
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
            stageDate,
          });
        }

        // Add numbered stages
        for (let i = 1; i <= numberedStages; i++) {
          // Get stage date from stage dates map
          const stageDate = getStageDate(raceSlug, i);

          stages.push({
            stageNumber: i,
            status: 'pending',
            scrapedAt: null,
            riderCount: 0,
            hasValidationErrors: false,
            validationWarnings: 0,
            docId: '',
            stageDate,
          });
        }

        // Add pending General Classification for multi-stage races
        // GC doesn't have a specific stage date, it's usually after the last stage
        const stageDate = getStageDate(raceSlug, 'gc');

        stages.push({
          stageNumber: 'gc',
          status: 'pending',
          scrapedAt: null,
          riderCount: 0,
          hasValidationErrors: false,
          validationWarnings: 0,
          docId: '',
          stageDate,
        });
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
        excludeFromScraping: config.excludeFromScraping,
        restDays: config.restDays,
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
