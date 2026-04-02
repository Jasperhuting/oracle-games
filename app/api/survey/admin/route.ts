import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { requireAdmin, toAdminErrorResponse } from '@/lib/auth/requireAdmin';
import type { SurveyResponse } from '@/lib/types/survey';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const snapshot = await adminDb
      .collection('survey_responses')
      .orderBy('submittedAt', 'desc')
      .get();

    const responses: SurveyResponse[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        submittedAt: data.submittedAt?.toDate().toISOString() ?? '',
      } as SurveyResponse;
    });

    return NextResponse.json({ responses });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
