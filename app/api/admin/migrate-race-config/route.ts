import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * POST /api/admin/migrate-race-config
 *
 * One-time migration: reads all race documents for a given year and writes
 * totalStages, hasPrologue, isSingleDay, excludeFromScraping if not already set.
 *
 * Safe to run multiple times — only writes absent fields.
 * Body: { userId, year }
 */

// Snapshot of KNOWN_RACE_STAGES from race-status/route.ts
const KNOWN_RACE_STAGES: Record<string, number> = {
  'tour-de-france': 21,
  'giro-d-italia': 21,
  'vuelta-a-espana': 21,
  'paris-nice': 8,
  'tirreno-adriatico': 7,
  'volta-a-catalunya': 7,
  'dauphine': 8,
  'tour-de-suisse': 8,
  'tour-de-pologne': 7,
  'renewi-tour': 5,
  'deutschland-tour': 4,
  'tour-down-under': 6,
  'tour-de-romandie': 5,
  'tour-of-the-alps': 5,
  'itzulia-basque-country': 6,
  'tour-of-oman': 5,
  'uae-tour': 7,
  'arctic-race-of-norway': 4,
  'czech-tour': 4,
  'alula-tour': 5,
  '4-jours-de-dunkerque': 5,
  'dookola-mazowsza': 4,
  'kreiz-breizh-elites': 3,
  'acht-van-bladel2': 3,
  'anna-vasa-race': 3,
  'course-cycliste-de-solidarnosc': 4,
  'course-de-la-paix-u23': 4,
  'cote-d-or-classic-juniors': 2,
  'trofej-umag': 1,
  'tour-of-albania': 5,
  'tour-of-turkey': 8,
  'tour-de-langkawi': 8,
  'tour-of-guangxi': 6,
  'tour-of-britain': 6,
  'volta-a-portugal-em-bicicleta': 11,
  'tour-of-norway': 4,
  'tour-of-austria': 5,
  'tour-of-denmark': 5,
  'tour-of-slovenia': 5,
  'tour-of-sweden': 3,
  'tour-of-belgium': 5,
  'vuelta-a-andalucia-ruta-ciclista-del-sol': 5,
  'région-pays-de-la-loire-tour': 4,
  'tour-of-hainan': 5,
  'presidential-cycling-tour-of-turkiye': 8,
  'tour-de-hongrie': 5,
  'boucles-de-la-mayenne-crédit-mutuel': 3,
  'ethias-tour-de-wallonie': 5,
  'baloise-belgium-tour': 5,
  'vuelta-al-tachira': 10,
  'pune-grand-tour': 4,
  'tour-of-sharjah': 5,
  'tour-de-taiwan': 5,
  'the-princess-maha-chakri-sirindhorns-cup-tour-of-thailand': 6,
  'bakukhankendi-azerbaijan-cycling-race': 5,
  'flèche-du-sud': 5,
  'grande-prémio-internacional-beiras-e-serra-da-estrela': 3,
  'la-route-doccitanie-cic': 4,
  'tour-of-istanbul': 3,
  'il-giro-dabruzzo': 4,
  'tour-of-holland': 5,
  'jamaica-international-cycling-classic': 3,
  'tour-dalgérie': 10,
  'tour-du-bénin': 6,
  'tour-de-mauritanie': 7,
  'tour-alsace': 5,
  'tour-of-kosovo': 3,
  'tour-of-bulgaria': 5,
  'tour-of-romania': 5,
  'tour-darménie': 4,
  'tour-de-serbie': 4,
  'giro-della-valle-daosta-mont-blanc': 5,
  'giro-del-trentino': 5,
  'tour-de-luxembourg': 5,
  'tour-de-normandie': 6,
  'tour-du-var': 3,
  'vuelta-a-burgos': 5,
  'vuelta-a-castilla-y-leon': 3,
  'vuelta-al-pais-vasco': 6,
  'vuelta-a-uruguay': 8,
  'vuelta-a-venezuela': 8,
  'etoile-de-besseges': 5,
  'volta-comunitat-valenciana': 5,
  'setmana-ciclista-valenciana': 4,
  'tour-cycliste-international-la-provence': 3,
  'ruta-del-sol': 5,
  'volta-ao-algarve': 5,
  'tour-of-rwanda': 8,
  'giro-di-sardegna': 5,
  'istrian-spring-tour': 3,
  'circuit-des-ardennes': 3,
  'ronde-de-loise': 5,
  'tour-of-malopolska': 3,
  'course-cycliste-de-solidarnosc-et-des-champions-olympiques': 5,
  'tour-of-rhodes': 4,
};

