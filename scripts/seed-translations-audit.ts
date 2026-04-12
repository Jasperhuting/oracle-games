/**
 * Seed script: voegt ontbrekende vertalingen toe na de vertaal-audit.
 *
 * Gebruik: npx ts-node -r tsconfig-paths/register scripts/seed-translations-audit.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Ontbrekende Firebase credentials in .env.local');
    process.exit(1);
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

const db = getFirestore();

const nlKeys: Record<string, string> = {
  // activeGames
  'activeGames.lastUpdate': 'Laatste update',

  // inbox
  'inbox.title': 'Inbox',
  'inbox.viewAll': 'Bekijk alles',
  'inbox.unreadCount': '{{count}} ongelezen berichten',
  'inbox.noSubject': '(geen onderwerp)',
  'inbox.noMessages': 'Geen ongelezen berichten',

  // account - avatar / profile
  'account.uploadingAvatar': 'Avatar wordt opgeslagen...',
  'account.avatarUpdateFailed': 'Kon avatar niet bijwerken',
  'account.avatarUpdated': 'Avatar succesvol bijgewerkt',
  'account.uploadError': 'Er is iets misgegaan bij het uploaden',
  'account.updateFailed': 'Kon gegevens niet bijwerken',
  'account.profileUpdated': 'Gegevens succesvol bijgewerkt',
  'account.updateError': 'Er is iets misgegaan bij het bijwerken',

  // account - forum notifications
  'account.forumNotifications': 'Forumnotificaties',
  'account.forumReplyLabel': 'Reacties op mijn topics',
  'account.forumReplyDescription': 'Ontvang een e-mail als iemand reageert op een topic waar jij in hebt gepost',
  'account.forumDigestLabel': 'Dagelijkse samenvatting',
  'account.forumDigestDescription': 'Ontvang elke ochtend een overzicht van nieuwe topics in je spellen',

  // form validation
  'validation.firstNameMaxLength': 'Voornaam mag niet meer dan 50 tekens bevatten',
  'validation.lastNameMaxLength': 'Achternaam mag niet meer dan 50 tekens bevatten',
  'validation.playerNameRequired': 'Spelersnaam is verplicht',
  'validation.playerNameMinLength': 'Spelersnaam moet minimaal 2 tekens lang zijn',
  'validation.playerNameMaxLength': 'Spelersnaam mag niet meer dan 50 tekens bevatten',
  'validation.minAge': 'Je moet minimaal 13 jaar oud zijn',
  'validation.invalidBirthdate': 'Ongeldige geboortedatum',

  // onboarding
  'onboarding.saveError': 'Er is iets misgegaan. Probeer het opnieuw.',
  'onboarding.welcomeTitle': 'Welkom bij Oracle Games!',
  'onboarding.welcomeSubtitle': 'Je account is aangemaakt. Maak je profiel even compleet - dit duurt minder dan een minuut.',
  'onboarding.profilePhoto': 'Profielfoto',
  'onboarding.profilePhotoDescription': 'Laat anderen zien wie je bent',
  'onboarding.saveAndContinue': 'Opslaan en verder',
  'onboarding.later': 'Later',
  'onboarding.settingsNote': 'Je kunt dit altijd later aanpassen via Instellingen',

  // login
  'login.emailNotVerified': 'Je email is nog niet geverifieerd. Controleer je inbox (en spamfolder) voor de verificatielink.',
  'login.tooManyRequests': 'Te veel verzoeken. Wacht even voordat je het opnieuw probeert.',
  'login.resendError': 'Er ging iets mis bij het versturen van de email. Probeer het later opnieuw.',
  'login.verificationSent': 'Verificatie email verstuurd! Controleer je inbox.',
  'login.sending': 'Bezig met versturen...',
  'login.resendVerification': 'Verificatie email opnieuw versturen',

  // register
  'register.domainBlocked': 'Registratie met dit e-maildomein is niet toegestaan',
};

const enKeys: Record<string, string> = {
  // activeGames
  'activeGames.lastUpdate': 'Last update',

  // inbox
  'inbox.title': 'Inbox',
  'inbox.viewAll': 'View all',
  'inbox.unreadCount': '{{count}} unread messages',
  'inbox.noSubject': '(no subject)',
  'inbox.noMessages': 'No unread messages',

  // account - avatar / profile
  'account.uploadingAvatar': 'Saving avatar...',
  'account.avatarUpdateFailed': 'Could not update avatar',
  'account.avatarUpdated': 'Avatar updated successfully',
  'account.uploadError': 'Something went wrong uploading',
  'account.updateFailed': 'Could not update your data',
  'account.profileUpdated': 'Profile updated successfully',
  'account.updateError': 'Something went wrong updating',

  // account - forum notifications
  'account.forumNotifications': 'Forum notifications',
  'account.forumReplyLabel': 'Replies to my topics',
  'account.forumReplyDescription': 'Receive an email when someone replies to a topic you posted in',
  'account.forumDigestLabel': 'Daily digest',
  'account.forumDigestDescription': 'Receive a daily overview of new topics in your games each morning',

  // form validation
  'validation.firstNameMaxLength': 'First name may not exceed 50 characters',
  'validation.lastNameMaxLength': 'Last name may not exceed 50 characters',
  'validation.playerNameRequired': 'Player name is required',
  'validation.playerNameMinLength': 'Player name must be at least 2 characters long',
  'validation.playerNameMaxLength': 'Player name may not exceed 50 characters',
  'validation.minAge': 'You must be at least 13 years old',
  'validation.invalidBirthdate': 'Invalid birthdate',

  // onboarding
  'onboarding.saveError': 'Something went wrong. Please try again.',
  'onboarding.welcomeTitle': 'Welcome to Oracle Games!',
  'onboarding.welcomeSubtitle': 'Your account has been created. Complete your profile - it takes less than a minute.',
  'onboarding.profilePhoto': 'Profile photo',
  'onboarding.profilePhotoDescription': 'Let others know who you are',
  'onboarding.saveAndContinue': 'Save and continue',
  'onboarding.later': 'Later',
  'onboarding.settingsNote': 'You can always change this later via Settings',

  // login
  'login.emailNotVerified': 'Your email is not verified yet. Check your inbox (and spam folder) for the verification link.',
  'login.tooManyRequests': 'Too many requests. Please wait before trying again.',
  'login.resendError': 'Something went wrong sending the email. Please try again later.',
  'login.verificationSent': 'Verification email sent! Check your inbox.',
  'login.sending': 'Sending...',
  'login.resendVerification': 'Resend verification email',

  // register
  'register.domainBlocked': 'Registration with this email domain is not allowed',
};

function flatToNested(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

async function run() {
  const nlNested = flatToNested(nlKeys);
  const enNested = flatToNested(enKeys);

  console.log('📝 Pushing NL translations...');
  await db.doc('translations/nl').set(nlNested, { merge: true });
  console.log('✅ NL done');

  console.log('📝 Pushing EN translations...');
  await db.doc('translations/en').set(enNested, { merge: true });
  console.log('✅ EN done');

  console.log('\n🎉 Alle vertalingen succesvol gepusht!');
  console.log(`   NL: ${Object.keys(nlKeys).length} sleutels`);
  console.log(`   EN: ${Object.keys(enKeys).length} sleutels`);
}

run().catch((err) => {
  console.error('❌ Fout:', err);
  process.exit(1);
});
