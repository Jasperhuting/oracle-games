
import { getServerFirebaseFootball } from "@/lib/firebase/server";
import type { NextRequest } from "next/server";

export async function GET() {
  
  try {
    const db = getServerFirebaseFootball();
    const snapshot = await db.collection('contenders').get();

    interface Team {
      id: string;
      [key: string]: unknown;
    }
    
    const teams = snapshot.docs.map((doc): Team => ({
      id: doc.id,
      ...doc.data()
    }));

    return Response.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return Response.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
