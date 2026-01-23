import { Resend } from 'resend';
import { getServerFirebase } from '@/lib/firebase/server';

export type AdminNotificationType =
  | 'scrape_failed'
  | 'validation_failed'
  | 'calculation_error'
  | 'low_rider_count'
  | 'rollback_performed'
  | 'points_override';

export interface AdminNotificationPayload {
  race?: string;
  stage?: number | string;
  year?: number;
  error?: string;
  details?: Record<string, unknown>;
  userId?: string;
  gameId?: string;
}

interface NotificationTemplate {
  subject: string;
  body: string;
}

const NOTIFICATION_TEMPLATES: Record<AdminNotificationType, (payload: AdminNotificationPayload) => NotificationTemplate> = {
  scrape_failed: (p) => ({
    subject: `[ALERT] Scrape Failed: ${p.race || 'Unknown'} ${p.stage ? `Stage ${p.stage}` : ''}`,
    body: `
      <h2>Scrape Failed</h2>
      <p>The scraper failed for <strong>${p.race || 'Unknown'}</strong> ${p.stage ? `stage ${p.stage}` : ''} (${p.year || 'Unknown year'}).</p>
      ${p.error ? `<p><strong>Error:</strong> ${p.error}</p>` : ''}
      <p>Please check the admin dashboard for details.</p>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://oracle-games.online'}/admin/races">Go to Race Management</a></p>
    `,
  }),

  validation_failed: (p) => ({
    subject: `[WARNING] Validation Failed: ${p.race || 'Unknown'} ${p.stage ? `Stage ${p.stage}` : ''}`,
    body: `
      <h2>Data Validation Failed</h2>
      <p>Scraped data for <strong>${p.race || 'Unknown'}</strong> ${p.stage ? `stage ${p.stage}` : ''} (${p.year || 'Unknown year'}) failed validation.</p>
      ${p.error ? `<p><strong>Reason:</strong> ${p.error}</p>` : ''}
      ${p.details ? `<p><strong>Details:</strong></p><pre>${JSON.stringify(p.details, null, 2)}</pre>` : ''}
      <p>The data was NOT saved. Manual intervention may be required.</p>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://oracle-games.online'}/admin/races">Go to Race Management</a></p>
    `,
  }),

  calculation_error: (p) => ({
    subject: `[ERROR] Points Calculation Failed: ${p.race || 'Unknown'} ${p.stage ? `Stage ${p.stage}` : ''}`,
    body: `
      <h2>Points Calculation Error</h2>
      <p>Points calculation failed for <strong>${p.race || 'Unknown'}</strong> ${p.stage ? `stage ${p.stage}` : ''} (${p.year || 'Unknown year'}).</p>
      ${p.error ? `<p><strong>Error:</strong> ${p.error}</p>` : ''}
      ${p.gameId ? `<p><strong>Game ID:</strong> ${p.gameId}</p>` : ''}
      <p>Player points may not have been updated correctly.</p>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://oracle-games.online'}/admin/races">Go to Race Management</a></p>
    `,
  }),

  low_rider_count: (p) => ({
    subject: `[WARNING] Low Rider Count: ${p.race || 'Unknown'} ${p.stage ? `Stage ${p.stage}` : ''}`,
    body: `
      <h2>Low Rider Count Warning</h2>
      <p>Only <strong>${p.details?.riderCount || 'few'}</strong> riders found for <strong>${p.race || 'Unknown'}</strong> ${p.stage ? `stage ${p.stage}` : ''} (${p.year || 'Unknown year'}).</p>
      <p>Expected minimum: ${p.details?.expectedMin || 50}</p>
      <p>Please verify the scraper is working correctly.</p>
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://oracle-games.online'}/admin/races">Go to Race Management</a></p>
    `,
  }),

  rollback_performed: (p) => ({
    subject: `[INFO] Rollback Performed: ${p.race || 'Unknown'} ${p.stage ? `Stage ${p.stage}` : ''}`,
    body: `
      <h2>Data Rollback Performed</h2>
      <p>A rollback was performed for <strong>${p.race || 'Unknown'}</strong> ${p.stage ? `stage ${p.stage}` : ''} (${p.year || 'Unknown year'}).</p>
      ${p.userId ? `<p><strong>Performed by:</strong> ${p.userId}</p>` : ''}
      ${p.details?.reason ? `<p><strong>Reason:</strong> ${p.details.reason}</p>` : ''}
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://oracle-games.online'}/admin/races">Go to Race Management</a></p>
    `,
  }),

  points_override: (p) => ({
    subject: `[INFO] Points Override: ${p.gameId || 'Unknown Game'}`,
    body: `
      <h2>Manual Points Override</h2>
      <p>A manual points override was performed.</p>
      ${p.gameId ? `<p><strong>Game ID:</strong> ${p.gameId}</p>` : ''}
      ${p.userId ? `<p><strong>Performed by:</strong> ${p.userId}</p>` : ''}
      ${p.details ? `<p><strong>Details:</strong></p><pre>${JSON.stringify(p.details, null, 2)}</pre>` : ''}
      <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://oracle-games.online'}/admin">Go to Admin</a></p>
    `,
  }),
};

