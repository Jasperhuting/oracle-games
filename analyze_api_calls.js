const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function analyzeActivityLogs() {
  console.log('Analyzing activity logs for frequent API calls...\n');

  // Get recent activity logs (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const snapshot = await db.collection('activityLogs')
    .where('timestamp', '>', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .orderBy('timestamp', 'desc')
    .limit(5000)
    .get();

  const apiCalls = {};
  const urlPatterns = {};

  snapshot.forEach(doc => {
    const data = doc.data();

    // Track actions
    if (data.action) {
      apiCalls[data.action] = (apiCalls[data.action] || 0) + 1;
    }

    // Track URL patterns if available
    if (data.endpoint || data.url) {
      const url = data.endpoint || data.url;
      urlPatterns[url] = (urlPatterns[url] || 0) + 1;
    }
  });

  // Sort by frequency
  const sortedActions = Object.entries(apiCalls)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log('📊 Top 20 most frequent ACTIONS in last 7 days:\n');
  console.log('Action'.padEnd(45) + 'Count');
  console.log('='.repeat(60));
  sortedActions.forEach(([action, count]) => {
    console.log(action.padEnd(45) + count);
  });

  if (Object.keys(urlPatterns).length > 0) {
    const sortedUrls = Object.entries(urlPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    console.log('\n\n📍 Top 15 most frequent URL PATTERNS:\n');
    console.log('URL Pattern'.padEnd(60) + 'Count');
    console.log('='.repeat(75));
    sortedUrls.forEach(([url, count]) => {
      console.log(url.padEnd(60) + count);
    });
  }

  console.log('\n✅ Total logs analyzed:', snapshot.size);
  console.log('📅 Date range: Last 7 days');
}

analyzeActivityLogs()
  .then(() => {
    console.log('\n✨ Analysis complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
