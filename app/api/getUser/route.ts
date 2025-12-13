import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { UserResponse, ApiErrorResponse } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<UserResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    
    return NextResponse.json({
      uid: userData?.uid,
      email: userData?.email,
      playername: userData?.playername,
      firstName: userData?.firstName,
      lastName: userData?.lastName,
      dateOfBirth: userData?.dateOfBirth,
      createdAt: userData?.createdAt,
      updatedAt: userData?.updatedAt,
      userType: userData?.userType,
      programmer: userData?.programmer || false,
      preferredLanguage: userData?.preferredLanguage || 'nl',
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
