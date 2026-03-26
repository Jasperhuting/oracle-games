import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://oracle-games.online';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');
  return new Resend(apiKey);
}

export async function sendReplyNotifications(opts: {
  topicId: string;
  topicTitle: string;
  topicCreatedBy: string;
  replyerId: string;
  replyPreview: string;
}): Promise<void> {
  const { topicId, topicTitle, topicCreatedBy, replyerId, replyPreview } = opts;

  // Collect all participants: topic creator + reply authors
  const repliesSnap = await adminDb
    .collection('forum_replies')
    .where('topicId', '==', topicId)
    .get();

  const participantUids = new Set<string>([topicCreatedBy]);
  for (const doc of repliesSnap.docs) {
    const createdBy = doc.data().createdBy as string | undefined;
    if (createdBy) participantUids.add(createdBy);
  }
  participantUids.delete(replyerId); // never notify the person who just replied

  if (participantUids.size === 0) return;

  const resend = getResend();
  let sendCount = 0;

  for (const uid of participantUids) {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (!userData?.email) continue;
    const prefs = userData.forumNotifications ?? {};
    if (prefs.replyOnMyTopic === false) continue;

    const preview = replyPreview.slice(0, 200);
    const topicUrl = `${BASE_URL}/forum/topic/${topicId}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
        <h2 style="color: #02554d;">Nieuwe reactie op je topic</h2>
        <p>Er is een nieuwe reactie geplaatst op <strong>${topicTitle}</strong>.</p>
        <blockquote style="border-left: 3px solid #02554d; padding-left: 12px; color: #555; margin: 16px 0;">
          ${preview}${preview.length === 200 ? '...' : ''}
        </blockquote>
        <a href="${topicUrl}" style="display:inline-block;background:#02554d;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Bekijk reactie
        </a>
        <p style="margin-top: 24px; font-size: 12px; color: #999;">
          Uitschrijven? Ga naar <a href="${BASE_URL}/account/settings">${BASE_URL}/account/settings</a>
        </p>
      </div>
    `;

    try {
      if (sendCount > 0) await delay(600);
      await resend.emails.send({
        from: 'Oracle Games <no-reply@send.oracle-games.online>',
        to: [userData.email],
        subject: `Nieuwe reactie op "${topicTitle}"`,
        html,
      });
      sendCount++;
    } catch (err) {
      console.error(`[FORUM-NOTIFY] Failed to send reply notification to ${uid}:`, err);
    }
  }
}

export interface DigestTopic {
  topicId: string;
  title: string;
  gameName: string;
  createdByName: string;
}

export async function sendDigestEmail(opts: {
  email: string;
  topics: DigestTopic[];
}): Promise<void> {
  const { email, topics } = opts;
  if (topics.length === 0) return;

  const resend = getResend();

  // Group topics by game
  const byGame = new Map<string, DigestTopic[]>();
  for (const t of topics) {
    if (!byGame.has(t.gameName)) byGame.set(t.gameName, []);
    byGame.get(t.gameName)!.push(t);
  }

  const groupsHtml = Array.from(byGame.entries())
    .map(([gameName, gameTopics]) => {
      const topicsHtml = gameTopics
        .map(
          (t) =>
            `<li style="margin-bottom: 6px;">
              <a href="${BASE_URL}/forum/topic/${t.topicId}" style="color: #02554d; font-weight: 600;">${t.title}</a>
              <span style="color: #999; font-size: 12px;"> — door ${t.createdByName}</span>
            </li>`,
        )
        .join('');
      return `<div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; color: #374151;">${gameName}</h3>
        <ul style="padding-left: 20px; margin: 0;">${topicsHtml}</ul>
      </div>`;
    })
    .join('');

  const n = topics.length;
  const subject =
    n === 1
      ? `1 nieuw forumtopic in jouw spellen`
      : `${n} nieuwe forumtopics in jouw spellen`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
      <h2 style="color: #02554d;">${subject}</h2>
      <p>In de afgelopen 24 uur zijn er nieuwe topics geplaatst in jouw spellen:</p>
      ${groupsHtml}
      <p style="margin-top: 24px; font-size: 12px; color: #999;">
        Uitschrijven? Ga naar <a href="${BASE_URL}/account/settings">${BASE_URL}/account/settings</a>
      </p>
    </div>
  `;

  await resend.emails.send({
    from: 'Oracle Games <no-reply@send.oracle-games.online>',
    to: [email],
    subject,
    html,
  });
}