/**
 * Get all admin email addresses
 */
async function getAdminEmails(): Promise<string[]> {
  const db = getServerFirebase();
  const adminsSnapshot = await db
    .collection('users')
    .where('userType', '==', 'admin')
    .get();

  const emails: string[] = [];
  adminsSnapshot.forEach((doc) => {
    const email = doc.data().email;
    if (email) {
      emails.push(email);
    }
  });

  return emails;
}

/**
 * Log notification to Firestore
 */
async function logNotification(
  type: AdminNotificationType,
  payload: AdminNotificationPayload,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    const db = getServerFirebase();
    await db.collection('adminNotifications').add({
      type,
      payload,
      success,
      error: error || null,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ADMIN_NOTIFICATIONS] Failed to log notification:', err);
  }
}

/**
 * Send admin notification email
 */
export async function sendAdminNotification(
  type: AdminNotificationType,
  payload: AdminNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get admin emails
    const adminEmails = await getAdminEmails();

    if (adminEmails.length === 0) {
      console.warn('[ADMIN_NOTIFICATIONS] No admin emails found');
      await logNotification(type, payload, false, 'No admin emails found');
      return { success: false, error: 'No admin emails found' };
    }

    // Get template
    const templateFn = NOTIFICATION_TEMPLATES[type];
    if (!templateFn) {
      console.error(`[ADMIN_NOTIFICATIONS] Unknown notification type: ${type}`);
      await logNotification(type, payload, false, `Unknown notification type: ${type}`);
      return { success: false, error: `Unknown notification type: ${type}` };
    }

    const template = templateFn(payload);

    // Check for Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[ADMIN_NOTIFICATIONS] RESEND_API_KEY not configured');
      await logNotification(type, payload, false, 'RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }

    // Send email
    const resend = new Resend(resendApiKey);

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'alerts@send.oracle-games.online';

    const { error } = await resend.emails.send({
      from: `Oracle Games Alerts <${fromEmail}>`,
      to: adminEmails,
      subject: template.subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            h2 { color: #1a1a1a; margin-bottom: 16px; }
            p { margin: 8px 0; }
            pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
            a { color: #0066cc; }
          </style>
        </head>
        <body>
          ${template.body}
          <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from Oracle Games.
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[ADMIN_NOTIFICATIONS] Failed to send email:', error);
      await logNotification(type, payload, false, error.message);
      return { success: false, error: error.message };
    }

    console.log(`[ADMIN_NOTIFICATIONS] Sent ${type} notification to ${adminEmails.length} admins`);
    await logNotification(type, payload, true);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ADMIN_NOTIFICATIONS] Error sending notification:', err);
    await logNotification(type, payload, false, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if notifications are enabled (for conditional sending)
 */
export function isNotificationsEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}
