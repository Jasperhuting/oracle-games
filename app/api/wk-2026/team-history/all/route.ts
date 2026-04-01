import { NextResponse } from 'next/server';
import { getServerFirebaseFootball } from '@/lib/firebase/server';
import type { TeamHistoryResponse } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const db = getServerFirebaseFootball();
        const snapshot = await db.collection('wk2026TeamHistory').get();

        const result: Record<string, TeamHistoryResponse> = {};
        snapshot.docs.forEach(doc => {
            result[doc.id] = doc.data() as TeamHistoryResponse;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching all team history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
