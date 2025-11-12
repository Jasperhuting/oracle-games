import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { setStartingListRace } from '@/lib/scraper/setStartingListRace';
import { saveRidersToRace } from '@/lib/scraper/saveRidersToRace';
import { getRidersRanked } from '@/lib/scraper/getRidersRanked';
import { toSlug } from '@/lib/firebase/utils';

export async function POST(request: NextRequest) {
  try {
    const { adminUserId, name, year, slug, description } = await request.json();

    if (!adminUserId || !name || !year) {
      return NextResponse.json(
        { error: 'Admin user ID, name, and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Generate slug if not provided
    const raceSlug = slug || `${name.toLowerCase().replace(/\s+/g, '-')}_${year}`;

    // Check if race with this slug already exists
    const existingRace = await db.collection('races').doc(raceSlug).get();
    if (existingRace.exists) {
      return NextResponse.json(
        { error: 'Een race met deze naam en jaar bestaat al' },
        { status: 409 }
      );
    }

    // Create race document
    const raceData = {
      name,
      year: parseInt(year),
      slug: raceSlug,
      description: description || '',
      createdAt: new Date().toISOString(),
      createdBy: adminUserId,
      updatedAt: new Date().toISOString(),
      active: true,
    };

    // Check if rankings_{year} collection exists
    const rankingsSnapshot = await db.collection(`rankings_${year}`).limit(1).get();
    
    if (rankingsSnapshot.empty) {
      console.log(`[createRace] rankings_${year} doesn't exist, creating it...`);
      
      try {
        // Fetch all riders using the same offset pattern as create-ranking page
        const offsetOptions = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500];
        const totalRiders = [];
        
        for (let i = 0; i < offsetOptions.length; i++) {
          const offset = offsetOptions[i];
          console.log(`[createRace] Fetching riders ${i + 1}/${offsetOptions.length} (offset: ${offset})`);
          
          const rankingsResult = await getRidersRanked({ offset, year: parseInt(year) });
          totalRiders.push(...rankingsResult.riders);
          
          // If we got less than 100 riders, we've reached the end
          if (rankingsResult.riders.length < 100) {
            console.log(`[createRace] Reached end of rankings at offset ${offset}`);
            break;
          }
        }
        
        console.log(`[createRace] Fetched total of ${totalRiders.length} riders for rankings_${year}`);
        
        // Save rankings to Firestore
        for (const rider of totalRiders) {
          const team = rider.team;
          const teamSlug = toSlug(team);

          let teamRef;

          if (team && teamSlug) {
            const existingTeam = await db.collection('teams')
              .where('slug', '==', teamSlug)
              .limit(1)
              .get();

            if (!existingTeam.empty) {
              teamRef = existingTeam.docs[0].ref;
            } else {
              const newTeamRef = db.collection('teams').doc(teamSlug);
              await newTeamRef.set({
                name: team,
                slug: teamSlug,
              }, { merge: true });
              teamRef = newTeamRef;
            }
          }

          const docId = toSlug(rider.nameID);

          await db.collection(`rankings_${year}`).doc(docId).set({
            rank: rider.rank,
            name: rider.fullName,
            nameID: rider.nameID,
            points: rider.points,
            country: rider.country,
            ...(teamRef && { team: teamRef }),
          });
        }
        
        console.log(`[createRace] Successfully created rankings_${year} with ${totalRiders.length} riders`);
      } catch (rankingsError) {
        console.error(`[createRace] Failed to create rankings_${year}:`, rankingsError);
        throw new Error(`Kon rankings niet aanmaken voor jaar ${year}: ${rankingsError instanceof Error ? rankingsError.message : 'Unknown error'}`);
      }
    } else {
      console.log(`[createRace] rankings_${year} already exists`);
    }

    // Execute setStartingListRace BEFORE creating the race
    // If scraper fails, race won't be created
    let ridersCount = 0;
    try {
      // Extract the race slug without year for the scraper
      const raceSlugForScraper = raceSlug.replace(`_${year}`, '');
      
      console.log(`[createRace] Starting scrape for race: ${raceSlugForScraper}, year: ${year}`);
      
      // Scrape the starting list
      const scrapedData = await setStartingListRace({ 
        year: parseInt(year), 
        race: raceSlugForScraper 
      });

      console.log(`[createRace] Scraped ${scrapedData.riders.length} riders`);
      console.log(`[createRace] Saving to collection: ${raceSlug}`);

      // Save riders to Firestore
      const ridersProcessed = await saveRidersToRace(
        scrapedData.riders,
        raceSlug,
        parseInt(year)
      );

      console.log(`[createRace] Successfully saved ${ridersProcessed} riders to ${raceSlug}`);

      ridersCount = scrapedData.riders.length;

    } catch (error) {
      console.error('[createRace] Error setting starting list:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log the failed attempt
      const adminData = adminDoc.data();
      await db.collection('activityLogs').add({
        action: 'RACE_CREATION_FAILED',
        userId: adminUserId,
        userEmail: adminData?.email,
        userName: adminData?.playername || adminData?.email,
        details: {
          raceName: name,
          year: year,
          slug: raceSlug,
          reason: 'Starting list scraper failed',
          error: errorMessage,
        },
        timestamp: new Date().toISOString(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

      // Return error - race will NOT be created
      return NextResponse.json(
        { error: `Kon startlijst niet laden: ${errorMessage}. Race is niet aangemaakt.` },
        { status: 400 }
      );
    }

    // Only create race if scraper succeeded
    await db.collection('races').doc(raceSlug).set(raceData);

    // Log the successful creation
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'RACE_CREATED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        raceName: name,
        year: year,
        slug: raceSlug,
        startingListStatus: 'success',
        ridersCount: ridersCount,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ 
      success: true,
      race: { id: raceSlug, ...raceData },
      ridersCount: ridersCount,
    });
  } catch (error) {
    console.error('Error creating race:', error);
    return NextResponse.json(
      { error: 'Failed to create race', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
