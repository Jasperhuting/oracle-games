import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getAuth } from 'firebase-admin/auth';

// Helper function to check if user is a programmer
async function isProgrammer(request: NextRequest): Promise<boolean> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);

    const db = getServerFirebase();
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    return userData?.programmer === true;
  } catch (error) {
    console.error('Error checking programmer status:', error);
    return false;
  }
}

// GET - Fetch all translation documents
export async function GET(request: NextRequest) {
  try {
    const db = getServerFirebase();
    const translationsSnapshot = await db.collection('translations').get();

    const languages = translationsSnapshot.docs.map(doc => ({
      locale: doc.id,
      translations: doc.data(),
    }));

    return NextResponse.json({ languages });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
}

// POST - Create new language
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locale, translations } = body;

    if (!locale) {
      return NextResponse.json(
        { error: 'Locale is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if language already exists
    const existingDoc = await db.collection('translations').doc(locale).get();
    if (existingDoc.exists) {
      return NextResponse.json(
        { error: 'Language already exists' },
        { status: 400 }
      );
    }

    await db.collection('translations').doc(locale).set(translations || {});

    return NextResponse.json({ success: true, locale });
  } catch (error) {
    console.error('Error creating language:', error);
    return NextResponse.json(
      { error: 'Failed to create language' },
      { status: 500 }
    );
  }
}

// PUT - Update translations for a language
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { locale, translations } = body;

    if (!locale || !translations) {
      return NextResponse.json(
        { error: 'Locale and translations are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();
    await db.collection('translations').doc(locale).set(translations);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating translations:', error);
    return NextResponse.json(
      { error: 'Failed to update translations' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a language
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale');

    if (!locale) {
      return NextResponse.json(
        { error: 'Locale is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();
    await db.collection('translations').doc(locale).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting language:', error);
    return NextResponse.json(
      { error: 'Failed to delete language' },
      { status: 500 }
    );
  }
}
