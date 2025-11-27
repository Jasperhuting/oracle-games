import { NextResponse } from 'next/server';
import { getServerFirebaseFootball } from '@/lib/firebase/server';

export async function GET() {
    try {
        const db = getServerFirebaseFootball();
        
        // Fetch poules data
        const poulesRef = db.collection('poules');
        const poulesSnapshot = await poulesRef.get();
        
        const poules: { id: string; pouleId: string; teamIds: string[]; teams: Record<string, any> }[] = [];
        poulesSnapshot.forEach(doc => {
            const data = doc.data();
            poules.push({ 
                id: doc.id, 
                pouleId: data.pouleId || '',
                teamIds: data.teamIds || [],
                teams: data.teams || {}
            });
        });
        
        return NextResponse.json({ poules });
    } catch (error) {
        console.error('Error fetching poules:', error);
        return NextResponse.json(
            { error: 'Failed to fetch poules' }, 
            { status: 500 }
        );
    }
}