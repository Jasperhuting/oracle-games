import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { userHandler, ApiError } from '@/lib/api/handler';

export const POST = userHandler('onboarding', async (ctx) => {
  const { request, uid } = ctx;
  const body = await request.json();
  const { firstName, lastName, dateOfBirth, preferredLanguage, avatarUrl } = body;

  // Type guards: ensure all fields are strings before validation
  const safeFirstName = typeof firstName === 'string' && firstName.length > 0 ? firstName : undefined;
  const safeLastName = typeof lastName === 'string' && lastName.length > 0 ? lastName : undefined;
  const safeDateOfBirth = typeof dateOfBirth === 'string' && dateOfBirth.length > 0 ? dateOfBirth : undefined;
  const safePreferredLanguage = typeof preferredLanguage === 'string' && preferredLanguage.length > 0 ? preferredLanguage : undefined;
  const safeAvatarUrl = typeof avatarUrl === 'string' && avatarUrl.length > 0 ? avatarUrl : undefined;

  // Validate firstName
  if (safeFirstName !== undefined) {
    if (safeFirstName.length > 50) {
      throw new ApiError('Voornaam mag maximaal 50 tekens bevatten', 400);
    }
  }

  // Validate lastName
  if (safeLastName !== undefined) {
    if (safeLastName.length > 50) {
      throw new ApiError('Achternaam mag maximaal 50 tekens bevatten', 400);
    }
  }

  // Validate avatarUrl
  if (safeAvatarUrl !== undefined) {
    if (!safeAvatarUrl.startsWith('https://')) {
      throw new ApiError('Ongeldige URL voor avatar', 400);
    }
  }

  // Validate preferredLanguage
  if (safePreferredLanguage !== undefined) {
    if (!['en', 'nl'].includes(safePreferredLanguage)) {
      throw new ApiError('Ongeldige taalvoorkeur', 400);
    }
  }

  // Validate dateOfBirth
  if (safeDateOfBirth !== undefined) {
    const date = new Date(safeDateOfBirth);
    if (isNaN(date.getTime())) {
      throw new ApiError('Vul een geldige geboortedatum in (minimumleeftijd 13 jaar)', 400);
    }
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    if (age < 13 || age > 120) {
      throw new ApiError('Vul een geldige geboortedatum in (minimumleeftijd 13 jaar)', 400);
    }
  }

  const db = getServerFirebase();

  // Build update data
  const updateData: Record<string, unknown> = {
    onboardingShown: true,
    updatedAt: Timestamp.now(),
  };

  // Add optional fields if provided and non-empty
  if (safeFirstName !== undefined) updateData.firstName = safeFirstName;
  if (safeLastName !== undefined) updateData.lastName = safeLastName;
  if (safeDateOfBirth !== undefined) updateData.dateOfBirth = safeDateOfBirth;
  if (safePreferredLanguage !== undefined) updateData.preferredLanguage = safePreferredLanguage;
  if (safeAvatarUrl !== undefined) updateData.avatarUrl = safeAvatarUrl;

  // Update user document
  await db.collection('users').doc(uid).update(updateData);

  return {
    success: true,
  };
});
