/**
 * Telegram notification utility
 * Sends notifications to a Telegram bot/chat
 */

interface TelegramMessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
}

/**
 * Send a message to Telegram
 */
export async function sendTelegramMessage(
  message: string,
  options: TelegramMessageOptions = {}
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

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

/**
 * Send a feedback notification to Telegram
 */
export async function sendFeedbackNotification(
  userEmail: string,
  userName: string,
  currentPage: string,
  message: string
): Promise<boolean> {
  const telegramMessage = `
🔔 <b>Nieuwe Feedback</b>

👤 <b>Van:</b> ${userName} (${userEmail})
📄 <b>Pagina:</b> ${currentPage}

💬 <b>Bericht:</b>
${message}

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

👤 <b>Gebruiker:</b> ${userName} (${userEmail})
⚙️ <b>Operatie:</b> ${operation}

❌ <b>Error:</b>
${errorMessage}
  `.trim();

  if (details?.gameId) {
    telegramMessage += `\n\n🎮 <b>Game ID:</b> ${details.gameId}`;
  }

  if (details?.endpoint) {
    telegramMessage += `\n🔗 <b>Endpoint:</b> ${details.endpoint}`;
  }

  if (details?.errorDetails) {
    // Limit stack trace to first 500 characters to avoid message too long
    const stackTrace = details.errorDetails.substring(0, 500);
    telegramMessage += `\n\n📋 <b>Stack trace:</b>\n<code>${stackTrace}</code>`;
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
  // Limit message preview to 200 characters
  const preview = messagePreview.length > 200
    ? messagePreview.substring(0, 200) + '...'
    : messagePreview;

  const telegramMessage = `
📨 <b>Nieuw Bericht</b>

👤 <b>Van:</b> ${senderName} (${senderEmail})
👥 <b>Aan:</b> ${recipientName}

📌 <b>Onderwerp:</b> ${subject}

💬 <b>Bericht:</b>
${preview}

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

👤 <b>Van:</b> ${senderName}
👥 <b>Ontvangers:</b> ${recipientCount} gebruikers

📌 <b>Onderwerp:</b> ${subject}

⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
  `.trim();

  return sendTelegramMessage(telegramMessage);
}
