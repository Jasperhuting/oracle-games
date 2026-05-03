import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/server';
import {
  getTelegramBridgeConfigs,
  getTelegramConfig,
  type TelegramBridgeConfig,
  type TelegramConfig,
} from '@/lib/telegram';

type TelegramUser = {
  id?: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramMessage = {
  text?: string;
  chat?: { id?: number | string; type?: string; title?: string };
  from?: TelegramUser;
  reply_to_message?: { text?: string };
};

type WebhookBotKind = 'default' | 'bridge';

type ResolvedWebhookConfig = {
  kind: WebhookBotKind;
  botToken: string | null;
  chatId: string | null;
  webhookSecret: string | null;
  adminUserId: string | null;
  bridgeRoomId?: string;
};

function extractFeedbackIdFromText(text: string): string | null {
  const match = text.match(/Feedback ID:\s*([A-Za-z0-9_-]+)/i);
  if (match?.[1]) return match[1];
  return null;
}

function parseReplyCommand(text: string): { feedbackId: string; replyText: string } | null {
  const match = text.match(/^\/(reply|r)\s+(\S+)\s+([\s\S]+)$/i);
  if (!match) return null;
  return { feedbackId: match[2], replyText: match[3].trim() };
}

function getTelegramSenderName(sender?: TelegramUser): string {
  const fullName = [sender?.first_name, sender?.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (sender?.username) return `@${sender.username}`;
  if (sender?.id) return `Telegram ${sender.id}`;
  return 'Telegram gebruiker';
}

async function resolveChatBridgeUser(config: ResolvedWebhookConfig) {
  const fallbackAdminId = getTelegramConfig().adminUserId;
  const preferredUserId = config.adminUserId || fallbackAdminId;

  if (preferredUserId) {
    const userDoc = await adminDb.collection('users').doc(preferredUserId).get();
    if (userDoc.exists) {
      return {
        id: userDoc.id,
        data: userDoc.data() || {},
      };
    }
  }

  return null;
}

function getPreferredProfileName(profile: Record<string, unknown> | undefined, fallback = 'Anoniem'): string {
  return String(
    profile?.playername ||
    profile?.displayName ||
    profile?.email ||
    fallback
  );
}

function getPreferredProfileAvatar(profile: Record<string, unknown> | undefined): string | null {
  const avatar = profile?.avatarUrl;
  return typeof avatar === 'string' && avatar.trim() ? avatar : null;
}

async function resolveAdminUser() {
  const { adminUserId } = getTelegramConfig();

  if (adminUserId) {
    const adminDoc = await adminDb.collection('users').doc(adminUserId).get();
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
  const { botToken } = getTelegramConfig();
  if (!botToken) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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

async function handleFeedbackReply(
  text: string,
  message: TelegramMessage,
  chatId: string | number
) {
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
    return false;
  }

  const feedbackDoc = await adminDb.collection('feedback').doc(feedbackId).get();
  if (!feedbackDoc.exists) {
    return true;
  }

  const feedbackData = feedbackDoc.data();
  const feedbackUserId = feedbackData?.userId;
  const feedbackUserEmail = feedbackData?.userEmail;

  if (!feedbackUserId) {
    return true;
  }

  const adminDoc = await resolveAdminUser();
  if (!adminDoc) {
    throw new Error('Admin user not found');
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

  return true;
}

async function handleChatBridge(
  text: string,
  message: TelegramMessage,
  config: ResolvedWebhookConfig
) {
  const bridgeRoomId = config.bridgeRoomId;
  const sender = message.from;

  if (!bridgeRoomId || sender?.is_bot) {
    return;
  }

  const roomRef = adminDb.collection('chat_rooms').doc(bridgeRoomId);
  const roomDoc = await roomRef.get();
  if (!roomDoc.exists) {
    throw new Error(`Chat room ${bridgeRoomId} not found`);
  }

  const roomData = roomDoc.data();
  if (roomData?.status === 'closed') {
    return;
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return;
  }

  const bridgeUser = await resolveChatBridgeUser(config);
  const senderId = bridgeUser?.id || (sender?.id ? `telegram:${sender.id}` : 'telegram:unknown');
  const senderName = bridgeUser
    ? getPreferredProfileName(bridgeUser.data, 'Anoniem')
    : getTelegramSenderName(sender);
  const userAvatar = bridgeUser
    ? getPreferredProfileAvatar(bridgeUser.data)
    : null;

  await roomRef.collection('messages').add({
    text: trimmedText,
    giphy: null,
    userId: senderId,
    userName: senderName,
    userAvatar,
    replyTo: null,
    reactions: {},
    deleted: false,
    createdAt: Timestamp.now(),
    source: 'telegram',
    sourceMeta: {
      telegramChatId: message.chat?.id ? String(message.chat.id) : null,
      telegramUserId: sender?.id ? String(sender.id) : null,
      telegramUsername: sender?.username || null,
    },
  });

  await roomRef.update({
    messageCount: FieldValue.increment(1),
  });
}

function normalizeDefaultConfig(config: TelegramConfig): ResolvedWebhookConfig {
  return {
    kind: 'default',
    botToken: config.botToken,
    chatId: config.chatId,
    webhookSecret: config.webhookSecret,
    adminUserId: config.adminUserId,
  };
}

function normalizeBridgeConfig(config: TelegramBridgeConfig): ResolvedWebhookConfig {
  return {
    kind: 'bridge',
    botToken: config.botToken,
    chatId: config.chatId,
    webhookSecret: config.webhookSecret,
    adminUserId: config.adminUserId,
    bridgeRoomId: config.bridgeRoomId,
  };
}

function resolveWebhookConfig(request: NextRequest): ResolvedWebhookConfig | null {
  const defaultConfig = normalizeDefaultConfig(getTelegramConfig());
  const bridgeConfigs = getTelegramBridgeConfigs().map(normalizeBridgeConfig);
  const header = request.headers.get('x-telegram-bot-api-secret-token');

  if (header) {
    const matchedBridgeConfig = bridgeConfigs.find(
      (config) => config.webhookSecret && header === config.webhookSecret
    );
    if (matchedBridgeConfig) {
      return matchedBridgeConfig;
    }
    if (defaultConfig.webhookSecret && header === defaultConfig.webhookSecret) {
      return defaultConfig;
    }
    return null;
  }

  const bridgeWithoutSecret = bridgeConfigs.find(
    (config) => !config.webhookSecret && config.botToken && config.chatId
  );
  if (bridgeWithoutSecret) {
    return bridgeWithoutSecret;
  }

  if (!defaultConfig.webhookSecret && defaultConfig.botToken && defaultConfig.chatId) {
    return defaultConfig;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const webhookConfig = resolveWebhookConfig(request);
    if (!webhookConfig) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update = await request.json();
    const message: TelegramMessage | undefined = update?.message;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat?.id;
    if (webhookConfig.chatId && `${chatId}` !== `${webhookConfig.chatId}`) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const text = message.text?.trim();
    if (!text) {
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/') && !/^\/(reply|r)\b/i.test(text)) {
      return NextResponse.json({ ok: true });
    }

    if (webhookConfig.kind === 'default') {
      await handleFeedbackReply(text, message, chatId || '');
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/')) {
      return NextResponse.json({ ok: true });
    }

    await handleChatBridge(text, message, webhookConfig);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TELEGRAM_WEBHOOK] Error processing update:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
