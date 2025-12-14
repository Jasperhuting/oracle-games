/**
 * Seed Test Data for Cypress E2E Tests
 *
 * This script seeds the Firebase emulator with test data for E2E testing.
 * Run with: npm run seed:test-data
 *
 * Make sure Firebase emulators are running before executing this script!
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { connectFirestoreEmulator } from 'firebase/firestore';

// Firebase config (doesn't matter for emulator)
const firebaseConfig = {
  apiKey: 'fake-api-key',
  authDomain: 'oracle-games-b6af6.firebaseapp.com',
  projectId: 'oracle-games-b6af6',
  storageBucket: 'oracle-games-b6af6.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator
connectFirestoreEmulator(db, '127.0.0.1', 8080);

console.log('🔥 Connected to Firebase Emulator');

// Test user IDs (must match auth_export/accounts.json)
const USERS = {
  user: 'Y7MFuREIU16WK8XYvLXFVbbs4NoB',    // user@test.com
  user2: 'HZxMI3NzAUk98k84F3uQht7qJZP2',   // user2@test.com
  admin: 'Xt3G7IfyjOOkFDC3LCBCjF5HXKnv'    // admin@test.com
};

async function seedTestData() {
  console.log('📦 Starting test data seeding...\n');

  try {
    // 1. Seed user documents
    await seedUsers();

    // 2. Seed test games
    await seedGames();

    // 3. Seed game participants
    await seedParticipants();

    // 4. Seed sample riders (eligible for games)
    await seedRiders();

    // 5. Seed bids
    await seedBids();

    // 6. Seed player teams
    await seedPlayerTeams();

    // 7. Seed messages
    await seedMessages();

    console.log('\n✅ Test data seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - 3 test users created');
    console.log('   - 3 test games created');
    console.log('   - 3 participants created');
    console.log('   - 3 sample riders added');
    console.log('   - 4 test bids created');
    console.log('   - 2 player teams created');
    console.log('   - 3 test messages created');
    console.log('\n🚀 Ready for E2E tests!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  }
}

async function seedUsers() {
  console.log('👤 Seeding test users...');

  const users = [
    {
      id: USERS.user,
      email: 'user@test.com',
      username: 'Test User',
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      lastLoginMethod: 'email',
      role: 'user'
    },
    {
      id: USERS.user2,
      email: 'user2@test.com',
      username: 'Test User 2',
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      lastLoginMethod: 'email',
      role: 'user'
    },
    {
      id: USERS.admin,
      email: 'admin@test.com',
      username: 'Test Admin',
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      lastLoginMethod: 'email',
      role: 'admin'
    }
  ];

  for (const user of users) {
    await setDoc(doc(db, 'users', user.id), user);
    console.log(`   ✓ Created user: ${user.username} (${user.email})`);
  }
}

async function seedGames() {
  console.log('🎮 Seeding test games...');

  const games = [
    {
      id: 'test-auction-active',
      name: 'Test Auctioneer - Tour de France 2025',
      gameType: 'auctioneer',
      raceType: 'grand-tour',
      year: 2025,
      createdBy: USERS.admin,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'bidding',
      playerCount: 2,
      maxPlayers: 20,
      eligibleTeams: ['uae-team-emirates', 'visma-lease-a-bike', 'soudal-quick-step'],
      eligibleRiders: ['tadej-pogacar', 'jonas-vingegaard', 'remco-evenepoel'],
      config: {
        budget: 100,
        maxRiders: 8,
        auctionStatus: 'active',
        maxMinimumBid: 3000,
        auctionPeriods: [
          {
            name: 'Main Auction',
            startDate: Timestamp.fromDate(new Date('2025-01-01')),
            endDate: Timestamp.fromDate(new Date('2025-06-01')),
            status: 'active'
          }
        ]
      }
    },
    {
      id: 'test-worldtour-manager',
      name: 'Test WorldTour Manager 2025',
      gameType: 'worldtour-manager',
      raceType: 'season',
      year: 2025,
      createdBy: USERS.admin,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'bidding',
      playerCount: 1,
      maxPlayers: 30,
      eligibleTeams: ['uae-team-emirates', 'visma-lease-a-bike'],
      eligibleRiders: ['tadej-pogacar', 'jonas-vingegaard'],
      config: {
        budget: 12000,
        minRiders: 27,
        maxRiders: 32,
        maxNeoProPoints: 250,
        maxNeoProAge: 21,
        auctionStatus: 'active'
      }
    },
    {
      id: 'test-game-registration',
      name: 'Test Game - Registration Open',
      gameType: 'auctioneer',
      raceType: 'classics',
      year: 2025,
      createdBy: USERS.admin,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'registration',
      playerCount: 0,
      maxPlayers: 15,
      eligibleTeams: ['soudal-quick-step'],
      eligibleRiders: ['remco-evenepoel'],
      config: {
        budget: 80,
        maxRiders: 6,
        auctionStatus: 'pending'
      }
    }
  ];

  for (const game of games) {
    await setDoc(doc(db, 'games', game.id), game);
    console.log(`   ✓ Created game: ${game.name}`);
  }
}

async function seedParticipants() {
  console.log('👥 Seeding game participants...');

  const participants = [
    {
      id: 'participant-user-auction',
      gameId: 'test-auction-active',
      userId: USERS.user,
      playername: 'Test User',
      userEmail: 'user@test.com',
      joinedAt: Timestamp.now(),
      status: 'active',
      budget: 100,
      spentBudget: 15,
      rosterSize: 2,
      rosterComplete: false,
      totalPoints: 0,
      ranking: 1,
      leagueIds: []
    },
    {
      id: 'participant-user2-auction',
      gameId: 'test-auction-active',
      userId: USERS.user2,
      playername: 'Test User 2',
      userEmail: 'user2@test.com',
      joinedAt: Timestamp.now(),
      status: 'active',
      budget: 100,
      spentBudget: 10,
      rosterSize: 1,
      rosterComplete: false,
      totalPoints: 0,
      ranking: 2,
      leagueIds: []
    },
    {
      id: 'participant-user-wtm',
      gameId: 'test-worldtour-manager',
      userId: USERS.user,
      playername: 'Test User',
      userEmail: 'user@test.com',
      joinedAt: Timestamp.now(),
      status: 'active',
      budget: 12000,
      spentBudget: 2500,
      rosterSize: 3,
      rosterComplete: false,
      totalPoints: 0,
      ranking: 1,
      leagueIds: []
    }
  ];

  for (const participant of participants) {
    await setDoc(doc(db, 'gameParticipants', participant.id), participant);
    console.log(`   ✓ Created participant: ${participant.playername} in ${participant.gameId}`);
  }
}

async function seedRiders() {
  console.log('🚴 Seeding sample riders...');

  const riders = [
    {
      nameId: 'tadej-pogacar',
      name: 'Tadej Pogačar',
      team: 'UAE Team Emirates',
      teamSlug: 'uae-team-emirates',
      country: 'si',
      uciPoints: 6500,
      jerseyImage: '/jerseys/uae-team-emirates.png'
    },
    {
      nameId: 'jonas-vingegaard',
      name: 'Jonas Vingegaard',
      team: 'Visma-Lease a Bike',
      teamSlug: 'visma-lease-a-bike',
      country: 'dk',
      uciPoints: 5800,
      jerseyImage: '/jerseys/visma-lease-a-bike.png'
    },
    {
      nameId: 'remco-evenepoel',
      name: 'Remco Evenepoel',
      team: 'Soudal Quick-Step',
      teamSlug: 'soudal-quick-step',
      country: 'be',
      uciPoints: 5200,
      jerseyImage: '/jerseys/soudal-quick-step.png'
    }
  ];

  for (const rider of riders) {
    await setDoc(doc(db, 'riders', rider.nameId), rider);
    console.log(`   ✓ Created rider: ${rider.name}`);
  }
}

async function seedBids() {
  console.log('💰 Seeding test bids...');

  const bids = [
    {
      id: 'bid-user-pogacar',
      gameId: 'test-auction-active',
      userId: USERS.user,
      playername: 'Test User',
      riderNameId: 'tadej-pogacar',
      riderName: 'Tadej Pogačar',
      riderTeam: 'UAE Team Emirates',
      amount: 10,
      bidAt: Timestamp.now(),
      status: 'won'
    },
    {
      id: 'bid-user-vingegaard',
      gameId: 'test-auction-active',
      userId: USERS.user,
      playername: 'Test User',
      riderNameId: 'jonas-vingegaard',
      riderName: 'Jonas Vingegaard',
      riderTeam: 'Visma-Lease a Bike',
      amount: 5,
      bidAt: Timestamp.now(),
      status: 'active'
    },
    {
      id: 'bid-user2-vingegaard',
      gameId: 'test-auction-active',
      userId: USERS.user2,
      playername: 'Test User 2',
      riderNameId: 'jonas-vingegaard',
      riderName: 'Jonas Vingegaard',
      riderTeam: 'Visma-Lease a Bike',
      amount: 3,
      bidAt: Timestamp.fromDate(new Date(Date.now() - 60000)), // 1 min ago
      status: 'outbid'
    },
    {
      id: 'bid-user2-evenepoel',
      gameId: 'test-auction-active',
      userId: USERS.user2,
      playername: 'Test User 2',
      riderNameId: 'remco-evenepoel',
      riderName: 'Remco Evenepoel',
      riderTeam: 'Soudal Quick-Step',
      amount: 10,
      bidAt: Timestamp.now(),
      status: 'won'
    }
  ];

  for (const bid of bids) {
    await setDoc(doc(db, 'bids', bid.id), bid);
    console.log(`   ✓ Created bid: ${bid.playername} → ${bid.riderName} (${bid.amount} credits)`);
  }
}

async function seedPlayerTeams() {
  console.log('🏆 Seeding player teams...');

  const playerTeams = [
    {
      id: 'team-user-pogacar',
      gameId: 'test-auction-active',
      userId: USERS.user,
      riderNameId: 'tadej-pogacar',
      riderName: 'Tadej Pogačar',
      riderTeam: 'UAE Team Emirates',
      riderCountry: 'si',
      acquiredAt: Timestamp.now(),
      acquisitionType: 'auction',
      pricePaid: 10,
      active: true,
      benched: false,
      pointsScored: 0,
      stagesParticipated: 0
    },
    {
      id: 'team-user2-evenepoel',
      gameId: 'test-auction-active',
      userId: USERS.user2,
      riderNameId: 'remco-evenepoel',
      riderName: 'Remco Evenepoel',
      riderTeam: 'Soudal Quick-Step',
      riderCountry: 'be',
      acquiredAt: Timestamp.now(),
      acquisitionType: 'auction',
      pricePaid: 10,
      active: true,
      benched: false,
      pointsScored: 0,
      stagesParticipated: 0
    }
  ];

  for (const team of playerTeams) {
    await setDoc(doc(db, 'playerTeams', team.id), team);
    console.log(`   ✓ Created player team: ${team.riderName} for user ${team.userId.slice(0, 8)}...`);
  }
}

async function seedMessages() {
  console.log('📨 Seeding test messages...');

  const messages = [
    {
      id: 'msg-broadcast-1',
      type: 'broadcast',
      senderId: USERS.admin,
      senderName: 'Test Admin',
      subject: 'Welcome to Test Environment!',
      message: 'This is a test broadcast message for Cypress E2E testing.',
      sentAt: Timestamp.now(),
      deletedBySender: false
    },
    {
      id: 'msg-individual-1',
      type: 'individual',
      senderId: USERS.admin,
      senderName: 'Test Admin',
      recipientId: USERS.user,
      recipientName: 'Test User',
      subject: 'Test Individual Message',
      message: 'This is a test individual message.',
      sentAt: Timestamp.now(),
      read: false,
      deletedBySender: false,
      deletedByRecipient: false
    },
    {
      id: 'msg-individual-2',
      type: 'individual',
      senderId: USERS.admin,
      senderName: 'Test Admin',
      recipientId: USERS.user,
      recipientName: 'Test User',
      subject: 'Read Message Test',
      message: 'This message has been read.',
      sentAt: Timestamp.fromDate(new Date(Date.now() - 86400000)), // 1 day ago
      read: true,
      readAt: Timestamp.fromDate(new Date(Date.now() - 80000000)),
      deletedBySender: false,
      deletedByRecipient: false
    }
  ];

  for (const message of messages) {
    await setDoc(doc(db, 'messages', message.id), message);
    console.log(`   ✓ Created message: ${message.subject}`);
  }
}

// Run the seed function
seedTestData();
