import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const impersonationCookie = cookieStore.get('impersonation')?.value;

    if (!impersonationCookie) {
      return NextResponse.json({
        isImpersonating: false,
      });
    }

    const impersonationData = JSON.parse(impersonationCookie);
    const { realAdminId, impersonatedUserId } = impersonationData;

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
