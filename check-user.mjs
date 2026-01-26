import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./service-account-key.json", "utf8"));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const gameId = "mGzPZfIOb2gAyEu0i6t6";
const userId = "45DOxPKbqUUTDeWdVf9xbKQ8yFk2";

// The 8 wrong riders in playerTeams that should be removed
const wrongRidersInPlayerTeams = [
  "adam-yates",
  "ben-o-connor",
  "jackson-medway",
  "matteo-jorgenson",
  "noa-isidore",
  "oier-lazkano",
  "primoz-roglic",
  "valentin-madouas"
];

// The 8 correct riders that should be added (from won bids)
const missingRidersFromBids = [
  "albert-withen-philipsen",
  "benoit-cosnefroy",
  "daniel-felipe-martinez",
  "jasper-philipsen",
  "marc-hirschi",
  "matej-mohoric",
  "maxim-van-gils",
  "stephen-williams"
];

async function fixPlayerTeams() {
  const batch = db.batch();

  console.log("=== FIXING PLAYER TEAMS ===\n");

  // 1. Find and delete the wrong playerTeam documents
  console.log("1. Finding wrong playerTeam documents to delete...");
  for (const riderId of wrongRidersInPlayerTeams) {
    const snap = await db.collection("playerTeams")
      .where("gameId", "==", gameId)
      .where("userId", "==", userId)
      .where("riderNameId", "==", riderId)
      .get();

    snap.forEach(doc => {
      console.log("  DELETE:", doc.id, "|", riderId);
      batch.delete(doc.ref);
    });
  }

  // 2. Get the won bids for the missing riders and create playerTeam documents
  console.log("\n2. Creating playerTeam documents from won bids...");
  for (const riderId of missingRidersFromBids) {
    const bidSnap = await db.collection("bids")
      .where("gameId", "==", gameId)
      .where("userId", "==", userId)
      .where("riderNameId", "==", riderId)
      .where("status", "==", "won")
      .get();

    if (bidSnap.empty) {
      console.log("  WARNING: No won bid found for", riderId);
      continue;
    }

    const bidDoc = bidSnap.docs[0];
    const bidData = bidDoc.data();

    // Create new playerTeam document
    const newPlayerTeamRef = db.collection("playerTeams").doc();
    const playerTeamData = {
      gameId: gameId,
      userId: userId,
      riderNameId: bidData.riderNameId,
      riderName: bidData.riderName,
      riderTeam: bidData.riderTeam || "",
      riderCountry: "",
      jerseyImage: bidData.jerseyImage || "",
      pricePaid: bidData.amount,
      acquiredAt: bidData.bidAt || admin.firestore.FieldValue.serverTimestamp(),
      acquisitionType: "auction",
      pointsScored: 0,
      stagesParticipated: 0,
      totalPoints: 0,
      pointsBreakdown: []
    };

    console.log("  CREATE:", newPlayerTeamRef.id, "|", riderId, "| price:", bidData.amount);
    batch.set(newPlayerTeamRef, playerTeamData);
  }

  // 3. Commit the batch
  console.log("\n3. Committing changes...");
  await batch.commit();
  console.log("Done!");

  // 4. Verify the fix
  console.log("\n=== VERIFICATION ===");
  const playerTeamsSnap = await db.collection("playerTeams")
    .where("gameId", "==", gameId)
    .where("userId", "==", userId)
    .get();

  const bidsSnap = await db.collection("bids")
    .where("gameId", "==", gameId)
    .where("userId", "==", userId)
    .where("status", "==", "won")
    .get();

  const ptRiders = [];
  playerTeamsSnap.forEach(doc => ptRiders.push(doc.data().riderNameId));

  const bidRiders = [];
  bidsSnap.forEach(doc => bidRiders.push(doc.data().riderNameId));

  const inPTnotBid = ptRiders.filter(r => !bidRiders.includes(r));
  const inBidnotPT = bidRiders.filter(r => !ptRiders.includes(r));

  console.log("playerTeams count:", ptRiders.length);
  console.log("won bids count:", bidRiders.length);

  if (inPTnotBid.length === 0 && inBidnotPT.length === 0) {
    console.log("\n✓ playerTeams now matches won bids!");
  } else {
    console.log("\n⚠️ Still some differences:");
    if (inPTnotBid.length > 0) console.log("  In PT not in bids:", inPTnotBid);
    if (inBidnotPT.length > 0) console.log("  In bids not in PT:", inBidnotPT);
  }

  process.exit(0);
}

fixPlayerTeams().catch(e => { console.error(e); process.exit(1); });
