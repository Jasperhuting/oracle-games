/**
 * Script to add Scripts section translations to Firestore
 * Run with: node scripts/add-scripts-translations.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const translations = {
  nl: {
    account: {
      scripts: {
        title: 'Scripts',
        description: 'Voeg renners toe aan de huidige rankings door een ProCyclingStats URL in te voeren. Je kunt maximaal 5 renners per dag toevoegen.',
        dailyUsage: 'Dagelijks gebruik',
        remainingToday: 'Nog {{count}} beschikbaar vandaag',
        limitReached: 'Dagelijkse limiet bereikt. Probeer het morgen opnieuw.',
        procyclingUrl: 'ProCyclingStats URL',
        urlRequired: 'URL is verplicht',
        urlHelp: 'Plak de ProCyclingStats URL van de renner',
        adding: 'Toevoegen...',
        addRider: 'Voeg renner toe',
        riderAdded: 'Renner succesvol toegevoegd!',
        rateLimitReached: 'Dagelijkse limiet bereikt',
        errorOccurred: 'Er is een fout opgetreden',
        recentActivity: 'Recente activiteit',
      }
    }
  },
  en: {
    account: {
      scripts: {
        title: 'Scripts',
        description: 'Add riders to the current rankings by entering a ProCyclingStats URL. You can add a maximum of 5 riders per day.',
        dailyUsage: 'Daily usage',
        remainingToday: '{{count}} remaining today',
        limitReached: 'Daily limit reached. Please try again tomorrow.',
        procyclingUrl: 'ProCyclingStats URL',
        urlRequired: 'URL is required',
        urlHelp: 'Paste the ProCyclingStats URL of the rider',
        adding: 'Adding...',
        addRider: 'Add rider',
        riderAdded: 'Rider successfully added!',
        rateLimitReached: 'Daily limit reached',
        errorOccurred: 'An error occurred',
        recentActivity: 'Recent activity',
      }
    }
  }
};

async function addTranslations() {
  try {
    console.log('Adding Scripts translations to Firestore...');

    // Add Dutch translations
    const nlRef = db.collection('translations').doc('nl');
    const nlDoc = await nlRef.get();
    const nlData = nlDoc.exists ? nlDoc.data() : {};

    await nlRef.set({
      ...nlData,
      account: {
        ...(nlData.account || {}),
        scripts: translations.nl.account.scripts
      }
    }, { merge: true });

    console.log('✓ Dutch translations added');

    // Add English translations
    const enRef = db.collection('translations').doc('en');
    const enDoc = await enRef.get();
    const enData = enDoc.exists ? enDoc.data() : {};

    await enRef.set({
      ...enData,
      account: {
        ...(enData.account || {}),
        scripts: translations.en.account.scripts
      }
    }, { merge: true });

    console.log('✓ English translations added');

    console.log('\nTranslations successfully added to Firestore!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding translations:', error);
    process.exit(1);
  }
}

addTranslations();
