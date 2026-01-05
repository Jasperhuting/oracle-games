import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { ClientGameCategory } from '@/lib/types/games';
import { Timestamp } from 'firebase-admin/firestore';

// GET /api/gameCategories - Get all game categories
export async function GET(): Promise<NextResponse> {
  try {
    const db = getServerFirebase();
    const categoriesSnapshot = await db.collection('gameCategories').orderBy('order', 'asc').get();

    const categories: ClientGameCategory[] = categoriesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        slug: data.slug,
        order: data.order,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as ClientGameCategory;
    });

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching game categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game categories', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/gameCategories - Create a new game category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, order, userId } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

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

    // Check if slug already exists
    const existingCategory = await db.collection('gameCategories').where('slug', '==', slug).get();
    if (!existingCategory.empty) {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 400 }
      );
    }

    const now = Timestamp.now();
    const categoryData = {
      name,
      slug,
      order: order ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('gameCategories').add(categoryData);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Game category created successfully'
    });
  } catch (error) {
    console.error('Error creating game category:', error);
    return NextResponse.json(
      { error: 'Failed to create game category', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/gameCategories - Update a game category
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, slug, order, userId } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

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

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (order !== undefined) updateData.order = order;

    await db.collection('gameCategories').doc(id).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Game category updated successfully'
    });
  } catch (error) {
    console.error('Error updating game category:', error);
    return NextResponse.json(
      { error: 'Failed to update game category', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/gameCategories - Delete a game category
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

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

    await db.collection('gameCategories').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Game category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting game category:', error);
    return NextResponse.json(
      { error: 'Failed to delete game category', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
