import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function check() {
  // Get sample playerTeam riderNameIds
  const pt = await db.collection('playerTeams').limit(5).get();
  console.log('Sample playerTeam riderNameIds:');
  pt.docs.forEach(d => console.log('  ', d.data().riderNameId));

  // Check stage results for nameID format
  const stageData = await db.collection('scraper-data')
    .where('key.type', '==', 'stage')
    .limit(1)
    .get();

  if (stageData.size > 0) {
    const data = stageData.docs[0].data();
    console.log('\nStage result doc:', stageData.docs[0].id);

    // Parse stageResults if it's a string
    let results = data.stageResults;
    if (typeof results === 'string') {
      results = JSON.parse(results);
    }

    if (results && Array.isArray(results)) {
      console.log('Sample stage result riders:');
      results.slice(0, 5).forEach((r: any) => {
        console.log(`  nameID: ${r.nameID || r.shortName}, name: ${r.name}, team: ${r.team}`);
      });
    }
  }

  // Check result type docs
  const resultData = await db.collection('scraper-data')
    .where('key.type', '==', 'result')
    .limit(1)
    .get();

  if (resultData.size > 0) {
    const data = resultData.docs[0].data();
    console.log('\nResult doc:', resultData.docs[0].id);

    let results = data.stageResults;
    if (typeof results === 'string') {
      results = JSON.parse(results);
    }

    if (results && Array.isArray(results)) {
      console.log('Sample result riders:');
      results.slice(0, 5).forEach((r: any) => {
        console.log(`  nameID: ${r.nameID}, shortName: ${r.shortName}, team: ${r.team}`);
      });
    }
  }
}

check().catch(console.error);
