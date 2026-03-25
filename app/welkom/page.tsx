import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerAuth, getServerFirebase } from '@/lib/firebase/server';
import { OnboardingForm } from './OnboardingForm';

export default async function WelkomPage() {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) {
    redirect('/login');
  }

  let decodedToken;
  try {
    decodedToken = await getServerAuth().verifySessionCookie(sessionCookie);
  } catch {
    redirect('/login');
  }

  if (decodedToken.email_verified !== true) {
    redirect('/login');
  }

  const userDoc = await getServerFirebase().collection('users').doc(decodedToken.uid).get();
  const userData = userDoc.data();

  // If onboardingShown is not exactly false (undefined or true) → skip onboarding
  if (userData?.onboardingShown !== false) {
    redirect('/');
  }

  return (
    <main>
      <OnboardingForm />
    </main>
  );
}
