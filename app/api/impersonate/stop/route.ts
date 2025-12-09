import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/server';
import { cookies } from 'next/headers';

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
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Impersonation stopped',
      adminToken,
    });

    // Clear the impersonation cookie
    response.cookies.delete('impersonation');

    return response;
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    return NextResponse.json(
      { error: 'Failed to stop impersonation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
