import { getServerFirebase } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";
import { toSlug } from "@/lib/firebase/utils";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const { riderId, teamSlug, year } = await request.json();

  if (!riderId || !teamSlug || !year) {
    return Response.json({ error: 'Missing riderId, teamSlug, or year' }, { status: 400 });
  }

  try {
    const db = getServerFirebase();
    
    // Get team reference
    const teamDoc = await db.collection('teams').doc(teamSlug).get();
    
    if (!teamDoc.exists) {
      return Response.json({ error: 'Team not found' }, { status: 404 });
    }

    // Update rider's team reference
    await db.collection(`rankings_${year}`).doc(riderId).update({
      team: teamDoc.ref,
    });

    // Increment cache version to invalidate client caches
    const configRef = db.collection('config').doc('cache');
    const configDoc = await configRef.get();
    const currentVersion = configDoc.exists ? (configDoc.data()?.version || 1) : 1;
    await configRef.set({
      version: currentVersion + 1,
      updatedAt: Timestamp.now()
    }, { merge: true });

    return Response.json({ success: true, team: teamDoc.data() });
  } catch (error) {
    console.error('Error updating rider team:', error);
    return Response.json({ error: 'Failed to update rider team' }, { status: 500 });
  }
}
