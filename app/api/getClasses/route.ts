import { getServerFirebase } from "@/lib/firebase/server";

export async function GET() {
  
const db = getServerFirebase();
    const teamsSnapshot = await db.collection('teams').get();

    const allClasses: string[] = teamsSnapshot.docs
                    .map(doc => doc.data().class)
                    .filter(Boolean); // remove null/undefined
                
                // Deduplicate
                const uniqueClasses = Array.from(new Set(allClasses)).sort();

                return Response.json({ classes: uniqueClasses });
}
