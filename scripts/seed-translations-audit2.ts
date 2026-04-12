/**
 * Seed script: vertaal-audit ronde 2 - resterende strings.
 *
 * Gebruik: npx ts-node -r tsconfig-paths/register scripts/seed-translations-audit2.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  // account - layout
  'account.layoutHint': 'Sleep blokken om te herordenen of te verplaatsen. Klik op het oog-icoon om een blok te verbergen.',

  // profile completeness card
  'profile.completeTitle': 'Maak je profiel compleet',
  'profile.fieldsFilledIn': '{{count}} van {{total}} velden ingevuld',
  'profile.completeButton': 'Profiel aanvullen',
  'profile.avatar': 'Avatar',

  // game rules card
  'gameRules.title': 'Spelregels',
  'gameRules.noRules': 'Geen spelregels beschikbaar',

  // form validation
  'validation.selectLanguage': 'Selecteer een taal',

  // login form
  'login.email': 'E-mail',
  'login.password': 'Wachtwoord',
  'login.stayLoggedIn': 'Ingelogd blijven',
  'login.forgotPassword': 'Wachtwoord vergeten?',
  'login.submit': 'Inloggen',
  'login.orLoginWith': 'Of inloggen met',
  'login.loginWithGoogle': 'Inloggen met Google',
  'login.noAccount': 'Nog geen account?',
  'login.registerLink': 'Ga naar de registratiepagina',

  // register form
  'register.confirmPassword': 'Wachtwoord bevestigen',
  'register.registering': 'Bezig met registreren...',
  'register.submit': 'Registreren',
  'register.orRegisterWith': 'Of registreren met',
  'register.registerWithGoogle': 'Registreren met Google',
  'register.alreadyHaveAccount': 'Al een account?',
  'register.loginLink': 'Ga naar de inlogpagina',
};

const enKeys: Record<string, string> = {
  // account - layout
  'account.layoutHint': 'Drag blocks to reorder or move them. Click the eye icon to hide a block.',

  // profile completeness card
  'profile.completeTitle': 'Complete your profile',
  'profile.fieldsFilledIn': '{{count}} of {{total}} fields filled in',
  'profile.completeButton': 'Complete profile',
  'profile.avatar': 'Avatar',

  // game rules card
  'gameRules.title': 'Game rules',
  'gameRules.noRules': 'No game rules available',

  // form validation
  'validation.selectLanguage': 'Please select a language',

  // login form
  'login.email': 'Email',
  'login.password': 'Password',
  'login.stayLoggedIn': 'Stay logged in',
  'login.forgotPassword': 'Forgot password?',
  'login.submit': 'Log in',
  'login.orLoginWith': 'Or log in with',
  'login.loginWithGoogle': 'Log in with Google',
  'login.noAccount': "Don't have an account?",
  'login.registerLink': 'Go to the registration page',

  // register form
  'register.confirmPassword': 'Confirm Password',
  'register.registering': 'Registering...',
  'register.submit': 'Register',
  'register.orRegisterWith': 'Or register with',
  'register.registerWithGoogle': 'Register with Google',
  'register.alreadyHaveAccount': 'Already have an account?',
  'register.loginLink': 'Go to the login page',
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
