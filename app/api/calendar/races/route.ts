import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { CalendarResponse, CalendarRace, CalendarGame } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<CalendarResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const db = getServerFirebase();

    // Fetch races for the year
    const racesSnapshot = await db
      .collection('races')
      .where('year', '==', year)
      .get();

    const races: CalendarRace[] = racesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        slug: data.slug || '',
        name: data.name || '',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        classification: data.classification || '',
        country: data.country || '',
        games: [], // Will be populated below
      };
    });

    // Sort races by start date
    races.sort((a, b) => a.startDate.localeCompare(b.startDate));

    // Fetch all games for the year to find which races they count
    const gamesSnapshot = await db
      .collection('games')
      .where('year', '==', year)
      .get();

    const seasonalGames: CalendarGame[] = [];
    const raceToGamesMap = new Map<string, CalendarGame[]>();

    gamesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const game: CalendarGame = {
        id: doc.id,
        name: data.name || '',
        gameType: data.gameType || '',
      };

      // Check if this is a seasonal game (all races count)
      if (data.raceType === 'season') {
        seasonalGames.push(game);
      }

      // Check if this game has specific counting races
      const config = data.config;
      if (config?.countingRaces && Array.isArray(config.countingRaces)) {
        config.countingRaces.forEach((countingRace: { raceId?: string; raceSlug?: string }) => {
          // Match by raceId (e.g., "tour-de-france_2026") or raceSlug
          const raceId = countingRace.raceId || `${countingRace.raceSlug}_${year}`;

          if (!raceToGamesMap.has(raceId)) {
            raceToGamesMap.set(raceId, []);
          }
          raceToGamesMap.get(raceId)!.push(game);
        });
      }
    });

    // Women's race classifications - these should not count seasonal games
    const WOMEN_CLASSIFICATIONS = ['1.WWT', '2.WWT'];

    // Keywords in race name/slug that indicate women's races
    const WOMEN_KEYWORDS = ['women', 'woman', 'ladies', 'féminin', 'feminin', 'dames', '-we_', '-we-'];

    // Helper function to check if a race is a women's race
    const isWomenRace = (race: CalendarRace): boolean => {
      // Check classification
      if (WOMEN_CLASSIFICATIONS.includes(race.classification)) {
        return true;
      }
      // Check race name and slug for women's keywords
      const nameAndSlug = `${race.name} ${race.slug}`.toLowerCase();
      return WOMEN_KEYWORDS.some(keyword => nameAndSlug.includes(keyword));
    };

    // const YOUTH_CLASSIFICATIONS = ['2.2U', '1.2U', '2.1', '2.2']
    // const YOUTH_KEYWORDS = ['mj', 'u23']

    // const isYouthRace = (race: CalendarRace): boolean => {
    //   if (YOUTH_CLASSIFICATIONS.includes(race.classification)) {
    //     return true;
    //   }
    //   // Check race name and slug for women's keywords
    //   const nameAndSlug = `${race.name} ${race.slug}`.toLowerCase();
    //   return YOUTH_KEYWORDS.some(keyword => nameAndSlug.includes(keyword));
    // }

    // Attach games to races
    races.forEach(race => {
      const gamesForRace = raceToGamesMap.get(race.id) || [];

      // For women's races, only include race-specific games, not seasonal games
      if (isWomenRace(race)) {
        race.games = gamesForRace; // Only race-specific games
      } else {
        race.games = [...seasonalGames, ...gamesForRace]; // Include seasonal games
      }
    });

    return NextResponse.json({
      races,
      seasonalGames,
    });
  } catch (error) {
    console.error('Error fetching calendar races:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar races' },
      { status: 500 }
    );
  }
}
