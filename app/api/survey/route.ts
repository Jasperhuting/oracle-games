import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase/server';
import { getServerAuth } from '@/lib/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { SurveyAnswers } from '@/lib/types/survey';
import { SURVEY_ROUND_ID } from '@/lib/constants/survey';

async function getVerifiedUid(request: NextRequest): Promise<string | null> {
  try {
    const auth = getServerAuth();
    const authHeader = request.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = await auth.verifyIdToken(token);
      return decoded.uid;
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (sessionCookie) {
      const decoded = await auth.verifySessionCookie(sessionCookie);
      return decoded.uid;
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userName, roundId, skipped, answers } = body as {
      userId: string;
      userName: string;
      roundId: string;
      skipped: boolean;
      answers: SurveyAnswers;
    };

    if (!userId || !roundId) {
      return NextResponse.json({ error: 'userId en roundId zijn verplicht' }, { status: 400 });
    }

    const verifiedUid = await getVerifiedUid(request);
    if (!verifiedUid) {
      return NextResponse.json({ error: 'Authenticatie vereist' }, { status: 401 });
    }

    if (verifiedUid !== userId) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    if (roundId !== SURVEY_ROUND_ID) {
      return NextResponse.json({ error: 'Ongeldige roundId' }, { status: 400 });
    }

    const docId = `${userId}_${roundId}`;
    const docRef = adminDb.collection('survey_responses').doc(docId);
    const existing = await docRef.get();

    if (existing.exists) {
      return NextResponse.json({ error: 'Al eerder ingevuld voor deze ronde' }, { status: 409 });
    }

    await docRef.set({
      userId,
      userName: userName || 'Onbekend',
      roundId,
      skipped: skipped ?? false,
      answers: answers ?? { q1: '', q2: '', q3: '', q4: '', q5: '', q6: '' },
      submittedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving survey response:', error);
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  }
}
