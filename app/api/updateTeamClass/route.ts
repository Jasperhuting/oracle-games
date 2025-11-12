import { getServerFirebase } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";

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

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating team class:', error);
    return Response.json({ error: 'Failed to update team class' }, { status: 500 });
  }
}
