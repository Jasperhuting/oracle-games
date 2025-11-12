import { getServerFirebase } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";
import { toSlug } from "@/lib/firebase/utils";

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

    return Response.json({ success: true, team: teamDoc.data() });
  } catch (error) {
    console.error('Error updating rider team:', error);
    return Response.json({ error: 'Failed to update rider team' }, { status: 500 });
  }
}
