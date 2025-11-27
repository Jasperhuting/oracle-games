import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";

export async function GET() {
    try {
        const db = getServerFirebaseFootball();
        const snapshot = await db.collection('predictions').get();

        const predictions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({ predictions });
    } catch (error) {
        console.error('Error fetching predictions:', error);
        return NextResponse.json({
            error: 'Failed to fetch predictions',
            details: error instanceof Error ? error.message : 'Unknown error',
            predictions: [],
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId, rankings, matches } = await request.json();

        if (!userId) {
            return NextResponse.json({
                error: 'User ID is required'
            }, { status: 400 });
        }

        const db = getServerFirebaseFootball();

        console.log(`Saving predictions for user ${userId}`);

        // Save user's predictions
        await db.collection('predictions').doc(userId).set({
            userId,
            rankings,
            matches,
            updatedAt: new Date().toISOString()
        });

        return NextResponse.json({
            message: 'Predictions saved successfully',
            userId
        });

    } catch (error) {
        console.error('Error saving predictions:', error);
        return NextResponse.json({
            error: 'Failed to save predictions',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
