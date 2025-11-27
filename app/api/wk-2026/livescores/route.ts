import { getServerFirebaseFootball } from '@/lib/firebase/server';

export async function GET() {
    try {
        const db = getServerFirebaseFootball();
        const liveScoresCollection = db.collection('livescores');

        const snapshot = await liveScoresCollection.get();
        const liveScores = snapshot.docs.map(doc => doc.data());
        console.log('Live scores from DB:', liveScores);
        return Response.json(liveScores);
    } catch (error) {
        console.error('Error fetching live scores:', error);
        return Response.json({ error: 'Failed to fetch live scores' }, { status: 500 });
    }
}