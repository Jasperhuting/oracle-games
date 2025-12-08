// Helper function to log activities from client-side
export const logActivity = async (
  action: string,
  userId: string,
  userEmail?: string,
  userName?: string,
  targetUserId?: string,
  targetUserEmail?: string,
  targetUserName?: string,
  details?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
) => {
  try {
    await fetch('/api/logActivity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        userId,
        userEmail,
        userName,
        targetUserId,
        targetUserEmail,
        targetUserName,
        details,
      }),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging should not break the main flow
  }
};
