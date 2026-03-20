import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';
import { getSharedCookieDomain } from '@/lib/auth/session-cookie';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get('impersonation')?.value;

    if (!impersonationCookie) {
      return NextResponse.json(
        { error: 'Not impersonating' },
        { status: 400 }
      );
    }

    const impersonationData = JSON.parse(impersonationCookie);
    const { realAdminId, impersonatedUserId } = impersonationData;

    // Get admin user data for logging
    const adminUserDoc = await adminDb.collection('users').doc(realAdminId).get();
    const adminUserData = adminUserDoc.data();

    // Get impersonated user data for logging
    const targetUserDoc = await adminDb.collection('users').doc(impersonatedUserId).get();
    const targetUserData = targetUserDoc.data();
    
    // Create a custom token for the admin to restore their session
    const adminToken = await adminAuth.createCustomToken(realAdminId);

    // Log the end of impersonation
    await adminDb.collection('activityLogs').add({
      action: 'IMPERSONATION_STOPPED',
      userId: realAdminId,
      userEmail: adminUserData?.email || 'unknown',
      userName: adminUserData?.playername || 'unknown',
      details: {
        targetUserId: impersonatedUserId,
        targetUserEmail: targetUserData?.email,
        targetUserName: targetUserData?.playername,
        duration: new Date().getTime() - new Date(impersonationData.startedAt).getTime(),
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Impersonation stopped',
      adminToken,
    });

    const normalizedHost = (request.headers.get('host') || '').split(':')[0].toLowerCase();
    const sharedDomain = getSharedCookieDomain(request.headers.get('host'));
    const sharedDomainWithoutDot = sharedDomain?.replace(/^\./, '');
    const expiredAt = new Date(0);

    const clearOptions = [
      undefined,
      sharedDomain,
      sharedDomainWithoutDot,
      normalizedHost || undefined,
      normalizedHost ? `.${normalizedHost}` : undefined,
    ].filter((value, index, array) => Boolean(value) ? array.indexOf(value) === index : index === 0);

    for (const domain of clearOptions) {
      response.cookies.set('impersonation', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        expires: expiredAt,
        ...(domain ? { domain } : {}),
      });
    }

    return response;
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    return NextResponse.json(
      { error: 'Failed to stop impersonation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
