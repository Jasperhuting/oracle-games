import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { enrichTeamsPuppeteer } from '@/lib/scraper/enrichTeamsPuppeteer';

export async function POST(req: NextRequest) {
  const db = getServerFirebase();

  try {
    const { team, year } = await req.json();

    // Validate required fields
    if (!team || !year) {
      return NextResponse.json(
        { error: 'Team en jaar zijn verplicht' },
        { status: 400 }
      );
    }

    // Validate team slug format (basic validation)
    if (typeof team !== 'string' || team.trim() === '') {
      return NextResponse.json(
        { error: 'Ongeldige team slug' },
        { status: 400 }
      );
    }

    // Enrich team data from ProCyclingStats
    let enrichedTeamData;
    try {
      enrichedTeamData = await enrichTeamsPuppeteer({ year, team: team.trim() });
    } catch (scrapeError) {
      const errorMessage = scrapeError instanceof Error ? scrapeError.message : 'Failed to scrape team data';

      return NextResponse.json(
        { error: 'Kon team gegevens niet ophalen: ' + errorMessage },
        { status: 500 }
      );
    }

    // Validate enriched data
    if (!enrichedTeamData || !enrichedTeamData.teamName) {
      return NextResponse.json(
        { error: 'Geen geldige team data ontvangen van ProCyclingStats' },
        { status: 400 }
      );
    }

    // Find or create team document
    const teamSlug = enrichedTeamData.teamNameID;
    const teamsSnapshot = await db.collection('teams')
      .where('slug', '==', teamSlug)
      .limit(1)
      .get();

    let teamRef;
    if (!teamsSnapshot.empty) {
      teamRef = teamsSnapshot.docs[0].ref;
    } else {
      teamRef = db.collection('teams').doc(teamSlug);
    }

    // Update team document with enriched data
    await teamRef.set({
      name: enrichedTeamData.teamName,
      slug: teamSlug,
      country: enrichedTeamData.country,
      class: enrichedTeamData.class,
      jerseyImageTeam: enrichedTeamData.jerseyImageTeam,
      pcsRank: enrichedTeamData.pcsRank,
      uciRank: enrichedTeamData.uciRank,
      points: enrichedTeamData.points,
      year: year,
      lastEnriched: new Date().toISOString(),
    }, { merge: true });

    // Update riders with jersey images and ages
    let ridersUpdated = 0;
    if (enrichedTeamData.riders && enrichedTeamData.riders.length > 0) {
      for (const riderData of enrichedTeamData.riders) {
        if (!riderData.name) continue;

        // Find rider in rankings
        const riderSnapshot = await db.collection(`rankings_${year}`)
          .where('nameID', '==', riderData.name)
          .limit(1)
          .get();

        if (!riderSnapshot.empty) {
          const riderDoc = riderSnapshot.docs[0];
          const updateData: Record<string, unknown> = {};

          // Only update if we have valid data
          if (riderData.jerseyImage) {
            updateData.jerseyImage = riderData.jerseyImage;
          }

          // Handle age - should be a date string in YYYY-MM-DD format
          if (riderData.age && typeof riderData.age === 'string' && riderData.age.length > 0) {
            updateData.age = riderData.age;
          }

          // Only update if we have data to update
          if (Object.keys(updateData).length > 0) {
            await riderDoc.ref.update(updateData);
            ridersUpdated++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Team ${enrichedTeamData.teamName} succesvol verrijkt!`,
      teamName: enrichedTeamData.teamName,
      teamSlug: teamSlug,
      ridersCount: enrichedTeamData.riders?.length || 0,
      ridersUpdated: ridersUpdated,
      cacheInvalidated: true, // Signal to client to increment cache version
      teamData: {
        country: enrichedTeamData.country,
        class: enrichedTeamData.class,
        pcsRank: enrichedTeamData.pcsRank,
        uciRank: enrichedTeamData.uciRank,
        points: enrichedTeamData.points,
      },
    });

  } catch (error) {
    console.error('Error in enrich-team endpoint:', error);

    return NextResponse.json(
      { error: 'Er is een fout opgetreden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
