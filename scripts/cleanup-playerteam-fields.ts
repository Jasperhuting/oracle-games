import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { FieldValue } from 'firebase-admin/firestore';

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

/**
 * Cleanup deprecated fields from playerTeam documents:
 * - totalPoints (replaced by pointsScored)
 * - racePoints (replaced by pointsBreakdown)
 * - stagesParticipated (calculated from pointsBreakdown.length)
 * - points (unused legacy field)
 */
async function cleanupPlayerTeamFields() {
  const dryRun = process.argv.includes('--dry-run');
  const batchSize = 500;

  console.log(`=== CLEANUP PLAYERTEAM FIELDS (${dryRun ? 'DRY RUN' : 'LIVE'}) ===\n`);
  console.log('Fields to remove:');
  console.log('  - totalPoints (use pointsScored instead)');
  console.log('  - racePoints (use pointsBreakdown instead)');
  console.log('  - stagesParticipated (use pointsBreakdown.length instead)');
  console.log('  - points (unused)\n');

  const snapshot = await db.collection('playerTeams').get();

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors: string[] = [];

  // Process in batches
  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    processed++;
    const data = doc.data();

    // Check which fields exist and need to be removed
    const fieldsToRemove: string[] = [];

    if ('totalPoints' in data) fieldsToRemove.push('totalPoints');
    if ('racePoints' in data) fieldsToRemove.push('racePoints');
    if ('stagesParticipated' in data) fieldsToRemove.push('stagesParticipated');
    if ('points' in data) fieldsToRemove.push('points');

    if (fieldsToRemove.length === 0) {
      skipped++;
      continue;
    }

    // First, ensure pointsScored is synced with totalPoints if it exists
    const pointsBreakdown = Array.isArray(data.pointsBreakdown) ? data.pointsBreakdown : [];
    const calculatedPoints = pointsBreakdown.reduce(
      (sum: number, event: { total?: number }) => sum + (event.total || 0),
      0
    );

    // If pointsScored doesn't match calculated, we need to update it too
    const currentPointsScored = data.pointsScored ?? 0;
    const needsPointsUpdate = currentPointsScored !== calculatedPoints;

    if (dryRun) {
      console.log(`${data.riderName || data.riderNameId}:`);
      console.log(`  Doc: ${doc.id}`);
      console.log(`  Fields to remove: ${fieldsToRemove.join(', ')}`);
      if (needsPointsUpdate) {
        console.log(`  Also update pointsScored: ${currentPointsScored} -> ${calculatedPoints}`);
      }
      console.log('');
      updated++;
    } else {
      try {
        const updateData: Record<string, any> = {};

        // Delete deprecated fields
        for (const field of fieldsToRemove) {
          updateData[field] = FieldValue.delete();
        }

        // Update pointsScored if needed
        if (needsPointsUpdate) {
          updateData.pointsScored = calculatedPoints;
        }

        currentBatch.update(doc.ref, updateData);
        batchCount++;
        updated++;

        // Commit batch when it reaches the limit
        if (batchCount >= batchSize) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }
      } catch (error) {
        errors.push(`Error preparing ${doc.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // Progress logging
    if (processed % 500 === 0) {
      console.log(`Progress: ${processed}/${snapshot.size} documents processed...`);
    }
  }

  // Add remaining batch
  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  // Commit all batches
  if (!dryRun && batches.length > 0) {
    console.log(`\nCommitting ${batches.length} batch(es)...`);
    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].commit();
        console.log(`  Batch ${i + 1}/${batches.length} committed`);
      } catch (error) {
        errors.push(`Error committing batch ${i + 1}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total documents: ${snapshot.size}`);
  console.log(`Processed: ${processed}`);
  console.log(`${dryRun ? 'Would update' : 'Updated'}: ${updated}`);
  console.log(`Skipped (no deprecated fields): ${skipped}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  if (!dryRun && updated > 0) {
    console.log('\n✓ Cleanup complete!');
  } else if (dryRun && updated > 0) {
    console.log('\nRun without --dry-run to apply cleanup.');
  }
}

cleanupPlayerTeamFields().catch(console.error);
