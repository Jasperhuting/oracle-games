import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const TELEGRAM_ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_USER_ID;

type TelegramMessage = {
  text?: string;
  chat?: { id?: number | string };
  reply_to_message?: { text?: string };
};

function extractFeedbackIdFromText(text: string): string | null {
  const match = text.match(/Feedback ID:\s*([A-Za-z0-9_-]+)/i);
  if (match?.[1]) return match[1];
  const fallback = text.match(/\b([A-Za-z0-9_-]{16,})\b/);
  return fallback?.[1] || null;
}

function parseReplyCommand(text: string): { feedbackId: string; replyText: string } | null {
  const match = text.match(/^\/(reply|r)\s+(\S+)\s+([\s\S]+)$/i);
  if (!match) return null;
  return { feedbackId: match[2], replyText: match[3].trim() };
}

async function resolveAdminUser() {
  if (TELEGRAM_ADMIN_USER_ID) {
    const adminDoc = await adminDb.collection('users').doc(TELEGRAM_ADMIN_USER_ID).get();
    if (adminDoc.exists) return adminDoc;
  }

  const admins = await adminDb
    .collection('users')
    .where('userType', '==', 'admin')
    .limit(1)
    .get();

  return admins.docs[0] || null;
}

async function sendTelegramReply(chatId: string | number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error('[TELEGRAM_WEBHOOK] Failed to send confirmation:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (TELEGRAM_WEBHOOK_SECRET) {
      const header = request.headers.get('x-telegram-bot-api-secret-token');
      if (header !== TELEGRAM_WEBHOOK_SECRET) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }

    const update = await request.json();
    const message: TelegramMessage | undefined = update?.message || update?.edited_message;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat?.id;
    if (TELEGRAM_CHAT_ID && `${chatId}` !== `${TELEGRAM_CHAT_ID}`) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const text = message.text?.trim();
    if (!text) {
      return NextResponse.json({ ok: true });
    }

    let feedbackId: string | null = null;
    let replyText: string | null = null;

    const command = parseReplyCommand(text);
    if (command) {
      feedbackId = command.feedbackId;
      replyText = command.replyText;
    } else if (message.reply_to_message?.text) {
      feedbackId = extractFeedbackIdFromText(message.reply_to_message.text);
      replyText = text;
    }

    if (!feedbackId || !replyText) {
      return NextResponse.json({ ok: true });
    }

    const feedbackDoc = await adminDb.collection('feedback').doc(feedbackId).get();
    if (!feedbackDoc.exists) {
      return NextResponse.json({ ok: true });
    }

    const feedbackData = feedbackDoc.data();
    const feedbackUserId = feedbackData?.userId;
    const feedbackUserEmail = feedbackData?.userEmail;

    if (!feedbackUserId) {
      return NextResponse.json({ ok: true });
    }

    const adminDoc = await resolveAdminUser();
    if (!adminDoc) {
      return NextResponse.json({ ok: false, error: 'Admin user not found' }, { status: 500 });
    }

    const adminId = adminDoc.id;
    const adminName = adminDoc.data()?.displayName || adminDoc.data()?.email || 'Admin';

    const messageRef = adminDb.collection('messages').doc();
    await messageRef.set({
      type: 'individual',
      senderId: adminId,
      senderName: adminName,
      recipientId: feedbackUserId,
      recipientName: feedbackUserEmail || 'User',
      subject: 'Response to your feedback',
      message: `Antwoord op je feedback:\n\n${replyText}`,
      sentAt: Timestamp.now(),
      read: false,
    });

    await adminDb.collection('feedback').doc(feedbackId).update({
      adminResponse: replyText,
      adminResponseDate: Timestamp.now(),
      status: 'reviewed',
    });

    await adminDb.collection('activityLogs').doc().set({
      action: 'FEEDBACK_REPLY_TELEGRAM',
      userId: adminId,
      userName: adminName,
      targetUserId: feedbackUserId,
      details: {
        feedbackId,
        messageId: messageRef.id,
      },
      timestamp: Timestamp.now(),
    });

    if (chatId) {
      await sendTelegramReply(
        chatId,
        `✅ Antwoord verzonden en opgeslagen voor feedback <code>${feedbackId}</code>.`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TELEGRAM_WEBHOOK] Error processing update:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