// Snapshot of RACES_WITH_PROLOGUE
const RACES_WITH_PROLOGUE = new Set([
  'tour-down-under',
  'tour-de-romandie',
  'tour-de-suisse',
  'pune-grand-tour',
  'santos-tour-down-under',
  'deutschland-tour',
]);

// Snapshot of KNOWN_SINGLE_DAY_RACES
const KNOWN_SINGLE_DAY_RACES = new Set([
  'milano-sanremo', 'ronde-van-vlaanderen', 'paris-roubaix',
  'liege-bastogne-liege', 'il-lombardia', 'amstel-gold-race',
  'la-flèche-wallonne', 'strade-bianche', 'gent-wevelgem',
  'omloop-het-nieuwsblad', 'kuurne-brussel-kuurne', 'dwars-door-vlaanderen',
  'eschborn-frankfurt', 'cyclassics-hamburg', 'gp-quebec', 'gp-montreal',
  'classic-brugge-de-panne', 'copenhagen-sprint', 'world-championship',
  'world-championship-itt', 'world-championship-me', 'classique-dunkerque',
  'coppa-bernocchi', 'antwerp-port-epic', 'a-travers-les-hauts-de-france',
  'alpes-gresivaudan-classic', 'andorra-morabanc-classica',
  'boucles-de-l-aulne', 'cholet-pays-de-loire', 'chrono-des-nations',
  'circuit-de-wallonie', 'circuito-de-getxo', 'clasica-jaen-paraiso-interior',
  'clasica-terres-de-l-ebre', 'circuit-des-xi-villes',
  'grand-prix-longitudinal-del-norte', 'grote-prijs-jean-pierre-monsere',
  'heist-op-den-berg', 'la-classique-morbihan', 'la-classique-puisaye-forterre',
  'la-poly-normande', 'la-roue-tourangelle', 'la-route-des-geants',
  'classic-grand-besancon-doubs', 'classic-var', 'classica-camp-de-morvedre',
  'coppa-agostoni', 'coppa-montes-gran-premio-della-resistenza',
  'ruta-de-la-ceramica-gran-premio-castellon', 'trofeo-calvia', 'deia-trophy',
  'trofeo-pollenca-port-d-andratx', 'trofeo-ses-salines-felanitx',
  'gp-d-ouverture', 'great-ocean-road-race', 'trofeo-palma', 'muscat-classic',
  'alanya-cup', 'albani-classic-fyen-rundt', 'arno-wallaard-memorial',
  'beskid-classic', 'boucle-de-l-artois', 'circuito-del-porto-trofeo-arvedi',
  'clasica-pascua', 'classic-annemasse-agglo', 'classic-loire-atlantique',
  'classique-of-mauritius', 'de-hive-slag-om-woensdrecht', 'dhofar-classic',
  'dorpenomloop-rucphen', 'due-giorni-marchigiana-gp-santa-rita',
  'dwars-door-wingene', 'east-midlands-international-cicle-classic',
  'fleche-ardennaise', 'giro-del-medio-brenta', 'gp-adria-mobil',
  'gp-antalya', 'gp-brda-collio', 'gp-cerami', 'gp-czech-republic',
  'gp-gippingen', 'gp-kranj', 'grand-prix-de-fourmies', 'gp-slovenian-istria',
  'grand-prix-vorarlberg', 'halle-ingooigem', 'heistse-pijl',
  'kattekoers-herentals', 'la-drome-classic', 'la-picto-charentaise',
  'le-samyn', 'memorial-marco-pantani', 'nokere-koerse',
  'omloop-van-het-houtland', 'paris-tours', 'porec-classic',
  'ronde-van-drenthe', 'ronde-van-limburg', 'ronde-van-overijssel',
  'ster-van-zwolle', 'syedra-ancient-city', 'tour-de-la-mirabelle',
  'trofej-umag', 'trofeo-alcide-degasperi', 'trofeo-citta-di-brescia',
  'trofeo-citta-di-castelfidardo', 'trofeu-da-arrabida',
  'visegrad-4-bicycle-race-gp-hungary', 'visegrad-4-bicycle-race-gp-polski-via-odra',
  'visegrad-4-bicycle-race-gp-slovakia', 'youngster-coast-challenge',
  'asian-championships-me', 'asian-continental-championships-mixed-relay-ttt',
  'grand-prix-alaiye1', 'tour-des-alpes-maritimes-et-du-var', 'nc-philippines-itt',
  'faun-ardeche-classic', 'grand-prix-pedalia', 'visit-south-aegean-gp',
  'region-on-dodecanese-gp', 'gp-samyn', 'trofeo-laigueglia',
  'grand-prix-apollon-temple-me', 'le-tour-des-100-communes', 'rhodes-gp',
  'gp-de-la-ville-de-lillers', 'porec-trophy', 'popolarissima',
  'vuelta-ciclista-a-la-region-de-murcia',
]);

