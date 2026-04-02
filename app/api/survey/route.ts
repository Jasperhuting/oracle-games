import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { SurveyAnswers } from '@/lib/types/survey';

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
      answers: answers ?? { q1: '', q2: '', q3: '', q4: '' },
      submittedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving survey response:', error);
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  }
}
