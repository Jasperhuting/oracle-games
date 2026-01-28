import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1 } from '@/lib/firebase/server';
import { F1Team, F1_COLLECTIONS, createTeamDocId } from '../../types';

const f1Db = getServerFirebaseF1();

// GET /api/f1/teams?season=2026
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || new Date().getFullYear().toString());

    const teamsRef = f1Db.collection(F1_COLLECTIONS.TEAMS);
    const snapshot = await teamsRef
      .where('season', '==', season)
      .where('isActive', '==', true)
      .get();

    const teams = snapshot.docs.map(doc => doc.data() as F1Team);

    return NextResponse.json({ success: true, data: teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

// POST /api/f1/teams (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { team } = body as { team: Omit<F1Team, 'createdAt'> };

    if (!team || !team.id || !team.season) {
      return NextResponse.json(
        { success: false, error: 'Missing required team fields' },
        { status: 400 }
      );
    }

    const docId = createTeamDocId(team.id, team.season);
    const docRef = f1Db.collection(F1_COLLECTIONS.TEAMS).doc(docId);

    await docRef.set({
      ...team,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, data: { id: docId } });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create team' },
      { status: 500 }
    );
  }
}
