import { getServerFirebase } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const { teamId, teamClass } = await request.json();

  if (!teamId || !teamClass) {
    return Response.json({ error: 'Missing teamId or teamClass' }, { status: 400 });
  }

  try {
    const db = getServerFirebase();
    
    await db.collection('teams').doc(teamId).update({
      class: teamClass,
    });

    // Increment cache version to invalidate client caches
    const configRef = db.collection('config').doc('cache');
    const configDoc = await configRef.get();
    const currentVersion = configDoc.exists ? (configDoc.data()?.version || 1) : 1;
    await configRef.set({
      version: currentVersion + 1,
      updatedAt: Timestamp.now()
    }, { merge: true });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating team class:', error);
    return Response.json({ error: 'Failed to update team class' }, { status: 500 });
  }
}
