/**
 * Seed Firebase Emulator with test users
 * Run this after starting the emulators to create test accounts
 * 
 * Usage: node scripts/seed-emulator.js
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin with emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

admin.initializeApp({
  projectId: 'oracle-games-b6af6',
});

const auth = admin.auth();
const db = admin.firestore();

const testUsers = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    displayName: 'Test Admin',
    userType: 'admin',
    playername: 'TestAdmin',
  },
  {
    email: 'user@test.com',
    password: 'user123',
    displayName: 'Test User',
    userType: 'user',
    playername: 'TestUser',
  },
  {
    email: 'user2@test.com',
    password: 'user123',
    displayName: 'Test User 2',
    userType: 'user',
    playername: 'TestUser2',
  },
];

async function seedUsers() {
  console.log('🌱 Seeding Firebase Emulator with test users...\n');

  for (const userData of testUsers) {
    try {
      // Create auth user
      const userRecord = await auth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        emailVerified: true, // Auto-verify for testing
      });

      console.log(`✅ Created auth user: ${userData.email} (${userRecord.uid})`);

      // Create Firestore user document
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: userData.email,
        playername: userData.playername,
        userType: userData.userType,
        firstName: userData.displayName.split(' ')[0],
        lastName: userData.displayName.split(' ')[1] || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Created Firestore document for: ${userData.email}\n`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log(`⚠️  User already exists: ${userData.email}\n`);
      } else {
        console.error(`❌ Error creating user ${userData.email}:`, error.message, '\n');
      }
    }
  }

  console.log('✨ Seeding complete!\n');
  console.log('📋 Test Accounts:');
  console.log('   Admin: admin@test.com / admin123');
  console.log('   User:  user@test.com / user123');
  console.log('   User2: user2@test.com / user123\n');
  
  process.exit(0);
}

seedUsers().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
