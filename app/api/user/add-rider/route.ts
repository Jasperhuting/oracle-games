import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getRiderProfilePuppeteer } from '@/lib/scraper/getRiderProfilePuppeteer';
import { toSlug } from '@/lib/firebase/utils';
import { sendRiderScriptNotification, sendRateLimitNotification } from '@/lib/telegram';

const DAILY_RIDER_LIMIT = 5;

/**
 * Check if user has exceeded daily rider limit
 */
async function checkRateLimit(userId: string, db: FirebaseFirestore.Firestore): Promise<{ allowed: boolean; count: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayISO = today.toISOString();

  // Count riders added by this user today
  const logsSnapshot = await db.collection('activityLogs')
    .where('userId', '==', userId)
    .where('action', '==', 'USER_RIDER_SCRIPT_SUCCESS')
    .where('timestamp', '>=', todayISO)
    .get();

  const count = logsSnapshot.size;

  return {
    allowed: count < DAILY_RIDER_LIMIT,
    count,
  };
}

export async function POST(req: NextRequest) {
  const db = getServerFirebase();

  try {
    const { url, userId } = await req.json();

    // Validate required fields
    if (!url || !userId) {
      return NextResponse.json(
        { error: 'URL en userId zijn verplicht' },
        { status: 400 }
      );
    }

    // Validate URL
    if (!url.includes('procyclingstats.com/rider/')) {
      return NextResponse.json(
        { error: 'Ongeldige URL. Moet een ProCyclingStats renner URL zijn (bijv. https://www.procyclingstats.com/rider/titouan-fontaine)' },
        { status: 400 }
      );
    }

    // Get currentYear from config
    const configDoc = await db.collection('config').doc('settings').get();
    if (!configDoc.exists) {
      return NextResponse.json(
        { error: 'Systeem configuratie niet gevonden' },
        { status: 500 }
      );
    }

    const currentYear = configDoc.data()?.currentYear;
    if (!currentYear) {
      return NextResponse.json(
        { error: 'Huidig jaar niet geconfigureerd in systeem' },
        { status: 500 }
      );
    }

    // Extract nameID from URL to check if rider already exists
    // URL format: https://www.procyclingstats.com/rider/titouan-fontaine
    const urlParts = url.split('/rider/');
    if (urlParts.length < 2) {
      return NextResponse.json(
        { error: 'Ongeldige URL format' },
        { status: 400 }
      );
    }

    const nameIDFromUrl = urlParts[1].split('?')[0].split('#')[0]; // Remove query params and hash
    const docId = toSlug(nameIDFromUrl);

    // Check if rider already exists in the current year's rankings
    const existingRiderDoc = await db.collection(`rankings_${currentYear}`).doc(docId).get();
    if (existingRiderDoc.exists) {
      const existingRiderData = existingRiderDoc.data();
      return NextResponse.json(
        {
          error: `Deze renner bestaat al in de ${currentYear} rankings`,
          riderName: existingRiderData?.name,
          riderNameId: existingRiderData?.nameID,
        },
        { status: 409 } // Conflict
      );
    }

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Gebruiker niet gevonden' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const userName = userData?.playername || userData?.email || 'Onbekend';
    const userEmail = userData?.email || 'Onbekend';

    // Check rate limit
    const rateLimit = await checkRateLimit(userId, db);

    if (!rateLimit.allowed) {
      // Log rate limit hit
      await db.collection('activityLogs').add({
        action: 'USER_RIDER_SCRIPT_RATE_LIMIT',
        userId,
        userEmail,
        userName,
        details: {
          url,
          year: currentYear,
          dailyLimit: DAILY_RIDER_LIMIT,
          currentCount: rateLimit.count,
          errorMessage: 'Dagelijkse limiet bereikt',
        },
        timestamp: new Date().toISOString(),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      });

      // Send Telegram notification
      try {
        await sendRateLimitNotification(
          userName,
          userEmail,
          'Renner toevoegen via script',
          DAILY_RIDER_LIMIT,
          rateLimit.count
        );
      } catch (telegramError) {
        console.error('Failed to send Telegram rate limit notification:', telegramError);
      }

      return NextResponse.json(
        {
          error: `Dagelijkse limiet bereikt. Je kunt maximaal ${DAILY_RIDER_LIMIT} renners per dag toevoegen. Je hebt vandaag al ${rateLimit.count} renners toegevoegd.`,
          dailyLimit: DAILY_RIDER_LIMIT,
          usedToday: rateLimit.count,
        },
        { status: 429 }
      );
    }

    // Scrape rider data
    let riderData;
    try {
      riderData = await getRiderProfilePuppeteer(url);
    } catch (scrapeError) {
      const errorMessage = scrapeError instanceof Error ? scrapeError.message : 'Failed to scrape rider profile';

      // Log scrape failure
      await db.collection('activityLogs').add({
        action: 'USER_RIDER_SCRIPT_SCRAPE_FAILED',
        userId,
        userEmail,
        userName,
        details: {
          url,
          year: currentYear,
          errorMessage,
          usedToday: rateLimit.count,
        },
        timestamp: new Date().toISOString(),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      });

      // Send Telegram notification for scrape failure
      try {
        await sendRiderScriptNotification(
          userName,
          userEmail,
          'Onbekend',
          url,
          currentYear,
          false,
          `Scraping mislukt: ${errorMessage}`
        );
      } catch (telegramError) {
        console.error('Failed to send Telegram scrape failure notification:', telegramError);
      }

      return NextResponse.json(
        { error: 'Kon renner gegevens niet ophalen: ' + errorMessage },
        { status: 500 }
      );
    }

    // Validate required rider data
    const requiredFields = ['name', 'firstName', 'lastName', 'nameID', 'country', 'points', 'rank'];
    const missingFields = requiredFields.filter(field => {
      const value = riderData[field as keyof typeof riderData];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      // Log validation failure
      await db.collection('activityLogs').add({
        action: 'USER_RIDER_SCRIPT_VALIDATION_FAILED',
        userId,
        userEmail,
        userName,
        details: {
          url,
          year: currentYear,
          missingFields,
          scrapedData: riderData,
          errorMessage: `Ontbrekende verplichte velden: ${missingFields.join(', ')}`,
          usedToday: rateLimit.count,
        },
        timestamp: new Date().toISOString(),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      });

      return NextResponse.json(
        { error: `Ontbrekende verplichte velden in gescrapede data: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Create/get team reference if team exists
    let teamRef;
    if (riderData.team) {
      const teamSlug = riderData.team;
      const existingTeam = await db.collection('teams')
        .where('slug', '==', teamSlug)
        .limit(1)
        .get();

      if (!existingTeam.empty) {
        teamRef = existingTeam.docs[0].ref;
      } else {
        const newTeamRef = db.collection('teams').doc(teamSlug);
        await newTeamRef.set({
          name: riderData.team,
          slug: teamSlug,
        }, { merge: true });
        teamRef = newTeamRef;
      }
    }

    // Add rider to ranking
    await db.collection(`rankings_${currentYear}`).doc(docId).set({
      country: riderData.country,
      name: riderData.name,
      nameID: riderData.nameID,
      points: riderData.points,
      rank: riderData.rank,
      firstName: riderData.firstName,
      lastName: riderData.lastName,
      ...(teamRef && { team: teamRef }),
      ...(riderData.age && { age: riderData.age }),
      addedByUser: userId,
      addedByScript: true,
      addedAt: new Date().toISOString(),
    }, { merge: true });

    // Add rider to all seasonal games for this year
    const seasonalGamesSnapshot = await db.collection('games')
      .where('raceType', '==', 'season')
      .where('year', '==', currentYear)
      .get();

    let addedToGamesCount = 0;
    for (const gameDoc of seasonalGamesSnapshot.docs) {
      const gameData = gameDoc.data();
      const eligibleRiders = gameData.eligibleRiders || [];

      if (!eligibleRiders.includes(riderData.nameID)) {
        await gameDoc.ref.update({
          eligibleRiders: [...eligibleRiders, riderData.nameID],
        });
        addedToGamesCount++;
      }
    }

    // Log successful addition
    await db.collection('activityLogs').add({
      action: 'USER_RIDER_SCRIPT_SUCCESS',
      userId,
      userEmail,
      userName,
      details: {
        url,
        year: currentYear,
        riderName: riderData.name,
        riderNameId: riderData.nameID,
        riderCountry: riderData.country,
        riderTeam: riderData.team,
        riderPoints: riderData.points,
        riderRank: riderData.rank,
        addedToGames: addedToGamesCount,
        usedToday: rateLimit.count + 1,
        remainingToday: DAILY_RIDER_LIMIT - (rateLimit.count + 1),
      },
      timestamp: new Date().toISOString(),
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    });

    // Send Telegram notification for success
    try {
      await sendRiderScriptNotification(
        userName,
        userEmail,
        riderData.name,
        url,
        currentYear,
        true
      );
    } catch (telegramError) {
      console.error('Failed to send Telegram success notification:', telegramError);
    }

    return NextResponse.json({
      success: true,
      message: `${riderData.name} succesvol toegevoegd aan rankings_${currentYear}!`,
      rider: {
        name: riderData.name,
        nameID: riderData.nameID,
        country: riderData.country,
        team: riderData.team,
        points: riderData.points,
        rank: riderData.rank,
      },
      addedToGames: addedToGamesCount,
      dailyUsage: {
        used: rateLimit.count + 1,
        limit: DAILY_RIDER_LIMIT,
        remaining: DAILY_RIDER_LIMIT - (rateLimit.count + 1),
      },
    });

  } catch (error) {
    console.error('Error in user add-rider endpoint:', error);

    // Try to log the error
    try {
      const { userId } = await req.json();
      if (userId) {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        await db.collection('activityLogs').add({
          action: 'USER_RIDER_SCRIPT_ERROR',
          userId,
          userEmail: userData?.email,
          userName: userData?.playername || userData?.email,
          details: {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
          },
          timestamp: new Date().toISOString(),
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { error: 'Er is een fout opgetreden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
