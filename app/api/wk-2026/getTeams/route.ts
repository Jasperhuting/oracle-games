
import { getServerFirebaseFootball } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";

export async function GET() {
  
  try {
    const db = getServerFirebaseFootball();
    const snapshot = await db.collection('contenders').get();

    const teams = snapshot.docs.map((doc: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return Response.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
