import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

const db = getServerFirebase();

// GET /api/users/names?ids=id1,id2,id3 - Get display names for user IDs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json(
        { success: false, error: 'Missing ids parameter' },
        { status: 400 }
      );
    }

    const userIds = idsParam.split(',').filter(Boolean);

    if (userIds.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    // Limit to prevent abuse
    if (userIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Too many IDs requested (max 50)' },
        { status: 400 }
      );
    }

    // Fetch user documents
    const userNames: Record<string, string> = {};
    const userAvatars: Record<string, string | undefined> = {};

    // Firestore doesn't support batched gets with more than 10 docs in 'in' query
    // So we need to batch the requests
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batchIds = userIds.slice(i, i + batchSize);
      const snapshot = await db.collection('users')
        .where('__name__', 'in', batchIds)
        .get();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        userNames[doc.id] = data.playername || data.name || data.displayName || 'Anonymous';
        if (data.avatarUrl) {
          userAvatars[doc.id] = data.avatarUrl;
        }
      });
    }

    // Fill in any missing IDs with a placeholder
    userIds.forEach((id) => {
      if (!userNames[id]) {
        userNames[id] = 'Anonymous';
      }
    });

    return NextResponse.json({ success: true, data: userNames, avatars: userAvatars });
  } catch (error) {
    console.error('Error fetching user names:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user names' },
      { status: 500 }
    );
  }
}
