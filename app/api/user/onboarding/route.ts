import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { userHandler, ApiError } from '@/lib/api/handler';

export const POST = userHandler('onboarding', async (ctx) => {
  const { request, uid } = ctx;
  const body = await request.json();
  const { firstName, lastName, dateOfBirth, preferredLanguage, avatarUrl } = body;

  // Validate firstName
  if (firstName !== undefined && firstName !== null && firstName !== '') {
    if (firstName.length > 50) {
      throw new ApiError('firstName exceeds 50 characters', 400);
    }
  }

  // Validate lastName
  if (lastName !== undefined && lastName !== null && lastName !== '') {
    if (lastName.length > 50) {
      throw new ApiError('lastName exceeds 50 characters', 400);
    }
  }

  // Validate preferredLanguage
  if (preferredLanguage !== undefined && preferredLanguage !== null && preferredLanguage !== '') {
    if (!['en', 'nl'].includes(preferredLanguage)) {
      throw new ApiError('Ongeldige taalvoorkeur', 400);
    }
  }

  // Validate dateOfBirth
  if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '') {
    const date = new Date(dateOfBirth);
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
  if (firstName && firstName.length > 0) updateData.firstName = firstName;
  if (lastName && lastName.length > 0) updateData.lastName = lastName;
  if (dateOfBirth && dateOfBirth.length > 0) updateData.dateOfBirth = dateOfBirth;
  if (preferredLanguage && preferredLanguage.length > 0) updateData.preferredLanguage = preferredLanguage;
  if (avatarUrl && avatarUrl.length > 0) updateData.avatarUrl = avatarUrl;

  // Update user document
  await db.collection('users').doc(uid).update(updateData);

  return {
    success: true,
  };
});
