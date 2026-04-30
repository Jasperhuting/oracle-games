/**
 * Eenmalig importscript: Giro d'Italia 2026 route-info -> Firestore
 *
 * Gebruik:
 *   npx tsx scripts/import-giro-2026-route-info.ts
 *
 * Vereist in .env.local:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * Wat dit script doet:
 *   - Leest alle 21 stages uit lib/data/giro-2026-route-info.ts
 *   - Leidt stageType en finishType automatisch af uit profileScore / finalKmGradient
 *   - Schrijft elk document naar Firestore collection 'stageRouteInfo'
 *   - Document ID = raceSlug (bijv. 'giro-d-italia-2026-stage-1')
 *   - Gebruikt merge zodat bestaande velden niet worden gewist
 *
 * BELANGRIJK: raceSlug in lib/data/giro-2026-route-info.ts moet exact overeenkomen
 * met de raceSlug in je Slipstream game config (Firestore: games/{gameId}.config.countingRaces[].raceSlug).
 * Controleer dit eerst in de Firebase console.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GIRO_2026_ROUTE_INFO } from '../lib/data/giro-2026-route-info';
import { deriveStageType, deriveFinishType, StageRouteInfo } from '../lib/types/stageRouteInfo';

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Ontbrekende Firebase credentials in .env.local');
    console.error('   Vereist: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

const db = getFirestore();
const COLLECTION = 'stageRouteInfo';
const NOW = new Date().toISOString();

async function importRouteInfo() {
  console.log(`\n🚴 Giro d'Italia 2026 - route-info import\n`);
  console.log(`Collection: ${COLLECTION}`);
  console.log(`Stages: ${GIRO_2026_ROUTE_INFO.length}\n`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const stage of GIRO_2026_ROUTE_INFO) {
    const { raceSlug, isTimeTrial, ...rest } = stage;

    // Leid stageType en finishType af
    const stageType = deriveStageType(rest.profileScore, isTimeTrial);
    const finishType = deriveFinishType(rest.finalKmGradient);

    const routeInfo: StageRouteInfo = {
      ...rest,
      stageType,
      finishType,
      lastUpdatedAt: NOW,
    };

    // Verwijder undefined velden (Firestore accepteert deze niet)
    const cleanData = Object.fromEntries(
      Object.entries(routeInfo).filter(([, v]) => v !== undefined)
    ) as StageRouteInfo;

    try {
      await db.collection(COLLECTION).doc(raceSlug).set(cleanData, { merge: true });
      const hasData = rest.distanceKm !== undefined || rest.profileScore !== undefined;
      if (hasData) {
        console.log(`✅ Stage ${stage.stageNumber}: ${raceSlug} (${stageType})`);
        successCount++;
      } else {
        console.log(`⚠️  Stage ${stage.stageNumber}: ${raceSlug} — geen data ingevuld (TODO)`);
        skippedCount++;
      }
    } catch (err) {
      console.error(`❌ Stage ${stage.stageNumber}: ${raceSlug} — FOUT:`, err);
      errorCount++;
    }
  }

  console.log(`\n📊 Resultaat:`);
  console.log(`   ✅ Succesvol: ${successCount}`);
  console.log(`   ⚠️  Leeg (TODO): ${skippedCount}`);
  console.log(`   ❌ Fouten: ${errorCount}`);

  if (skippedCount > 0) {
    console.log(`\n💡 Vul de lege stages in lib/data/giro-2026-route-info.ts in`);
    console.log(`   en run dit script opnieuw.`);
  }

  if (errorCount > 0) {
    console.log(`\n⚠️  Controleer de raceSlug-waarden in lib/data/giro-2026-route-info.ts.`);
    console.log(`   Ze moeten exact overeenkomen met games/{gameId}.config.countingRaces[].raceSlug`);
    process.exit(1);
  }

  console.log(`\n✅ Import klaar. Check Firestore collection '${COLLECTION}'.\n`);
  process.exit(0);
}

importRouteInfo();
