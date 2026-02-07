import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { listScraperData, type ScraperDataKey } from '@/lib/firebase/scraper-service';

export interface StageStatus {
  stageNumber: number | string;
  status: 'scraped' | 'pending' | 'failed' | 'empty';
  scrapedAt: string | null;
  riderCount: number;
  hasValidationErrors: boolean;
  validationWarnings: number;
  docId: string;
  stageDate: string | null; // Date when the stage was actually raced
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
  // Grand Tours (2.UWT)
  'tour-de-france': 21, // Checked
  'giro-d-italia': 21, // Checked
  'vuelta-a-espana': 21, // Checked
  
  // WorldTour stage races (2.UWT)
  'paris-nice': 8, // Checked
  'tirreno-adriatico': 7, // Checked
  'volta-a-catalunya': 7, // Checked
  'dauphine': 8, // Checked
  'tour-de-suisse': 8, // Checked
  'tour-de-pologne': 7, // Checked
  'renewi-tour': 5, // Checked
  'deutschland-tour': 4, // Checked
  
  // 2.Pro races (Second tier professional stage races)
  'tour-down-under': 6, // Checked
  'tour-de-romandie': 5, // Checked
  'tour-of-the-alps': 5, // Checked
  'itzulia-basque-country': 6, // Checked
  'tour-of-oman': 5, // Checked
  'uae-tour': 7, // Checked
  'arctic-race-of-norway': 4, // Checked
  'czech-tour': 4, // Checked
  'alula-tour': 5, // Checked
  '4-jours-de-dunkerque': 5, // Checked
  
  // Other stage races
  'dookola-mazowsza': 4, // Checked
  'kreiz-breizh-elites': 3, // Checked
  'acht-van-bladel2': 3, // Checked
  'anna-vasa-race': 3, // Checked
  'course-cycliste-de-solidarnosc': 4, // Checked
  'course-de-la-paix-u23': 4, // Checked
  'cote-d-or-classic-juniors': 2, // Checked
  'istrian-spring-tour': 3, // Checked
  'trofej-umag': 1, // Checked
  'tour-of-albania': 5, // Checked
  'tour-of-turkey': 8, // Checked
  'tour-de-langkawi': 8, // Checked
  'tour-of-guangxi': 6, // Checked
  'tour-of-britain': 6, // Checked
  'volta-a-portugal-em-bicicleta': 11, // To be checked
  'tour-of-norway': 4, // Checked
  'tour-of-austria': 5, // Checked
  'tour-of-denmark': 5, // Checked
  'tour-of-slovenia': 5, // Checked
  'tour-of-sweden': 3, // To be checked
  'tour-of-belgium': 5,
  'vuelta-a-andalucia-ruta-ciclista-del-sol': 5,
  'région-pays-de-la-loire-tour': 4,
  'tour-of-hainan': 5, // Checked
  'presidential-cycling-tour-of-turkiye': 8,
  'tour-de-hongrie': 5, // Checked
  'boucles-de-la-mayenne-crédit-mutuel': 3, // Checked
  'ethias-tour-de-wallonie': 5, // Checked
  'baloise-belgium-tour': 5,
  'vuelta-al-tachira': 10, // Checked
  'pune-grand-tour': 4,
  'tour-of-sharjah': 5, // Checked
  'tour-de-taiwan': 5, // Checked
  'the-princess-maha-chakri-sirindhorns-cup-tour-of-thailand': 6, // Checked
  'bakukhankendi-azerbaijan-cycling-race': 5,
  'flèche-du-sud': 5, // Checked
  'grande-prémio-internacional-beiras-e-serra-da-estrela': 3, // Checked
  'la-route-doccitanie-cic': 4, // Checked
  'lyon-torino': 1,
  'tpc-en-nouvelle-aquitaine': 1,
  'tour-of-istanbul': 3, // Checked
  'il-giro-dabruzzo': 4, // Checked
  'tour-of-holland': 5, // Checked
  'jamaica-international-cycling-classic': 3, // Checked
  'tour-dalgérie': 10, // Checked
  'tour-du-bénin': 6, // Checked
  'tour-de-maurice': 7,
  'tour-du-cameroun': 5,
  'grand-prix-chantal-biya': 1,
  'tour-of-antalya': 4,
  'tour-of-rhodes-powered-by-rodos-palace': 3,
  'metec-olympias-tour': 4,
  'volta-ao-alentejo': 3,
  'circuit-des-ardennes': 3,
  'ronde-de-loise': 5,
  'tour-of-malopolska': 3,
  'tour-szlakiem-mazurskich-twierdz': 3,
  'course-cycliste-de-solidarnosc-et-des-champions-olympiques': 5,
  'gp-internacional-torres-vedras-trofeu-joaquim-agostinho': 2,
  'tour-alsace': 5,
  'tour-of-kosovo': 3,
  'tour-of-bulgaria': 5,
  'tour-of-romania': 5,
  'tour-darménie': 4,
  'tour-de-serbie': 4,
  'tour-of-germany': 4,
  'tour-of-switzerland': 8,
  'tour-of-france': 21,
  'tour-of-spain': 21,
  'tour-of-italy': 21,
  'giro-del-friuli-venezia-giulia': 1,
  'giro-delle-marche': 1,
  'giro-della-valle-daosta-mont-blanc': 5,
  'giro-del-trentino': 5,
  'giro-del-veneto': 1,
  'tour-de-luxembourg': 5,
  'tour-de-normandie': 6,
  'tour-de-savoie': 5,
  'tour-du-gevaudan': 3,
  'tour-du-var': 3,
  'vuelta-a-burgos': 5,
  'vuelta-a-castilla-y-leon': 3,
  'vuelta-a-la-comunidad-de-madrid': 3,
  'vuelta-a-la-rioja': 3,
  'vuelta-al-pais-vasco': 6,
  'vuelta-a-suecia': 6,
  'vuelta-a-suiza': 5,
  'vuelta-a-taiwan': 5,
  'vuelta-a-uruguay': 8,
  'vuelta-a-venezuela': 8,
  'vuelta-yugoslavia': 5,
  'tour-of-serbia': 4,
  'tour-of-montenegro': 4,
  'tour-of-greece': 5,
  'tour-of-cyprus': 4,
  'tour-of-iceland': 2,
  'tour-of-latvia': 4,
  'tour-of-netherlands': 4,
  'tour-of-luxembourg': 5,
  'tour-of-portugal': 11,
  'tour-of-andorra': 4,
  'tour-of-monaco': 4,
  'tour-of-san-marino': 4,
  'tour-of-vatican': 4,
  'tour-of-israel': 5,
  'tour-of-saudi-arabia': 5,
  'tour-of-uae': 7,
  'tour-of-qatar': 5,
  'tour-of-kuwait': 5,
  'tour-of-bahrain': 5,
  'tour-of-pakistan': 7,
  'tour-of-india': 8,
  'tour-of-sri-lanka': 5,
  'tour-of-thailand': 6,
  'tour-of-malaysia': 8,
  'tour-of-singapore': 5,
  'tour-of-indonesia': 6,
  'tour-of-philippines': 5,
  'etoile-de-besseges': 5,
  'vuelta-a-la-comunidad-valenciana': 5,
};

