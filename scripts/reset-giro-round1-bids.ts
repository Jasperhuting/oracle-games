import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

type AuctionNoticeType = 'info' | 'warning' | 'error' | 'success';

interface TargetGame {
  gameId: string;
  notice: {
    type: AuctionNoticeType;
    title: string;
    message: string;
  };
}

const targetGames: TargetGame[] = [
  {
    gameId: 'j5WTqXbqpasKYhn5rScO',
    notice: {
      type: 'error',
      title: 'Biedingen ronde 1 gereset',
      message:
        'Er is helaas een fout geweest waardoor biedingen van ronde 1 tijdelijk inzichtelijk waren. Daarom zijn alle biedingen van ronde 1 gereset. Excuses voor het ongemak.',
    },
  },
  {
    gameId: 'vzBNUh6nzUaLyy6rKQos',
    notice: {
      type: 'error',
      title: 'Biedingen ronde 1 gereset',
      message:
        'Er is helaas een fout geweest waardoor biedingen van ronde 1 tijdelijk inzichtelijk waren. Daarom zijn alle biedingen van ronde 1 gereset. Excuses voor het ongemak.',
    },
  },
];

function ensureFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  const fallbackPath = join(process.cwd(), 'service-account-key.json');
  const raw = readFileSync(fallbackPath, 'utf8');
  const key = JSON.parse(raw) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };

  return initializeApp({
    credential: cert({
      projectId: key.project_id,
      clientEmail: key.client_email,
      privateKey: key.private_key,
    }),
    projectId: key.project_id,
  });
}

async function main() {
  ensureFirebaseAdmin();
  const db = getFirestore();

  for (const target of targetGames) {
    const gameRef = db.collection('games').doc(target.gameId);
    const gameSnap = await gameRef.get();

    if (!gameSnap.exists) {
      throw new Error(`Game ${target.gameId} not found`);
    }

    const game = gameSnap.data();
    const period = game?.config?.auctionPeriods?.[0];

    if (!period) {
      throw new Error(`Game ${target.gameId} has no auction period 1`);
    }

    const startDate =
      typeof period.startDate === 'object' && 'toDate' in period.startDate
        ? period.startDate.toDate()
        : new Date(period.startDate);
    const endDate =
      typeof period.endDate === 'object' && 'toDate' in period.endDate
        ? period.endDate.toDate()
        : new Date(period.endDate);

    const bidsSnapshot = await db.collection('bids').where('gameId', '==', target.gameId).get();
    const bidsInRoundOne = bidsSnapshot.docs.filter((doc) => {
      const bid = doc.data();
      const bidAt =
        typeof bid.bidAt === 'object' && 'toDate' in bid.bidAt ? bid.bidAt.toDate() : new Date(bid.bidAt);
      return bidAt >= startDate && bidAt <= endDate;
    });

    const participantsSnapshot = await db
      .collection('gameParticipants')
      .where('gameId', '==', target.gameId)
      .get();

    console.log(
      `[RESET_GIRO_ROUND1] ${target.gameId} (${game?.name}) - deleting ${bidsInRoundOne.length} bids, messaging ${participantsSnapshot.size} participants`,
    );

    for (let i = 0; i < bidsInRoundOne.length; i += 450) {
      const batch = db.batch();
      for (const bidDoc of bidsInRoundOne.slice(i, i + 450)) {
        batch.delete(bidDoc.ref);
      }
      await batch.commit();
    }

    await gameRef.update({
      'config.auctionNotice': target.notice,
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (let i = 0; i < participantsSnapshot.docs.length; i += 300) {
      const batch = db.batch();
      for (const participantDoc of participantsSnapshot.docs.slice(i, i + 300)) {
        const participant = participantDoc.data();
        const userId = participant.userId;

        if (!userId) {
          continue;
        }

        const messageRef = db.collection('messages').doc();
        batch.set(messageRef, {
          type: 'game',
          senderId: 'system',
          senderName: 'Oracle Games',
          recipientId: userId,
          recipientName: participant.playername || 'Speler',
          gameId: target.gameId,
          gameName: game?.name || 'Giro Auction',
          subject: 'Biedingen Giro ronde 1 gereset',
          message:
            'Er is helaas een fout geweest waardoor biedingen van ronde 1 tijdelijk inzichtelijk waren voor andere spelers. Daarom zijn alle biedingen van ronde 1 gereset. Excuses voor het ongemak.',
          sentAt: Timestamp.now(),
          read: false,
        });
      }
      await batch.commit();
    }

    await db.collection('activityLogs').add({
      action: 'giro_round1_bids_reset',
      gameId: target.gameId,
      gameName: game?.name || null,
      details: {
        deletedBids: bidsInRoundOne.length,
        auctionPeriodIndex: 0,
        participantCount: participantsSnapshot.size,
      },
      timestamp: Timestamp.now(),
      source: 'scripts/reset-giro-round1-bids.ts',
    });
  }
}

main()
  .then(() => {
    console.log('[RESET_GIRO_ROUND1] Completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[RESET_GIRO_ROUND1] Failed:', error);
    process.exit(1);
  });
