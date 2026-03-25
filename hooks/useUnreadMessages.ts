import { useUnreadInboxSummary } from './useUnreadInboxSummary';

export function useUnreadMessages(userId: string | undefined) {
  const { count, loading } = useUnreadInboxSummary(userId);

  return {
    unreadCount: count,
    loading,
  };
}
