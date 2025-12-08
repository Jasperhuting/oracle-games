import { getServerFirebase } from '@/lib/firebase/server';
import { toSlug } from '@/lib/firebase/utils';

interface RiderData {
  name: string;
  dnf?: number;
  dns?: number;
}

export async function saveRidersToRace(
  riders: RiderData[],
  raceSlug: string,
  year: number
): Promise<number> {
  const db = getServerFirebase();

  const results = await Promise.all(riders.map(async (riderData) => {
    // Try to find rider in rankings collection
    let riderDoc = await db.collection(`rankings_${year}`).doc(riderData.name).get();
    let riderFullData = riderDoc.data();
    
    // If not found, try with toSlug applied
    if (!riderFullData) {
      const sluggedName = toSlug(riderData.name);
      if (sluggedName !== riderData.name) {
        riderDoc = await db.collection(`rankings_${year}`).doc(sluggedName).get();
        riderFullData = riderDoc.data();
      }
    }
    
    if (!riderFullData) {
      console.warn(`Rider ${riderData.name} not found in rankings_${year}`);
      return false;
    }
    
    const docData: {
      rider: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      dnf?: number;
      dns?: number;
    } = { 
      rider: riderFullData,
    };
    
    if (riderData.dnf !== undefined) {
      docData.dnf = riderData.dnf;
    }
    
    if (riderData.dns !== undefined) {
      docData.dns = riderData.dns;
    }
    
    await db.collection(raceSlug).doc(riderData.name).set(docData);
    return true;
  }));

  const ridersProcessed = results.filter(Boolean).length;
  return ridersProcessed;
}
