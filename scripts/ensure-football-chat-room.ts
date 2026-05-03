import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/server';

async function main() {
  const existingSnapshot = await adminDb
    .collection('chat_rooms')
    .where('gameType', '==', 'football')
    .where('status', 'in', ['open', 'scheduled'])
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    const room = existingSnapshot.docs[0];
    console.log(`Football chat already exists: ${room.id} (${room.data().title ?? 'zonder titel'})`);
    return;
  }

  const now = new Date();
  const closesAt = new Date('2026-12-31T23:59:59.000Z');

  const docRef = await adminDb.collection('chat_rooms').add({
    title: 'WK 2026 Voetbalchat',
    description: 'Praat mee over het WK 2026, wedstrijden, voorspellingen en opvallende momenten.',
    gameType: 'football',
    opensAt: Timestamp.fromDate(now),
    closesAt: Timestamp.fromDate(closesAt),
    createdAt: Timestamp.now(),
    createdBy: 'system',
    status: 'open',
    messageCount: 0,
  });

  console.log(`Created football chat room: ${docRef.id}`);
}

main().catch((error) => {
  console.error('Failed to ensure football chat room:', error);
  process.exit(1);
});
