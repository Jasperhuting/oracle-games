import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in .env.local');
    console.error('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
}

const db = getFirestore();

type UserDoc = {
  playername?: string;
  email?: string;
};

type GameParticipantDoc = {
  userId?: string;
  playername?: string;
};

async function syncGameParticipantsPlayernames(options: {
  dryRun: boolean;
  pageSize: number;
  maxUpdates?: number;
}) {
  const { dryRun, pageSize, maxUpdates } = options;

  console.log('=== Sync gameParticipants.playername ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will update documents)'}`);
  console.log(`Page size: ${pageSize}`);
  if (typeof maxUpdates === 'number') console.log(`Max updates: ${maxUpdates}`);
  console.log('');

  const userCache = new Map<string, string | null>();

  let lastDocId: string | null = null;
  let totalScanned = 0;
  let totalDifferent = 0;
  let totalUpdated = 0;
  let totalMissingUserId = 0;
  let totalMissingUserDoc = 0;

  let batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 450;

  const commitBatch = async () => {
    if (batchCount === 0) return;
    if (!dryRun) {
      await batch.commit();
    }
    totalUpdated += batchCount;
    batch = db.batch();
    batchCount = 0;
  };

  while (true) {
    let query = db
      .collection('gameParticipants')
      .orderBy(FieldPath.documentId())
      .limit(pageSize);

    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      totalScanned++;

      const data = doc.data() as GameParticipantDoc;
      const userId = data.userId;

      if (!userId) {
        totalMissingUserId++;
        lastDocId = doc.id;
        continue;
      }

      let desiredPlayername = userCache.get(userId);
      if (desiredPlayername === undefined) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          userCache.set(userId, null);
          totalMissingUserDoc++;
          lastDocId = doc.id;
          continue;
        }

        const userData = userDoc.data() as UserDoc;
        desiredPlayername = (userData.playername || userData.email || null) as string | null;
        userCache.set(userId, desiredPlayername);
      }

      if (!desiredPlayername) {
        lastDocId = doc.id;
        continue;
      }

      if (data.playername !== desiredPlayername) {
        totalDifferent++;

        if (!dryRun) {
          batch.update(doc.ref, { playername: desiredPlayername });
          batchCount++;

          if (batchCount >= BATCH_LIMIT) {
            await commitBatch();
          }
        }

        if (totalDifferent <= 25) {
          console.log(`${doc.id}: '${data.playername ?? ''}' -> '${desiredPlayername}' (userId: ${userId})`);
        }

        if (typeof maxUpdates === 'number' && totalDifferent >= maxUpdates) {
          lastDocId = doc.id;
          await commitBatch();
          console.log('');
          console.log('Reached maxUpdates limit, stopping early.');
          console.log('');
          console.log('=== SUMMARY ===');
          console.log(`Scanned: ${totalScanned}`);
          console.log(`Different: ${totalDifferent}`);
          console.log(`Updated: ${dryRun ? 0 : totalUpdated}`);
          console.log(`Missing userId: ${totalMissingUserId}`);
          console.log(`Missing user doc: ${totalMissingUserDoc}`);
          return;
        }
      }

      lastDocId = doc.id;
    }
  }

  await commitBatch();

  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`Scanned: ${totalScanned}`);
  console.log(`Different: ${totalDifferent}`);
  console.log(`Updated: ${dryRun ? 0 : totalUpdated}`);
  console.log(`Missing userId: ${totalMissingUserId}`);
  console.log(`Missing user doc: ${totalMissingUserDoc}`);
}

const args = process.argv.slice(2);

const isLive =
  args.includes('--live') ||
  process.env.npm_config_live === 'true' ||
  process.env.npm_config_live === '1';

const pageSizeArg = args.find((a) => a.startsWith('--pageSize='));
const pageSize = pageSizeArg ? Number(pageSizeArg.split('=')[1]) : 500;

const maxUpdatesArg = args.find((a) => a.startsWith('--maxUpdates='));
const maxUpdates = maxUpdatesArg ? Number(maxUpdatesArg.split('=')[1]) : undefined;

if (!Number.isFinite(pageSize) || pageSize <= 0 || pageSize > 1000) {
  console.error('❌ Invalid --pageSize value. Use a number between 1 and 1000.');
  process.exit(1);
}

if (maxUpdates !== undefined && (!Number.isFinite(maxUpdates) || maxUpdates <= 0)) {
  console.error('❌ Invalid --maxUpdates value. Use a positive number.');
  process.exit(1);
}

syncGameParticipantsPlayernames({
  dryRun: !isLive,
  pageSize,
  maxUpdates,
})
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
