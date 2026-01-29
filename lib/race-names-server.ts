import { getServerFirebase } from './firebase/server';

export interface RaceInfo {
  slug: string;
  name: string;
}

/**
 * Fetches race names from the database for a given year
 * Returns a map of race slug to race name
 * SERVER-SIDE ONLY
 */
export async function getRaceNames(year?: number): Promise<Map<string, string>> {
  const db = getServerFirebase();
  const targetYear = year || new Date().getFullYear();
  
  try {
    const racesSnapshot = await db
      .collection('races')
      .where('year', '==', targetYear)
      .get();
    
    const raceNamesMap = new Map<string, string>();
    
    racesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || '';
      const name = data.name || '';
      
      if (slug && name) {
        raceNamesMap.set(slug, name);
      }
    });
    
    return raceNamesMap;
  } catch (error) {
    console.error('Error fetching race names:', error);
    return new Map<string, string>();
  }
}
