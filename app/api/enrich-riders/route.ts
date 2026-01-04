import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { enrichRidersPuppeteer } from '@/lib/scraper/enrichRidersPuppeteer';

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

    // Enrich riders data from ProCyclingStats
    let enrichedData;
    try {
      enrichedData = await enrichRidersPuppeteer({ year, team: team.trim() });
    } catch (scrapeError) {
      const errorMessage = scrapeError instanceof Error ? scrapeError.message : 'Failed to scrape riders data';

      return NextResponse.json(
        { error: 'Kon renner gegevens niet ophalen: ' + errorMessage },
        { status: 500 }
      );
    }

    // Validate enriched data
    if (!enrichedData || !enrichedData.riders || enrichedData.riders.length === 0) {
      return NextResponse.json(
        { error: 'Geen renner data ontvangen van ProCyclingStats' },
        { status: 400 }
      );
    }

    // Update riders with jersey images and ages
    let ridersUpdated = 0;
    for (const riderData of enrichedData.riders) {
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

    return NextResponse.json({
      success: true,
      message: `Renners van team ${team} succesvol verrijkt!`,
      teamName: enrichedData.name || team,
      ridersCount: enrichedData.riders?.length || 0,
      ridersUpdated: ridersUpdated,
      cacheInvalidated: true, // Signal to client to increment cache version
    });

  } catch (error) {
    console.error('Error in enrich-riders endpoint:', error);

    return NextResponse.json(
      { error: 'Er is een fout opgetreden', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
