import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import type { ForumCategory } from '@/lib/types/forum';

export async function GET(): Promise<NextResponse> {
  try {
    const snapshot = await adminDb.collection('forum_categories').get();

    const categories = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          slug: data.slug,
          order: data.order ?? 0,
          isActive: data.isActive !== false,
        } as ForumCategory;
      })
      .filter((category) => category.isActive)
      .sort((a, b) => a.order - b.order);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching forum categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
