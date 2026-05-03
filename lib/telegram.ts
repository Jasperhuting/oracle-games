/**
 * Telegram notification utility
 * Sends notifications to a Telegram bot/chat
 */

interface TelegramMessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
}

export interface TelegramConfig {
  botToken: string | null;
  chatId: string | null;
  webhookSecret: string | null;
  adminUserId: string | null;
}

export interface TelegramBridgeConfig {
  key: string;
  botToken: string | null;
  chatId: string | null;
  webhookSecret: string | null;
  bridgeRoomId: string;
  adminUserId: string | null;
}

interface ChatBridgeMessageOptions {
  roomTitle: string;
  userName: string;
  text: string;
  roomId?: string;
}

const DEFAULT_TELEGRAM_BRIDGE_ROOM_ID = 'tHgkj5j0vZDu5nHg2LVf';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getTelegramConfig(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || null,
    chatId: process.env.TELEGRAM_CHAT_ID || null,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || null,
    adminUserId: process.env.TELEGRAM_ADMIN_USER_ID || null,
  };
}

export function getTelegramBridgeConfig(): TelegramBridgeConfig {
  return {
    key: 'default',
    botToken: process.env.TELEGRAM_BRIDGE_BOT_TOKEN || null,
    chatId: process.env.TELEGRAM_BRIDGE_CHAT_ID || null,
    webhookSecret: process.env.TELEGRAM_BRIDGE_WEBHOOK_SECRET || null,
    bridgeRoomId: process.env.TELEGRAM_BRIDGE_ROOM_ID || DEFAULT_TELEGRAM_BRIDGE_ROOM_ID,
    adminUserId: process.env.TELEGRAM_BRIDGE_ADMIN_USER_ID || null,
  };
}

export function getTelegramFootballBridgeConfig(): TelegramBridgeConfig {
  return {
    key: 'football',
    botToken: process.env.TELEGRAM_FOOTBALL_BRIDGE_BOT_TOKEN || null,
    chatId: process.env.TELEGRAM_FOOTBALL_BRIDGE_CHAT_ID || null,
    webhookSecret: process.env.TELEGRAM_FOOTBALL_BRIDGE_WEBHOOK_SECRET || null,
    bridgeRoomId: process.env.TELEGRAM_FOOTBALL_BRIDGE_ROOM_ID || '',
    adminUserId: process.env.TELEGRAM_FOOTBALL_BRIDGE_ADMIN_USER_ID || null,
  };
}

export function getTelegramBridgeConfigs(): TelegramBridgeConfig[] {
  return [getTelegramBridgeConfig(), getTelegramFootballBridgeConfig()]
    .filter((config) => Boolean(config.botToken && config.chatId && config.webhookSecret && config.bridgeRoomId));
}

export function getTelegramBridgeConfigForRoom(roomId: string): TelegramBridgeConfig | null {
  return getTelegramBridgeConfigs().find((config) => config.bridgeRoomId === roomId) || null;
}

/**
 * Send a message to Telegram
 */
