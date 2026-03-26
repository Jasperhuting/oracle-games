import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendDigestEmail, DigestTopic } from '@/lib/forum/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[FORUM-DIGEST] Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const results = { sent: 0, skipped: 0, errors: [] as string[] };

  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sinceTimestamp = Timestamp.fromDate(since);
    const twentyHoursAgo = Timestamp.fromDate(new Date(now.getTime() - 20 * 60 * 60 * 1000));

    // 1. Fetch new topics from last 24h
    const newTopicsSnap = await adminDb
      .collection('forum_topics')
      .where('createdAt', '>', sinceTimestamp)
      .get();

    if (newTopicsSnap.empty) {
      console.log('[FORUM-DIGEST] No new topics in last 24h');
      return Response.json({ success: true, ...results });
    }

    // 2. Group by gameId
    const topicsByGame = new Map<string, typeof newTopicsSnap.docs>();
    for (const doc of newTopicsSnap.docs) {
      const gameId = doc.data().gameId as string;
      if (!gameId) continue;
      if (!topicsByGame.has(gameId)) topicsByGame.set(gameId, []);
      topicsByGame.get(gameId)!.push(doc);
    }

    const affectedGameIds = [...topicsByGame.keys()];
    if (affectedGameIds.length === 0) {
      return Response.json({ success: true, ...results });
    }

    // 3. Find participants of affected games (batch in groups of 30 for Firestore `in` limit)
    const userIdSet = new Set<string>();
    for (let i = 0; i < affectedGameIds.length; i += 30) {
      const batch = affectedGameIds.slice(i, i + 30);
      const participantsSnap = await adminDb
        .collection('gameParticipants')
        .where('gameId', 'in', batch)
        .get();
      for (const doc of participantsSnap.docs) {
        const uid = doc.data().userId as string;
        if (uid) userIdSet.add(uid);
      }
    }

    // 4. Resolve game names once
    const gameNameMap = new Map<string, string>();
    for (let i = 0; i < affectedGameIds.length; i += 30) {
      const batch = affectedGameIds.slice(i, i + 30);
      const gamesSnap = await adminDb
        .collection('games')
        .where('__name__', 'in', batch)
        .get();
      for (const doc of gamesSnap.docs) {
        gameNameMap.set(doc.id, (doc.data().name as string) || doc.id);
      }
    }

    // 5. Per-user processing
    let sendIndex = 0;
    for (const uid of userIdSet) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const userData = userDoc.data();

        if (!userData?.email) { results.skipped++; continue; }
        if (userData.forumNotifications?.dailyDigest === false) { results.skipped++; continue; }

        // Idempotency: skip if digest was already sent in last 20h
        if (userData.forumDigestSentAt && userData.forumDigestSentAt > twentyHoursAgo) {
          results.skipped++;
          continue;
        }

        // Build topic list for this user (exclude topics they created; cap at 10)
        const userTopics: DigestTopic[] = [];
        for (const [gameId, docs] of topicsByGame) {
          for (const doc of docs) {
            const data = doc.data();
            if (data.createdBy === uid) continue; // skip own topics
            if (data.deleted) continue;
            userTopics.push({
              topicId: doc.id,
              title: (data.title as string) || '(geen titel)',
              gameName: gameNameMap.get(gameId) || gameId,
              createdByName: (data.createdByName as string) || 'Onbekend',
            });
          }
        }

        if (userTopics.length === 0) { results.skipped++; continue; }

        // Cap at 10
        const cappedTopics = userTopics.slice(0, 10);

        if (dryRun) {
          console.log(`[FORUM-DIGEST] DRY-RUN: Would send digest to ${userData.email} (${cappedTopics.length} topics)`);
          results.sent++;
          continue;
        }

        if (sendIndex > 0) await delay(600);

        await sendDigestEmail({ email: userData.email, topics: cappedTopics });

        // Mark as sent (idempotency)
        await adminDb.collection('users').doc(uid).update({
          forumDigestSentAt: FieldValue.serverTimestamp(),
        });

        results.sent++;
        sendIndex++;
        console.log(`[FORUM-DIGEST] Sent digest to ${userData.email}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[FORUM-DIGEST] Error for user ${uid}:`, msg);
        results.errors.push(`${uid}: ${msg}`);
      }
    }

    console.log('[FORUM-DIGEST] Complete', results);
    return Response.json({ success: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[FORUM-DIGEST] Fatal error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