// Single-day patterns (slug contains these)
const KNOWN_SINGLE_DAY_PATTERNS = ['nc-', 'national-championships', '-itt', '-time-trial'];

// Snapshot of EXCLUDED_RACE_SLUGS
const EXCLUDED_RACE_SLUGS = new Set([
  'vuelta-el-salvador', 'trofeo-felanitx-femina', 'grand-prix-el-salvador',
  'grand-prix-san-salvador', 'trofeo-palma-femina', 'trofeo-binissalem-andratx',
  'race-torquay', 'grand-prix-de-oriente', 'pionera-race-we',
  'aveiro-region-champions-classic', 'grand-prix-alaiye', 'clasica-de-almeria-we',
  'kuurne-brussel-kuurne-juniors', 'omloop-van-het-hageland',
  'biwase-tour-of-vietnam', 'grand-prix-apollon-temple-we',
  'gran-premi-les-franqueses-kh7', 'biwase-cup', 'gp-oetingen',
  'trofeo-da-moreno-piccolo-trofeo-alfredo-binda', 'le-tour-de-filipinas',
  'asian-cycling-championships-mj2', 'asian-cycling-championships-wu23',
]);

function isSingleDayBySlug(slug: string): boolean {
  if (KNOWN_SINGLE_DAY_RACES.has(slug)) return true;
  return KNOWN_SINGLE_DAY_PATTERNS.some(p => slug.includes(p));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, year } = body;

    if (!userId || !year) {
      return NextResponse.json({ error: 'userId and year are required' }, { status: 400 });
    }

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    const snapshot = await db.collection('races').where('year', '==', Number(year)).get();

    let updated = 0;
    let skipped = 0;

    // Process in batches of 400 (Firestore limit is 500 per batch)
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const slug = data.slug || doc.id.replace(`_${year}`, '');

      // Only write fields that are absent (undefined or null)
      const update: Record<string, unknown> = {};

      if (data.totalStages == null) {
        update.totalStages = KNOWN_RACE_STAGES[slug] ?? 1;
      }
      if (data.hasPrologue == null) {
        update.hasPrologue = RACES_WITH_PROLOGUE.has(slug);
      }
      if (data.isSingleDay == null) {
        update.isSingleDay = isSingleDayBySlug(slug);
      }
      if (data.excludeFromScraping == null) {
        update.excludeFromScraping = EXCLUDED_RACE_SLUGS.has(slug);
      }

      if (Object.keys(update).length === 0) {
        skipped++;
        continue;
      }

      batch.set(doc.ref, update, { merge: true });
      batchCount++;
      updated++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      year,
      total: snapshot.size,
      updated,
      skipped,
      message: `Migration complete: ${updated} updated, ${skipped} already had config`,
    });
  } catch (error) {
    console.error('[migrate-race-config] Error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
