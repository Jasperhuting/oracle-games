import { NextResponse } from 'next/server';
import { adminAuth, adminDb, getServerAuth } from '@/lib/firebase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get('impersonation')?.value;
    const sessionCookie = cookieStore.get('session')?.value;

    if (!impersonationCookie) {
      return NextResponse.json({
        isImpersonating: false,
      });
    }

    const impersonationData = JSON.parse(impersonationCookie);
    const { realAdminId, impersonatedUserId } = impersonationData;

    if (sessionCookie) {
      try {
        const auth = getServerAuth();
        const decodedSession = await auth.verifySessionCookie(sessionCookie);

        if (decodedSession.uid !== impersonatedUserId) {
          return NextResponse.json({
            isImpersonating: false,
            clearedBecauseSessionUserDiffers: true,
            sessionUserId: decodedSession.uid,
            realAdminId,
            impersonatedUserId,
          });
        }
      } catch (error) {
        console.error('Error verifying session cookie for impersonation status:', error);
      }
    }

    // Get admin and impersonated user data
    const [adminUserDoc, targetUserDoc] = await Promise.all([
      adminDb.collection('users').doc(realAdminId).get(),
      adminDb.collection('users').doc(impersonatedUserId).get(),
    ]);

    const adminUserData = adminUserDoc.data();
    const targetUserData = targetUserDoc.data();

    // Get auth records
    const [adminAuthUser, targetAuthUser] = await Promise.all([
      adminAuth.getUser(realAdminId),
      adminAuth.getUser(impersonatedUserId),
    ]);

    return NextResponse.json({
      isImpersonating: true,
      realAdmin: {
        uid: adminAuthUser.uid,
        email: adminAuthUser.email,
        displayName: adminUserData?.playername || adminAuthUser.displayName,
      },
      impersonatedUser: {
        uid: targetAuthUser.uid,
        email: targetAuthUser.email,
        displayName: targetUserData?.playername || targetAuthUser.displayName,
      },
      startedAt: impersonationData.startedAt,
    });
  } catch (error) {
    console.error('Error getting impersonation status:', error);
    return NextResponse.json({
      isImpersonating: false,
    });
  }
}
