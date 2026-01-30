import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

interface RiderInfo {
  riderTeam: string;
  riderCountry: string;
  jerseyImage: string;
}

/**
 * Enrich playerTeam documents with rider data from rankings_2026 collection
 *
 * This script:
 * 1. Loads all riders from rankings_2026 (complete data source)
 * 2. Loads team names from teams collection to resolve references
 * 3. Updates playerTeams that have missing riderTeam/riderCountry/jerseyImage
 */
async function enrichPlayerTeamRiderData() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`=== ENRICH PLAYERTEAM RIDER DATA (${dryRun ? 'DRY RUN' : 'LIVE'}) ===\n`);

  // Step 1: Load teams collection to build team name lookup
  console.log('Step 1: Loading teams collection for team names...');

  const teamsSnapshot = await db.collection('teams').get();
  const teamNameLookup = new Map<string, string>();
  const teamImageLookup = new Map<string, string>();

  // First pass: collect all team images from 2025 teams
  const teamImages2025 = new Map<string, string>();

  for (const doc of teamsSnapshot.docs) {
    const data = doc.data();
    // 2025 teams use 'teamImage', 2026 teams use 'jerseyImageTeam'
    const teamImage = data.teamImage || '';

    if (doc.id.endsWith('-2025') && teamImage) {
      // Get base team name (without year)
      const baseTeamId = doc.id.replace('-2025', '');
      teamImages2025.set(baseTeamId, teamImage);
    }
  }

  // Second pass: build lookup with fallback to 2025 images
  for (const doc of teamsSnapshot.docs) {
    const data = doc.data();
    teamNameLookup.set(doc.id, data.name || '');

    // Check both 'teamImage' (2025) and 'jerseyImageTeam' (2026) fields
    let teamImage = data.teamImage || data.jerseyImageTeam || '';

    // If 2026 team has no image, try to get from 2025 version
    if (!teamImage && doc.id.endsWith('-2026')) {
      const baseTeamId = doc.id.replace('-2026', '');
      teamImage = teamImages2025.get(baseTeamId) || '';
    }

    teamImageLookup.set(doc.id, teamImage);
  }

  const teamsWithImages = Array.from(teamImageLookup.values()).filter(img => img !== '').length;
  console.log(`  Loaded ${teamsSnapshot.size} teams (${teamsWithImages} have images)`);

  // Step 2: Load rankings_2026 collection
  console.log('Step 2: Loading rankings_2026 collection...');

  const rankingsSnapshot = await db.collection('rankings_2026').get();
  const riderLookup = new Map<string, RiderInfo>();

  for (const doc of rankingsSnapshot.docs) {
    const data = doc.data();
    const nameId = data.nameID || doc.id;

    // Resolve team reference to team name and teamImage
    let teamName = '';
    let teamImage = '';
    if (data.team) {
      // Team is stored as a Firestore reference
      const teamRef = data.team;
      if (teamRef.path) {
        // It's a DocumentReference
        const teamDocId = teamRef.path.split('/').pop();
        teamName = teamNameLookup.get(teamDocId) || '';
        teamImage = teamImageLookup.get(teamDocId) || '';
      } else if (typeof teamRef === 'string') {
        // It might be stored as a string path
        teamName = teamNameLookup.get(teamRef) || '';
        teamImage = teamImageLookup.get(teamRef) || '';
      }
    }

    riderLookup.set(nameId, {
      riderTeam: teamName,
      riderCountry: data.country || '',
      jerseyImage: teamImage, // Use team's shirt image instead of rider photo
    });
  }

  console.log(`  Built lookup with ${riderLookup.size} riders from rankings_2026\n`);

  // Step 3: Find playerTeams with missing data
  console.log('Step 3: Finding playerTeams with missing rider data...');

  const playerTeamsSnapshot = await db.collection('playerTeams').get();

  const needsUpdate: Array<{
    docId: string;
    riderNameId: string;
    riderName: string;
    currentData: Partial<RiderInfo>;
    newData: Partial<RiderInfo>;
  }> = [];

  let alreadyComplete = 0;
  let notFoundInLookup = 0;

  for (const doc of playerTeamsSnapshot.docs) {
    const data = doc.data();
    const riderNameId = data.riderNameId;

    // Check what's missing
    const hasTeam = data.riderTeam && data.riderTeam !== '';
    const hasCountry = data.riderCountry && data.riderCountry !== '';

    // For jerseyImage: check if it's a rider image (wrong)
    // Rider images contain "riders/", team images contain "shirts/"
    const currentJersey = data.jerseyImage || '';
    const hasWrongJersey = currentJersey.includes('riders/');

    // Look up rider data
    const riderInfo = riderLookup.get(riderNameId);

    if (!riderInfo) {
      notFoundInLookup++;
      continue;
    }

    // Build update object (only update missing fields, but always fix jerseyImage if wrong)
    const updates: Partial<RiderInfo> = {};

    if (!hasTeam && riderInfo.riderTeam) {
      updates.riderTeam = riderInfo.riderTeam;
    }
    if (!hasCountry && riderInfo.riderCountry) {
      updates.riderCountry = riderInfo.riderCountry;
    }
    // Fix jerseyImage: if wrong (rider image), replace with team image or clear it
    if (hasWrongJersey) {
      // Either set to team image (if available) or empty string
      updates.jerseyImage = riderInfo.jerseyImage || '';
    } else if (currentJersey === '' && riderInfo.jerseyImage) {
      // If empty and team has image, set it
      updates.jerseyImage = riderInfo.jerseyImage;
    }

    // Check if already complete (for counting)
    const isComplete = hasTeam && hasCountry && !hasWrongJersey;
    if (isComplete && Object.keys(updates).length === 0) {
      alreadyComplete++;
      continue;
    }

    // Only add if there are updates to make
    if (Object.keys(updates).length > 0) {
      needsUpdate.push({
        docId: doc.id,
        riderNameId,
        riderName: data.riderName || riderNameId,
        currentData: {
          riderTeam: data.riderTeam || '',
          riderCountry: data.riderCountry || '',
          jerseyImage: data.jerseyImage || '',
        },
        newData: updates,
      });
    }
  }

  console.log(`  Total playerTeams: ${playerTeamsSnapshot.size}`);
  console.log(`  Already complete: ${alreadyComplete}`);
  console.log(`  Not found in lookup: ${notFoundInLookup}`);
  console.log(`  Need update: ${needsUpdate.length}\n`);

  // Step 4: Show sample updates
  if (needsUpdate.length > 0) {
    console.log('Sample updates (first 10):');
    for (const item of needsUpdate.slice(0, 10)) {
      console.log(`  ${item.riderName} (${item.riderNameId}):`);
      for (const [key, value] of Object.entries(item.newData)) {
        console.log(`    ${key}: "${item.currentData[key as keyof RiderInfo] || ''}" -> "${value}"`);
      }
    }
    console.log('');
  }

  // Step 5: Apply updates
  if (!dryRun && needsUpdate.length > 0) {
    console.log('Step 5: Applying updates...');

    let updated = 0;
    let errors = 0;

    // Process in batches of 500
    const batchSize = 500;
    for (let i = 0; i < needsUpdate.length; i += batchSize) {
      const batch = db.batch();
      const batchItems = needsUpdate.slice(i, i + batchSize);

      for (const item of batchItems) {
        const docRef = db.collection('playerTeams').doc(item.docId);
        batch.update(docRef, item.newData);
      }

      try {
        await batch.commit();
        updated += batchItems.length;
        console.log(`  Batch ${Math.floor(i / batchSize) + 1}: Updated ${batchItems.length} documents`);
      } catch (error) {
        errors += batchItems.length;
        console.error(`  Batch ${Math.floor(i / batchSize) + 1}: Error - ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    console.log(`\n  Updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total playerTeams: ${playerTeamsSnapshot.size}`);
  console.log(`Already complete: ${alreadyComplete}`);
  console.log(`Not in rankings_2026: ${notFoundInLookup}`);
  console.log(`${dryRun ? 'Would update' : 'Updated'}: ${needsUpdate.length}`);

  if (dryRun && needsUpdate.length > 0) {
    console.log('\nRun without --dry-run to apply updates.');
  }

  return riderLookup;
}

// Also enrich bids collection
async function enrichBidsRiderData(riderLookup: Map<string, RiderInfo>) {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.argv.includes('--include-bids')) {
    console.log('\nSkipping bids enrichment. Use --include-bids to also update bids.');
    return;
  }

  console.log(`\n=== ENRICH BIDS RIDER DATA (${dryRun ? 'DRY RUN' : 'LIVE'}) ===\n`);

  // Find bids with missing riderCountry
  const bidsSnapshot = await db.collection('bids').get();

  const needsUpdate: Array<{
    docId: string;
    riderNameId: string;
    updates: { riderCountry?: string };
  }> = [];

  for (const doc of bidsSnapshot.docs) {
    const data = doc.data();
    const riderNameId = data.riderNameId;

    // Check if riderCountry is missing
    if (data.riderCountry && data.riderCountry !== '') continue;

    const riderInfo = riderLookup.get(riderNameId);
    if (!riderInfo || !riderInfo.riderCountry) continue;

    needsUpdate.push({
      docId: doc.id,
      riderNameId,
      updates: { riderCountry: riderInfo.riderCountry },
    });
  }

  console.log(`Total bids: ${bidsSnapshot.size}`);
  console.log(`Need riderCountry update: ${needsUpdate.length}`);

  if (!dryRun && needsUpdate.length > 0) {
    const batchSize = 500;
    let updated = 0;

    for (let i = 0; i < needsUpdate.length; i += batchSize) {
      const batch = db.batch();
      const batchItems = needsUpdate.slice(i, i + batchSize);

      for (const item of batchItems) {
        const docRef = db.collection('bids').doc(item.docId);
        batch.update(docRef, item.updates);
      }

      await batch.commit();
      updated += batchItems.length;
    }

    console.log(`Updated: ${updated} bids`);
  }
}

async function main() {
  const riderLookup = await enrichPlayerTeamRiderData();
  await enrichBidsRiderData(riderLookup);
}

main().catch(console.error);
