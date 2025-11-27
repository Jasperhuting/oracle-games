import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { NextResponse } from 'next/server';
export const runtime = "nodejs";

export async function GET() {
    try {
        const db = getServerFirebaseFootball();

        // Fetch all poule documents
        const poulesSnapshot = await db.collection('poules').get();

        const poules = poulesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({
            poules,
            count: poules.length
        });

    } catch (error) {
        console.error('Error fetching poules:', error);
        return NextResponse.json({
            error: 'Failed to fetch poules',
            details: error instanceof Error ? error.message : 'Unknown error',
            poules: []
        }, { status: 500 });
    }
}
