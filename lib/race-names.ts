/**
 * Client-side function to fetch race names via API
 */
export async function getRaceNamesClient(year?: number): Promise<Map<string, string>> {
  try {
    const targetYear = year || new Date().getFullYear();
    const response = await fetch(`/api/calendar/races?year=${targetYear}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch race names');
    }
    
    const data = await response.json();
    const raceNamesMap = new Map<string, string>();
    
    if (data.races && Array.isArray(data.races)) {
      data.races.forEach((race: any) => {
        if (race.slug && race.name) {
          raceNamesMap.set(race.slug, race.name);
        }
      });
    }
    
    return raceNamesMap;
  } catch (error) {
    console.error('Error fetching race names client-side:', error);
    return new Map<string, string>();
  }
}
