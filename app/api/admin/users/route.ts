import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

// GET /api/admin/users - Get all admin users
export async function GET(request: NextRequest) {
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

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get all admin users
    const adminsSnapshot = await db.collection('users')
      .where('userType', '==', 'admin')
      .get();

    const admins: AdminUser[] = [];
    adminsSnapshot.forEach((doc) => {
      const data = doc.data();
      admins.push({
        id: doc.id,
        name: data.playername || data.displayName || data.email || 'Unknown',
        email: data.email || '',
      });
    });

    // Sort by name
    admins.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(admins);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
