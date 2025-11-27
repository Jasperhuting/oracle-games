import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;

        const db = getServerFirebaseFootball();

        // Fetch user's predictions
        const predictionDoc = await db.collection('predictions').doc(userId).get();

        if (!predictionDoc.exists) {
            return NextResponse.json({
                predictions: null,
                message: 'No predictions found for this user'
            });
        }

        return NextResponse.json({
            predictions: predictionDoc.data()
        });

    } catch (error) {
        console.error('Error fetching predictions:', error);
        return NextResponse.json({
            error: 'Failed to fetch predictions',
            details: error instanceof Error ? error.message : 'Unknown error',
            predictions: null
        }, { status: 500 });
    }
}
