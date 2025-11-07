import { getServerFirebase } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";

export async function GET() {
  
  try {
    const db = getServerFirebase();
    const snapshot = await db.collection('teams').orderBy('points', 'desc').get();

    const teams = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return Response.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
