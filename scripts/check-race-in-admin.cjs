const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function main() {
  const year = Number(process.argv[2]) || new Date().getFullYear();
  const query = (process.argv[3] || 'vuelta-a-la-comunidad-valenciana').toLowerCase();

  const racesSnap = await db.collection('races').where('year', '==', year).get();

  const matches = [];
  racesSnap.forEach(doc => {
    const data = doc.data();
    const slug = (data.slug || doc.id || '').toString();
    const name = (data.name || '').toString();
    const classification = (data.classification || '').toString();

    const haystack = `${slug} ${name}`.toLowerCase();
    if (haystack.includes(query)) {
      matches.push({
        id: doc.id,
        slug,
        name,
        year: data.year,
        classification,
        isSingleDay: data.isSingleDay,
        totalStages: data.totalStages || data.stages,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        active: data.active,
      });
    }
  });

  console.log(`Year: ${year}`);
  console.log(`Query: "${query}"`);
  console.log(`Matches: ${matches.length}`);
  matches.forEach((m, i) => {
    console.log(`\n#${i + 1}`);
    console.log(m);
  });

  if (matches.length === 0) {
    console.log('\nNo race found in races collection for that year/query.');
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
