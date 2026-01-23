import { getServerFirebase } from './server';
import { getRiderData, scrapeRiderData, saveRiderData } from './rider-scraper-service';
import { getRankingData } from './ranking-scraper-service';

interface RiderPointsWithUsers {
  riderNameId: string;
  riderName: string;
  totalPoints: number;
  results: Array<{
    date: string;
    race: string;
    raceUrl: string;
    position?: number;
    pcsPoints?: number;
    uciPoints?: number;
    stageNumber?: string;
    stageName?: string;
  }>;
  users: Array<{
    userId: string;
    playerName: string;
    gameId: string;
    gameName: string;
  }>;
}

export async function scrapeRidersWithPoints(year: number): Promise<void> {
  console.log(`[RIDER_POINTS] Starting to scrape all riders from ranking for year ${year}`);
  
  // Get ranking data from our new scraper
  const rankingData = await getRankingData(year);
  
  if (!rankingData) {
    console.log(`[RIDER_POINTS] No ranking data found for year ${year}. Please scrape the ranking first.`);
    return;
  }
  
  // Get all unique rider nameIDs from the ranking
  const riderNameIds = new Set<string>();
  rankingData.riders.forEach(rider => {
    if (rider.nameID && rider.nameID !== '-' && rider.nameID.trim() !== '') {
      riderNameIds.add(rider.nameID);
    }
  });
  
  console.log(`[RIDER_POINTS] Found ${riderNameIds.size} unique riders in ranking to scrape`);
  
  // Scrape each rider's detailed data
  let successCount = 0;
  let errorCount = 0;
  
  for (const riderNameId of riderNameIds) {
    try {
      console.log(`[RIDER_POINTS] Scraping rider: ${riderNameId}`);
      
      // Check if data already exists
      const existingData = await getRiderData({ rider: riderNameId, year });
      if (existingData) {
        console.log(`[RIDER_POINTS] Data already exists for ${riderNameId}, skipping`);
        successCount++;
        continue;
      }
      
      // Scrape new data
      const riderData = await scrapeRiderData(riderNameId, year);
      await saveRiderData({ rider: riderNameId, year }, riderData);
      
      successCount++;
      console.log(`[RIDER_POINTS] Successfully scraped ${riderNameId}`);
      
      // Add small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      errorCount++;
      console.error(`[RIDER_POINTS] Error scraping ${riderNameId}:`, error);
    }
  }
  
  console.log(`[RIDER_POINTS] Completed: ${successCount} successful, ${errorCount} errors`);
}

export async function getRiderPointsWithUsers(riderNameId: string, year: number): Promise<RiderPointsWithUsers | null> {
  console.log(`[RIDER_POINTS] Getting rider points with users for ${riderNameId}, year ${year}`);
  
  const db = getServerFirebase();
  
  // Get rider's detailed data
  const riderData = await getRiderData({ rider: riderNameId, year });
  if (!riderData) {
    console.log(`[RIDER_POINTS] No rider data found for ${riderNameId}, year ${year}`);
    return null;
  }
  
  // Get all users who have this rider in their team
  const playerTeamsSnapshot = await db.collection('playerTeams')
    .where('riderNameId', '==', riderNameId)
    .get();
  
  if (playerTeamsSnapshot.empty) {
    console.log(`[RIDER_POINTS] No users found with rider ${riderNameId}`);
    return {
      riderNameId,
      riderName: riderData.name,
      totalPoints: riderData.totalPcsPoints,
      results: riderData.results,
      users: [],
    };
  }
  
  // Get user and game information
  const users: RiderPointsWithUsers['users'] = [];
  
  for (const teamDoc of playerTeamsSnapshot.docs) {
    const teamData = teamDoc.data();
    const userId = teamData.userId;
    const gameId = teamData.gameId;
    
    try {
      // Get user info
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      // Get game info
      const gameDoc = await db.collection('games').doc(gameId).get();
      const gameData = gameDoc.data();
      
      if (userData && gameData) {
        users.push({
          userId,
          playerName: userData.displayName || userData.email || 'Unknown',
          gameId,
          gameName: gameData.name || 'Unknown Game',
        });
      }
    } catch (error) {
      console.error(`[RIDER_POINTS] Error getting user/game info for ${userId}/${gameId}:`, error);
    }
  }
  
  return {
    riderNameId,
    riderName: riderData.name,
    totalPoints: riderData.totalPcsPoints,
    results: riderData.results,
    users,
  };
}

export async function getAllRidersWithUsers(year: number): Promise<RiderPointsWithUsers[]> {
  console.log(`[RIDER_POINTS] Getting all riders from ranking with users for year ${year}`);
  
  // Get ranking data from our new scraper
  const rankingData = await getRankingData(year);
  
  if (!rankingData) {
    console.log(`[RIDER_POINTS] No ranking data found for year ${year}`);
    return [];
  }
  
  // Get all unique rider nameIDs from the ranking
  const riderNameIds = new Set<string>();
  rankingData.riders.forEach(rider => {
    if (rider.nameID && rider.nameID !== '-' && rider.nameID.trim() !== '') {
      riderNameIds.add(rider.nameID);
    }
  });
  
  console.log(`[RIDER_POINTS] Processing ${riderNameIds.size} riders from ranking`);
  
  const results: RiderPointsWithUsers[] = [];
  
  for (const riderNameId of riderNameIds) {
    try {
      const riderWithUsers = await getRiderPointsWithUsers(riderNameId, year);
      if (riderWithUsers) {
        results.push(riderWithUsers);
      }
    } catch (error) {
      console.error(`[RIDER_POINTS] Error processing ${riderNameId}:`, error);
    }
  }
  
  // Sort by total points descending
  results.sort((a, b) => b.totalPoints - a.totalPoints);
  
  console.log(`[RIDER_POINTS] Successfully processed ${results.length} riders`);
  
  return results;
}
