import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { calculateCorrectPredictions } from '../app/f1/lib/points';
import {
  F1_COLLECTIONS,
  F1Prediction,
  F1RaceResult,
  F1Standing,
  createRaceDocId,
  createStandingDocId,
} from '../app/f1/types';

const SERVICE_ACCOUNT_PATH = '/Users/jasperhuting/serviceAccountKey.json';
const SEASON = 2026;
const ROUND = 2;

async function main() {
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(SERVICE_ACCOUNT_PATH),
    });

  const f1Db = getFirestore(app, 'oracle-games-f1');
  const raceId = createRaceDocId(SEASON, ROUND);

  console.log(`Backfilling F1 correct predictions for ${raceId}...`);

  const resultDoc = await f1Db.collection(F1_COLLECTIONS.RACE_RESULTS).doc(raceId).get();
  if (!resultDoc.exists) {
    throw new Error(`Race result not found for ${raceId}`);
  }

  const result = resultDoc.data() as F1RaceResult;
  const predictionsSnapshot = await f1Db
    .collection(F1_COLLECTIONS.PREDICTIONS)
    .where('raceId', '==', raceId)
    .get();

  console.log(`Found ${predictionsSnapshot.size} predictions for round ${ROUND}.`);

  let updated = 0;

  for (const predictionDoc of predictionsSnapshot.docs) {
    const prediction = predictionDoc.data() as F1Prediction;
    const standingId = createStandingDocId(prediction.userId, SEASON);
    const standingRef = f1Db.collection(F1_COLLECTIONS.STANDINGS).doc(standingId);
    const standingDoc = await standingRef.get();

    if (!standingDoc.exists) {
      console.log(`- Skipping ${prediction.userId}: standing missing`);
      continue;
    }

    const standing = standingDoc.data() as F1Standing;
    const previousCorrectByRace =
      standing.correctPredictionsByRace && typeof standing.correctPredictionsByRace === 'object'
        ? standing.correctPredictionsByRace
        : {};

    const roundCorrect = calculateCorrectPredictions(prediction, result);
    const nextCorrectByRace = {
      ...previousCorrectByRace,
      [raceId]: roundCorrect,
    };
    const totalCorrect = Object.values(nextCorrectByRace).reduce((sum, value) => sum + value, 0);

    await standingRef.update({
      correctPredictionsByRace: nextCorrectByRace,
      correctPredictions: totalCorrect,
    });

    console.log(`- Updated ${prediction.userId}: round=${roundCorrect}, total=${totalCorrect}`);
    updated++;
  }

  console.log(`Done. Updated ${updated} standings for ${raceId}.`);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