// Races that typically have a prologue
const RACES_WITH_PROLOGUE: Set<string> = new Set([
  'tour-down-under',
  'tour-de-romandie',
  'tour-de-suisse',
  'pune-grand-tour',
  'santos-tour-down-under',
  'deutschland-tour',
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

// Classifications to exclude (youth, U23, women categories)
const UNWANTED_CLASSIFICATIONS = ['MJ', 'MU', 'WJ', 'WU', 'WE', 'WWT'];

// Race slugs to explicitly exclude (women's races with incorrect classification, etc.)
const EXCLUDED_RACE_SLUGS: Set<string> = new Set([
  'vuelta-el-salvador', // Women's race incorrectly classified as 2.1
  'trofeo-felanitx-femina', // women's race
  'grand-prix-el-salvador', // women's race
  'grand-prix-san-salvador', // women's race
  'trofeo-palma-femina', // women's race
  'trofeo-binissalem-andratx', // women's race
  'race-torquay', // race is cancelled
  'grand-prix-de-oriente', // women's race
  'pionera-race-we',
]);

/**
 * Check if a race should be excluded based on classification, name, or slug
 * Mirrors the logic from calendar page filterUnwantedClassifications
 */
function shouldExcludeRace(name: string, classification: string | null, slug?: string): boolean {
  // Check explicit exclusion list first
  if (slug && EXCLUDED_RACE_SLUGS.has(slug)) {
    return true;
  }

  const cls = (classification || '').trim();

  // Check if unwanted classification is in the race name
  const hasUnwantedInName = UNWANTED_CLASSIFICATIONS.some(
    unwanted => name.includes(unwanted) || name.includes(`${unwanted} -`)
  );

  // Check if unwanted classification is in the classification field
  const hasUnwantedInClassification = UNWANTED_CLASSIFICATIONS.some(
    unwanted => cls.includes(unwanted)
  );

  // Check for "women" in name
  const hasWomenInName = name.toLowerCase().includes('women');

  // Check for WWT in classification
  const hasWWTInClassification = cls.includes('WWT');

  return hasUnwantedInName || hasUnwantedInClassification || hasWomenInName || hasWWTInClassification;
}

const KNOWN_SINGLE_DAY_RACES: Set<string> = new Set([
  // Monuments (WorldTour)
  'milano-sanremo',
  'ronde-van-vlaanderen',
  'paris-roubaix',
  'liege-bastogne-liege',
  'il-lombardia',

  // WorldTour one-day races
  'amstel-gold-race',
  'la-flèche-wallonne',
  'strade-bianche',
  'gent-wevelgem',
  'omloop-het-nieuwsblad',
  'kuurne-brussel-kuurne',
  'dwars-door-vlaanderen',
  'eschborn-frankfurt',
  'cyclassics-hamburg',
  'gp-quebec',
  'gp-montreal',
  'classic-brugge-de-panne',
  'copenhagen-sprint',

  // World Championships
  'world-championship',
  'world-championship-itt',
  'world-championship-me',

  // 1.Pro races (Second tier professional)
  'classique-dunkerque',
  'coppa-bernocchi',
  'antwerp-port-epic-ladies', // This should be checked - might be women's race

  // 1.1 races (Third tier professional)
  'a-travers-les-hauts-de-france',
  'alpes-gresivaudan-classic',
  'andorra-morabanc-classica',
  'antwerp-port-epic',
  'aveiro-region-champions-classic',
  'boucles-de-l-aulne',
  'cholet-pays-de-loire',
  'chrono-des-nations',
  'circuit-de-wallonie',
  'circuito-de-getxo',
  'clasica-jaen-paraiso-interior',
  'clasica-terres-de-l-ebre',
  'circuit-des-xi-villes',
  'grand-prix-longitudinal-del-norte',
  'grand-prix-san-salvador',
  'grote-prijs-jean-pierre-monsere',
  'heist-op-den-berg',
  'kampioenschap-van-vlaanderen1',
  'konvert-koerse',
  'la-classique-morbihan',
  'la-classique-puisaye-forterre',
  'la-poly-normande',
  'la-roue-tourangelle',
  'la-route-des-geants',
  'classic-grand-besancon-doubs',
  'classic-var',
  'classica-camp-de-morvedre',
  'coppa-agostoni',
  'coppa-montes-gran-premio-della-resistenza',
  'ruta-de-la-ceramica-gran-premio-castellon',
  'trofeo-calvia',
  'deia-trophy',
  'trofeo-pollenca-port-d-andratx',
  'trofeo-ses-salines-felanitx',
  'gp-d-ouverture',
  'great-ocean-road-race',
  'trofeo-palma',
  'muscat-classic',

  // 1.2 races (Non-professional)
  'alanya-cup',
  'albani-classic-fyen-rundt',
  'arno-wallaard-memorial',
  'beskid-classic',
  'boucle-de-l-artois',
  'circuito-del-porto-trofeo-arvedi',
  'clasica-pascua',
  'classic-annemasse-agglo',
  'classic-loire-atlantique',
  'classique-of-mauritius',
  'coppa-citta-di-san-daniele2',
  'de-hive-slag-om-woensdrecht',
  'dhofar-classic',
  'dorpenomloop-rucphen',
  'due-giorni-marchigiana-gp-santa-rita',
  'dwars-door-wingene',
  'east-midlands-international-cicle-classic',
  'fleche-ardennaise',
  'giro-del-medio-brenta',
  'gp-adria-mobil',
  'gp-antalya',
  'gp-brda-collio',
  'gp-cerami',
  'gp-czech-republic',
  'gp-gippingen',
  'gp-kranj',
  'grand-prix-de-fourmies',
  'gp-slovenian-istria',
  'grand-prix-vorarlberg',
  'halle-ingooigem',
  'heistse-pijl',
  'tour-of-istanbul',
  'kattekoers-herentals',
  'la-drome-classic',
  'la-picto-charentaise',
  'le-samyn',
  'memorial-marco-pantani',
  'nokere-koerse',
  'omloop-van-het-houtland',
  'paris-tours',
  'porec-classic',
  'ronde-van-drenthe',
  'ronde-van-limburg',
  'ronde-van-overijssel',
  'ster-van-zwolle',
  'syedra-ancient-city',
  'tour-de-la-mirabelle',
  'trofej-umag',
  'trofeo-alcide-degasperi',
  'trofeo-citta-di-brescia',
  'trofeo-citta-di-castelfidardo',
  'trofeo-torino-biella-giro-della-provincia-di-biell',
  'trofeu-da-arrabida',
  'visegrad-4-bicycle-race-gp-hungary',
  'visegrad-4-bicycle-race-gp-polski-via-odra',
  'visegrad-4-bicycle-race-gp-slovakia',
  'youngster-coast-challenge'
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
      const classification = data.classification || null;

      // Skip races with excluded classifications or patterns in name
      const name = data.name || slug;
      if (shouldExcludeRace(name, classification, slug)) {
        return;
      }

      raceConfigs.set(slug, {
        name: data.name || slug,
        totalStages: data.totalStages || data.stages || 1,
        isSingleDay: data.isSingleDay ?? false,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        classification,
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

    // Get stage dates for all races
    const stageDatesMap = new Map<string, Map<number | string, string>>();
    const racesWithStagesSnapshot = await db.collection('races').get();

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
    
    for (const raceDoc of racesWithStagesSnapshot.docs) {
      const raceSlug = raceDoc.id;
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
            base.setDate(base.getDate() + Math.max(0, stageNumber - 1));
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
        const isFailed = !!(validation && !validation.valid);
        const isEmpty = riderCount === 0;

        // GC (tour-gc) is supplementary data, not a race stage - don't count it
        const isSupplementary = doc.key.type === 'tour-gc';

        if (!isSupplementary) {
          if (isFailed) {
            failedStages++;
            totalStagesFailed++;
          } else if (!isEmpty) {
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
