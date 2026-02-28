import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';

const DEFAULT_CATEGORIES = [
  { name: 'Algemeen', slug: 'algemeen', order: 1 },
  { name: 'Vragen & Hulp', slug: 'vragen-hulp', order: 2 },
  { name: 'Spellen', slug: 'spellen', order: 3 },
  { name: 'Off-topic', slug: 'off-topic', order: 4 },
  { name: 'Test (verwijder me)', slug: 'test', order: 99 },
];

export async function POST(): Promise<NextResponse> {
  try {
    const batch = adminDb.batch();

    for (const category of DEFAULT_CATEGORIES) {
      const docRef = adminDb.collection('forum_categories').doc(category.slug);
      batch.set(docRef, {
        name: category.name,
        slug: category.slug,
        order: category.order,
        isActive: true,
      }, { merge: true });
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error seeding forum categories:', error);
    return NextResponse.json({ error: 'Failed to seed categories' }, { status: 500 });
  }
}