export async function sendTelegramMessage(
  message: string,
  options: TelegramMessageOptions = {}
): Promise<boolean> {
  const { botToken, chatId } = getTelegramConfig();

  if (!botToken || !chatId) {
    console.error('Telegram credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: options.parse_mode || 'HTML',
          disable_web_page_preview: options.disable_web_page_preview ?? true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

export async function sendTelegramBridgeMessage(
  message: string,
  options: TelegramMessageOptions = {},
  bridgeConfig: TelegramBridgeConfig = getTelegramBridgeConfig()
): Promise<boolean> {
  const { botToken, chatId } = bridgeConfig;

  if (!botToken || !chatId) {
    console.error('Telegram bridge credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: options.parse_mode || 'HTML',
          disable_web_page_preview: options.disable_web_page_preview ?? true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram bridge API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram bridge message:', error);
    return false;
  }
}

export async function sendChatRoomBridgeMessage(
  options: ChatBridgeMessageOptions,
  bridgeConfig: TelegramBridgeConfig
): Promise<boolean> {
  const safeText = options.text.trim();
  if (!safeText) {
    return false;
  }

  const telegramMessage = `
💬 <b>${escapeHtml(options.roomTitle)}</b>

<b>${escapeHtml(options.userName)}:</b>
${escapeHtml(safeText)}

${options.roomId ? `🆔 <code>${escapeHtml(options.roomId)}</code>\n` : ''}⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
  `.trim();

  return sendTelegramBridgeMessage(telegramMessage, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }, bridgeConfig);
}

/**
 * Send a feedback notification to Telegram
 */
export async function sendFeedbackNotification(
  feedbackId: string,
  userEmail: string,
  userName: string,
  currentPage: string,
  message: string
): Promise<boolean> {
  const telegramMessage = `
🔔 <b>Nieuwe Feedback</b>

👤 <b>Van:</b> ${escapeHtml(userName)} (${escapeHtml(userEmail)})
📄 <b>Pagina:</b> ${escapeHtml(currentPage)}

💬 <b>Bericht:</b>
${escapeHtml(message)}

🆔 <b>Feedback ID:</b> ${escapeHtml(feedbackId)}
↩️ <b>Antwoord via Telegram:</b> /reply ${escapeHtml(feedbackId)} &lt;bericht&gt;

⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
  `.trim();

  return sendTelegramMessage(telegramMessage);
}

/**
 * Send an error notification to Telegram
 */
export async function sendErrorNotification(
  userEmail: string,
  userName: string,
  operation: string,
  errorMessage: string,
  details?: {
    gameId?: string;
    endpoint?: string;
    errorDetails?: string;
  }
): Promise<boolean> {
  let telegramMessage = `
🚨 <b>Error Log</b>

👤 <b>Gebruiker:</b> ${escapeHtml(userName)} (${escapeHtml(userEmail)})
⚙️ <b>Operatie:</b> ${escapeHtml(operation)}

❌ <b>Error:</b>
${escapeHtml(errorMessage)}
  `.trim();

  if (details?.gameId) {
    telegramMessage += `\n\n🎮 <b>Game ID:</b> ${escapeHtml(details.gameId)}`;
  }

  if (details?.endpoint) {
    telegramMessage += `\n🔗 <b>Endpoint:</b> ${escapeHtml(details.endpoint)}`;
  }

  if (details?.errorDetails) {
    // Limit stack trace to 3500 characters to stay within Telegram's 4096 limit
    const stackTrace = details.errorDetails.substring(0, 3500);
    telegramMessage += `\n\n📋 <b>Stack trace:</b>\n<code>${escapeHtml(stackTrace)}</code>`;
  }

  telegramMessage += `\n\n⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`;

  return sendTelegramMessage(telegramMessage);
}

/**
 * Send a new message notification to Telegram
 */
export async function sendMessageNotification(
  senderName: string,
  senderEmail: string,
  recipientName: string,
  subject: string,
  messagePreview: string
): Promise<boolean> {
  // Limit message preview to 3500 characters to stay within Telegram's 4096 limit
  const preview = messagePreview.length > 3500
    ? messagePreview.substring(0, 3500) + '...'
    : messagePreview;

  const telegramMessage = `
📨 <b>Nieuw Bericht</b>

👤 <b>Van:</b> ${escapeHtml(senderName)} (${escapeHtml(senderEmail)})
👥 <b>Aan:</b> ${escapeHtml(recipientName)}

📌 <b>Onderwerp:</b> ${escapeHtml(subject)}

💬 <b>Bericht:</b>
${escapeHtml(preview)}

⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
  `.trim();

  return sendTelegramMessage(telegramMessage);
}

/**
 * Send a broadcast message notification to Telegram
 */
export async function sendBroadcastNotification(
  senderName: string,
  subject: string,
  recipientCount: number
): Promise<boolean> {
  const telegramMessage = `
📢 <b>Broadcast Bericht</b>

👤 <b>Van:</b> ${escapeHtml(senderName)}
👥 <b>Ontvangers:</b> ${recipientCount} gebruikers

📌 <b>Onderwerp:</b> ${escapeHtml(subject)}

⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
  `.trim();

  return sendTelegramMessage(telegramMessage);
}

/**
 * Send a rider script notification to Telegram
 */
export async function sendRiderScriptNotification(
  userName: string,
  userEmail: string,
  riderName: string,
  riderUrl: string,
  year: number,
  success: boolean,
  errorMessage?: string
): Promise<boolean> {
  const statusIcon = success ? '✅' : '❌';
  const statusText = success ? 'Succesvol toegevoegd' : 'Mislukt';

  let telegramMessage = `
${statusIcon} <b>Rider Script ${statusText}</b>

👤 <b>Gebruiker:</b> ${escapeHtml(userName)} (${escapeHtml(userEmail)})
🚴 <b>Renner:</b> ${escapeHtml(riderName)}
🔗 <b>URL:</b> ${escapeHtml(riderUrl)}
📅 <b>Jaar:</b> ${year}
  `.trim();

  if (!success && errorMessage) {
    telegramMessage += `\n\n❌ <b>Fout:</b>\n${escapeHtml(errorMessage)}`;
  }

  telegramMessage += `\n\n⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`;

  return sendTelegramMessage(telegramMessage);
}

/**
 * Send a chat summary notification to Telegram
 */
export async function sendChatSummaryNotification(
  roomTitle: string,
  messages: { userName: string; text: string }[],
  roomId?: string
): Promise<boolean> {
  const maxMessages = 20;
  const shown = messages.slice(0, maxMessages);
  const remaining = messages.length - shown.length;

  const messageLines = shown.map(
    (m) => `  <b>${escapeHtml(m.userName)}:</b> ${escapeHtml(m.text.length > 100 ? m.text.slice(0, 100) + '...' : m.text)}`
  ).join('\n');

  let telegramMessage = `
💬 <b>Chat Update: ${escapeHtml(roomTitle)}</b>

📊 ${messages.length} nieuwe berichten

${messageLines}`;

  if (roomId) {
    telegramMessage += `\n\n🆔 <code>${escapeHtml(roomId)}</code>`;
  }

  if (remaining > 0) {
    telegramMessage += `\n  ... en ${remaining} meer`;
  }

  telegramMessage += `\n\n⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`;

  return sendTelegramMessage(telegramMessage.trim());
}

/**
 * Send a rate limit notification to Telegram
 */
export async function sendRateLimitNotification(
  userName: string,
  userEmail: string,
  action: string,
  limit: number,
  currentCount: number
): Promise<boolean> {
  const telegramMessage = `
⚠️ <b>Rate Limit Bereikt</b>

👤 <b>Gebruiker:</b> ${escapeHtml(userName)} (${escapeHtml(userEmail)})
⚙️ <b>Actie:</b> ${escapeHtml(action)}
📊 <b>Limiet:</b> ${limit} per dag
📈 <b>Gebruikt:</b> ${currentCount}

⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
  `.trim();

  return sendTelegramMessage(telegramMessage);
}
