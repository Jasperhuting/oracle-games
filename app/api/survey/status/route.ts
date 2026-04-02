import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { getServerAuth } from '@/lib/firebase/server';
import { cookies } from 'next/headers';
import { SURVEY_ROUND_ID } from '@/lib/constants/survey';

async function getVerifiedUid(request: NextRequest): Promise<string | null> {
  const auth = getServerAuth();

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await auth.verifyIdToken(authHeader.slice(7));
      return decoded.uid;
    } catch {
      return null;
    }
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (sessionCookie) {
    try {
      const decoded = await auth.verifySessionCookie(sessionCookie);
      return decoded.uid;
    } catch {
      return null;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const uid = await getVerifiedUid(request);
    if (!uid) {
      return NextResponse.json({ hasResponded: false });
    }

    const docId = `${uid}_${SURVEY_ROUND_ID}`;
    const snap = await adminDb.collection('survey_responses').doc(docId).get();
    return NextResponse.json({ hasResponded: snap.exists() });
  } catch (error) {
    console.error('Error checking survey status:', error);
    return NextResponse.json({ hasResponded: false });
  }
}
