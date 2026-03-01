import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../service-account-key.json';

type UserProfile = {
  playername?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string | null;
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount as any),
  });
}

const db = getFirestore();
const isApply = process.argv.includes('--apply');

function resolveName(profile: UserProfile | undefined): string | null {
  if (!profile) return null;
  const candidate = profile.playername || profile.displayName || profile.email || null;
  if (!candidate) return null;
  const trimmed = String(candidate).trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function main() {
  console.log(`[backfill-chat-anoniem] mode=${isApply ? 'APPLY' : 'DRY_RUN'}`);

  const snapshot = await db
    .collectionGroup('messages')
    .where('userName', '==', 'Anoniem')
    .get();

  const chatMessageDocs = snapshot.docs.filter((doc) => doc.ref.path.includes('/chat_rooms/'));
  console.log(`[backfill-chat-anoniem] matching chat messages: ${chatMessageDocs.length}`);

  const userIds = Array.from(
    new Set(
      chatMessageDocs
        .map((doc) => String(doc.data().userId || '').trim())
        .filter(Boolean)
    )
  );

  console.log(`[backfill-chat-anoniem] unique userIds: ${userIds.length}`);

  const userMap = new Map<string, UserProfile>();
  for (let i = 0; i < userIds.length; i += 10) {
    const chunk = userIds.slice(i, i + 10);
    const usersSnap = await db
      .collection('users')
      .where(FieldPath.documentId(), 'in', chunk)
      .get();

    usersSnap.docs.forEach((doc) => {
      userMap.set(doc.id, doc.data() as UserProfile);
    });
  }

  let examined = 0;
  let skippedNoUserId = 0;
  let skippedNoProfile = 0;
  let updatable = 0;
  let updated = 0;

  let batch = db.batch();
  let batchOps = 0;

  for (const doc of chatMessageDocs) {
    examined++;
    const data = doc.data();
    const userId = String(data.userId || '').trim();
    if (!userId) {
      skippedNoUserId++;
      continue;
    }

    const profile = userMap.get(userId);
    const resolvedName = resolveName(profile);
    if (!resolvedName) {
      skippedNoProfile++;
      continue;
    }

    const updates: Record<string, unknown> = {
      userName: resolvedName,
    };

    if (profile?.avatarUrl) {
      updates.userAvatar = profile.avatarUrl;
    }

    updatable++;

    if (isApply) {
      batch.update(doc.ref, updates);
      batchOps++;
      if (batchOps >= 400) {
        await batch.commit();
        updated += batchOps;
        batch = db.batch();
        batchOps = 0;
      }
    }
  }

  if (isApply && batchOps > 0) {
    await batch.commit();
    updated += batchOps;
  }

  console.log('[backfill-chat-anoniem] summary');
  console.log(`- examined: ${examined}`);
  console.log(`- skippedNoUserId: ${skippedNoUserId}`);
  console.log(`- skippedNoProfile: ${skippedNoProfile}`);
  console.log(`- updatable: ${updatable}`);
  console.log(`- updated: ${isApply ? updated : 0}`);
}

main().catch((error) => {
  console.error('[backfill-chat-anoniem] failed:', error);
  process.exit(1);
});
