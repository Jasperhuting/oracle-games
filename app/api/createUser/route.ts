import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, email, playername, userType, authMethod } = body;
    

    if (!uid || !email || !playername || !userType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user already exists
    const existingUser = await db.collection('users').doc(uid).get();
    if (existingUser.exists) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Check if playername is already taken
    const existingPlayernameSnapshot = await db
      .collection('users')
      .where('playername', '==', playername)
      .limit(1)
      .get();

    if (!existingPlayernameSnapshot.empty) {
      return NextResponse.json(
        { error: 'Deze spelersnaam is al in gebruik' },
        { status: 409 }
      );
    }

    // Create user document in Firestore
    await db.collection('users').doc(uid).set({
      email,
      playername,
      createdAt: new Date().toISOString(),
      uid,
      updatedAt: new Date().toISOString(),
      userType: userType,
      authMethod: authMethod || 'email', // 'email', 'google', or 'passkey'
      lastLoginMethod: authMethod || 'email',
      lastLoginAt: new Date().toISOString(),
    });

    // Log the registration activity
    await db.collection('activityLogs').add({
      action: 'USER_REGISTERED',
      userId: uid,
      userEmail: email,
      userName: playername,
      details: {
        authMethod: authMethod || 'email',
        userType: userType,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
