/**
 * Repairs riders that were bought more times than maxOwnersPerRider allows.
 * Keeps the oldest acquisitions (by acquiredAt), removes the newest extras.
 * For each removed playerTeam:
 *   - sets active=false on the playerTeams doc
 *   - marks the corresponding bid as 'lost'
 *   - recalculates spentBudget for the affected participant
 *
 * Run:
 *   node scripts/repair-duplicate-rider-owners.cjs           (dry run)
 *   node scripts/repair-duplicate-rider-owners.cjs --fix     (apply changes)
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = !process.argv.includes('--fix');

if (DRY_RUN) {
  console.log('=== DRY RUN — geen wijzigingen worden opgeslagen ===');
  console.log('Gebruik --fix om wijzigingen toe te passen\n');
} else {
  console.log('=== FIX MODE — wijzigingen worden opgeslagen ===\n');
}

function extractRaceRefPath(raceRef) {
  if (!raceRef) return '';
  if (typeof raceRef === 'string') return raceRef;
  if (raceRef && typeof raceRef === 'object' && raceRef.path) return raceRef.path;
  return '';
}

function getMaxOwnersPerRider(gameData) {
  if (gameData.gameType !== 'auctioneer') return 1;

  const raceRefPath = extractRaceRefPath(gameData.raceRef).toLowerCase();
  const name = (gameData.name || '').toLowerCase();
  const isGiroAuctionMaster = raceRefPath.includes('giro-d-italia') || (name.includes('giro') && name.includes('auction'));

  if (gameData.divisionLevel === 1 && isGiroAuctionMaster) return 2;
  if ((gameData.divisionLevel || 0) >= 2) return 1;

  const config = gameData.config || {};
  if (config.allowSharedRiders) {
    return Math.max(config.maxOwnersPerRider || Number.MAX_SAFE_INTEGER, 1);
  }
  return 1;
}

async function main() {
  // Find all auctioneer games
  const gamesSnapshot = await db.collection('games')
    .where('gameType', '==', 'auctioneer')
    .get();

  console.log(`Gevonden ${gamesSnapshot.size} auctioneer game(s)\n`);

  let totalRemoved = 0;
  let totalAffectedUsers = new Set();

  for (const gameDoc of gamesSnapshot.docs) {
    const gameData = gameDoc.data();
    const gameId = gameDoc.id;
    const maxOwners = getMaxOwnersPerRider(gameData);

    console.log(`Game: "${gameData.name}" (${gameId})`);
    console.log(`  maxOwnersPerRider: ${maxOwners}`);

    // Get all active playerTeams for this game
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('active', '==', true)
      .get();

    if (playerTeamsSnapshot.empty) {
      console.log('  Geen actieve playerTeams gevonden\n');
      continue;
    }

    // Group by riderNameId
    const byRider = new Map();
    for (const doc of playerTeamsSnapshot.docs) {
      const data = doc.data();
      if (!byRider.has(data.riderNameId)) byRider.set(data.riderNameId, []);
      byRider.get(data.riderNameId).push({ id: doc.id, ...data });
    }

    // Find riders with too many owners
    const duplicates = [];
    for (const [riderNameId, owners] of byRider.entries()) {
      if (owners.length > maxOwners) {
        // Sort by acquiredAt ascending (keep oldest)
        owners.sort((a, b) => {
          const tA = a.acquiredAt?.toDate ? a.acquiredAt.toDate() : new Date(a.acquiredAt || 0);
          const tB = b.acquiredAt?.toDate ? b.acquiredAt.toDate() : new Date(b.acquiredAt || 0);
          return tA - tB;
        });
        const toKeep = owners.slice(0, maxOwners);
        const toRemove = owners.slice(maxOwners);
        duplicates.push({ riderNameId, riderName: owners[0].riderName, toKeep, toRemove });
      }
    }

    if (duplicates.length === 0) {
      console.log('  Geen duplicaten gevonden\n');
      continue;
    }

    console.log(`  DUPLICATEN GEVONDEN: ${duplicates.length} renner(s) met te veel eigenaren`);

    for (const { riderNameId, riderName, toKeep, toRemove } of duplicates) {
      console.log(`\n  Renner: ${riderName} (${riderNameId})`);
      console.log(`    Houden (${toKeep.length}): ${toKeep.map(o => o.userId).join(', ')}`);
      console.log(`    Verwijderen (${toRemove.length}):`);

      for (const owner of toRemove) {
        console.log(`      - userId: ${owner.userId}, pricePaid: ${owner.pricePaid}, acquiredAt: ${owner.acquiredAt?.toDate ? owner.acquiredAt.toDate().toISOString() : owner.acquiredAt}`);
        totalAffectedUsers.add(`${gameId}:${owner.userId}`);

        if (!DRY_RUN) {
          // 1. Deactivate playerTeam
          await db.collection('playerTeams').doc(owner.id).update({ active: false });

          // 2. Find corresponding won bid and mark as lost
          const bidSnapshot = await db.collection('bids')
            .where('gameId', '==', gameId)
            .where('userId', '==', owner.userId)
            .where('riderNameId', '==', riderNameId)
            .where('status', '==', 'won')
            .get();

          if (!bidSnapshot.empty) {
            for (const bidDoc of bidSnapshot.docs) {
              await bidDoc.ref.update({ status: 'lost' });
              console.log(`      ✓ Bid ${bidDoc.id} → lost`);
            }
          } else {
            console.log(`      ⚠ Geen won-bid gevonden voor userId=${owner.userId} riderNameId=${riderNameId}`);
          }
        }

        totalRemoved++;
      }
    }

    // Recalculate spentBudget for affected users
    const affectedUserIds = new Set(
      duplicates.flatMap(d => d.toRemove.map(o => o.userId))
    );

    console.log(`\n  Budget herberekening voor ${affectedUserIds.size} gebruiker(s):`);

    for (const userId of affectedUserIds) {
      // Get all remaining won bids after fix
      const wonBidsSnapshot = await db.collection('bids')
        .where('gameId', '==', gameId)
        .where('userId', '==', userId)
        .where('status', '==', 'won')
        .get();

      // In dry run, simulate the bid status change
      let correctSpent;
      if (DRY_RUN) {
        // Calculate what the spent budget WOULD be after removing the duplicate wins
        const riderIdsToRemove = new Set(
          duplicates
            .flatMap(d => d.toRemove.filter(o => o.userId === userId).map(o => o.riderNameId))
        );
        correctSpent = wonBidsSnapshot.docs
          .filter(doc => !riderIdsToRemove.has(doc.data().riderNameId))
          .reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      } else {
        correctSpent = wonBidsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      }

      // Get current spentBudget
      const participantSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!participantSnapshot.empty) {
        const participantDoc = participantSnapshot.docs[0];
        const currentSpent = participantDoc.data().spentBudget || 0;
        const refund = currentSpent - correctSpent;

        console.log(`    userId: ${userId}`);
        console.log(`      spentBudget was: ${currentSpent} → wordt: ${correctSpent} (teruggestort: ${refund})`);

        if (!DRY_RUN) {
          // Recalculate rosterSize from remaining active playerTeams
          const remainingTeamSnapshot = await db.collection('playerTeams')
            .where('gameId', '==', gameId)
            .where('userId', '==', userId)
            .where('active', '==', true)
            .get();

          const maxRiders = gameData.config?.maxRiders || 0;
          const newRosterSize = remainingTeamSnapshot.size;
          const rosterComplete = maxRiders > 0 && newRosterSize >= maxRiders;

          await participantDoc.ref.update({
            spentBudget: correctSpent,
            rosterSize: newRosterSize,
            rosterComplete,
          });
          console.log(`      ✓ gameParticipant bijgewerkt (rosterSize: ${newRosterSize})`);
        }
      } else {
        console.log(`    ⚠ Geen participant gevonden voor userId=${userId} in game=${gameId}`);
      }
    }

    console.log('');
  }

  console.log(`\n=== SAMENVATTING ===`);
  console.log(`Onterecht gewonnen playerTeams: ${totalRemoved}`);
  console.log(`Betrokken gebruikers: ${totalAffectedUsers.size}`);
  if (DRY_RUN) {
    console.log('\nDIT WAS EEN DRY RUN. Gebruik --fix om wijzigingen toe te passen.');
  } else {
    console.log('\nAlle wijzigingen zijn toegepast.');
  }
}

main().catch(err => {
  console.error('Script gefaald:', err);
  process.exit(1);
});
