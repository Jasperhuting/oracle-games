import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { userHandler, ApiError } from '@/lib/api/handler';
import { FieldValue } from 'firebase-admin/firestore';

function isValidDocId(value: string): boolean {
  return Boolean(value) && !value.includes('/') && value.length <= 128;
}

/**
 * GET /api/forum/read-status?topicIds=id1,id2,...
 * Returns { readStatuses: { [topicId]: string | null } }
 * where the string is the ISO timestamp of when the topic was last marked as read.
 */
export const GET = userHandler('forum-read-status-get', async (ctx) => {
  const { uid, request } = ctx;
  const { searchParams } = new URL(request.url);
  const topicIdsParam = searchParams.get('topicIds') || '';
  const topicIds = topicIdsParam
    .split(',')
    .map((id) => id.trim())
    .filter(isValidDocId);

  if (topicIds.length === 0) {
    return { readStatuses: {} };
  }

  const refs = topicIds.map((topicId) =>
    adminDb.collection('forum_read_status').doc(`${uid}_${topicId}`)
  );

  const docs = await adminDb.getAll(...refs);

  const readStatuses: Record<string, string | null> = {};
  topicIds.forEach((topicId, index) => {
    const doc = docs[index];
    if (doc.exists) {
      const data = doc.data()!;
      const readAt = data.readAt;
      if (readAt && typeof readAt.toDate === 'function') {
        readStatuses[topicId] = readAt.toDate().toISOString();
      } else if (typeof readAt === 'string') {
        readStatuses[topicId] = readAt;
      } else {
        readStatuses[topicId] = null;
      }
    } else {
      readStatuses[topicId] = null;
    }
  });

  return { readStatuses };
});

/**
 * POST /api/forum/read-status
 * Body: { topicId: string }
 * Marks the given topic as read for the authenticated user.
 */
export const POST = userHandler('forum-read-status-post', async (ctx) => {
  const { uid, request } = ctx as { uid: string; request: NextRequest };
  const body = await request.json().catch(() => ({}));
  const { topicId } = body || {};

  if (!topicId || typeof topicId !== 'string' || !isValidDocId(topicId)) {
    throw new ApiError('Missing or invalid topicId', 400);
  }

  await adminDb
    .collection('forum_read_status')
    .doc(`${uid}_${topicId}`)
    .set(
      {
        userId: uid,
        topicId,
        readAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { ok: true };
});
