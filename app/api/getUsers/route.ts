import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { UsersListResponse, ApiErrorResponse, User } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<UsersListResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const forMessaging = searchParams.get('forMessaging') === 'true';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify requesting user exists
    const requestingUserDoc = await db.collection('users').doc(userId).get();
    if (!requestingUserDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isAdmin = requestingUserDoc.data()?.userType === 'admin';

    // For non-messaging requests, only admins can access
    if (!forMessaging && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all users
    const usersSnapshot = await db
      .collection('users')
      .orderBy('createdAt', 'desc')
      .get();

    let users: User[] = usersSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data()
    } as User));

    // For messaging, filter out deleted users and only return basic info
    if (forMessaging) {
      users = users.filter((user) => !user.deletedAt);
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
