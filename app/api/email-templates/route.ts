import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import admin from 'firebase-admin';
import { EmailTemplate, EmailTemplateType } from '@/lib/types/admin';

export const dynamic = 'force-dynamic';

// Default templates with Dutch text (to be seeded on first load)
const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    type: 'birthday',
    name: 'Verjaardagsmail',
    description: 'Email die wordt verstuurd op de verjaardag van een gebruiker',
    translations: {
      nl: {
        subject: '🎉 Van harte gefeliciteerd met je {{age}}e verjaardag!',
        body: `Beste {{displayName}},

Van harte gefeliciteerd met je {{age}}e verjaardag! 🎂🎈

Het hele Oracle Games team wenst je een fantastische dag toe vol vreugde en geluk.{{riderMessage}}

Veel plezier vandaag! 🚴‍♂️

Met de beste wensen,
Het Oracle Games team`,
      },
    },
    variables: ['displayName', 'age', 'riderMessage'],
  },
  {
    type: 'message_single',
    name: 'Nieuw bericht (enkelvoud)',
    description: 'Email notificatie voor één nieuw bericht',
    translations: {
      nl: {
        subject: 'Nieuw bericht: {{messageSubject}}',
        body: `Hallo {{displayName}},

Je hebt een nieuw bericht ontvangen van {{senderName}}.

Onderwerp: {{messageSubject}}

Bericht:
{{messageContent}}

Log in op Oracle Games om je berichten te lezen:
{{baseUrl}}/inbox

Met vriendelijke groet,
Het Oracle Games team`,
      },
    },
    variables: ['displayName', 'senderName', 'messageSubject', 'messageContent', 'baseUrl'],
  },
  {
    type: 'message_multiple',
    name: 'Nieuwe berichten (meervoud)',
    description: 'Email notificatie voor meerdere nieuwe berichten',
    translations: {
      nl: {
        subject: 'Je hebt {{messageCount}} nieuwe berichten',
        body: `Hallo {{displayName}},

Je hebt {{messageCount}} nieuwe berichten ontvangen:

{{messageList}}

Log in op Oracle Games om je berichten te lezen:
{{baseUrl}}/inbox

Met vriendelijke groet,
Het Oracle Games team`,
      },
    },
    variables: ['displayName', 'messageCount', 'messageList', 'baseUrl'],
  },
  {
    type: 'budget_reminder',
    name: 'Budget herinnering',
    description: 'Email herinnering voor ongebruikt budget vlak voor sluiting veiling',
    translations: {
      nl: {
        subject: '💰 Je hebt nog veel budget over in "{{gameName}}"',
        body: `Hallo {{displayName}},

De veiling "{{periodName}}" in game "{{gameName}}" sluit over ongeveer {{hoursUntilClose}} uur!

Je hebt momenteel {{riderCount}} {{riderLabel}} in je team en nog €{{availableBudget}} ({{budgetPercentageRemaining}}%) van je budget beschikbaar.

{{bidsInfo}}

Vergeet niet om je resterende budget te gebruiken voordat de veiling sluit!

Log nu in om te bieden:
{{baseUrl}}/games/{{gameId}}

Met vriendelijke groet,
Het Oracle Games team`,
      },
    },
    variables: [
      'displayName',
      'periodName',
      'gameName',
      'hoursUntilClose',
      'riderCount',
      'riderLabel',
      'availableBudget',
      'budgetPercentageRemaining',
      'bidsInfo',
      'baseUrl',
      'gameId',
    ],
  },
];

async function verifyAdminUser(db: admin.firestore.Firestore, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.exists && userDoc.data()?.userType === 'admin';
}

/**
 * GET /api/email-templates
 * Get all email templates
 */
export async function GET(request: NextRequest) {
  try {
    const db = getServerFirebase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Verify admin
    const isAdmin = await verifyAdminUser(db, userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const templatesSnapshot = await db.collection('emailTemplates').get();

    // If no templates exist, seed the defaults
    if (templatesSnapshot.empty) {
      console.log('[EMAIL-TEMPLATES] No templates found, seeding defaults...');
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      for (const template of DEFAULT_TEMPLATES) {
        const docRef = db.collection('emailTemplates').doc(template.type);
        batch.set(docRef, {
          ...template,
          createdAt: now,
          updatedAt: now,
        });
      }

      await batch.commit();
      console.log('[EMAIL-TEMPLATES] Default templates seeded');

      // Fetch the newly created templates
      const newSnapshot = await db.collection('emailTemplates').get();
      const templates = newSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return NextResponse.json({ templates });
    }

    const templates = templatesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[EMAIL-TEMPLATES] Error fetching templates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/email-templates
 * Update an email template
 */
export async function PUT(request: NextRequest) {
  try {
    const db = getServerFirebase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Verify admin
    const isAdmin = await verifyAdminUser(db, userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { type, translations } = body as {
      type: EmailTemplateType;
      translations: EmailTemplate['translations'];
    };

    if (!type || !translations) {
      return NextResponse.json(
        { error: 'Missing required fields: type, translations' },
        { status: 400 }
      );
    }

    const docRef = db.collection('emailTemplates').doc(type);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await docRef.update({
      translations,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[EMAIL-TEMPLATES] Error updating template:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
