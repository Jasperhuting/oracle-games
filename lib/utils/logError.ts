/**
 * Utility function to log errors to the activity log
 */
export async function logError({
  userId,
  userEmail,
  userName,
  operation,
  errorMessage,
  errorDetails,
  gameId,
  endpoint,
  additionalDetails,
}: {
  userId: string;
  userEmail?: string;
  userName?: string;
  operation: string;
  errorMessage: string;
  errorDetails?: string;
  gameId?: string;
  endpoint?: string;
  additionalDetails?: Record<string, any>;
}) {
  try {
    await fetch('/api/logActivity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'ERROR',
        userId,
        userEmail,
        userName,
        details: {
          operation,
          errorMessage,
          errorDetails,
          gameId,
          endpoint,
          ...additionalDetails,
        },
      }),
    });
  } catch (error) {
    // Silently fail - we don't want to create infinite error loops
    console.error('Failed to log error to activity log:', error);
  }
}
