'use client';

import { useRef, useEffect, useState } from 'react';
import { useChatMessages } from '@/hooks/useChatMessages';
import ChatMessageItem from './ChatMessageItem';

interface ReplyTo {
  messageId: string;
  userName: string;
  text: string;
}

interface ChatMessageListProps {
  roomId: string;
  replyingTo: ReplyTo | null;
  onReply: (msg: ReplyTo) => void;
  currentUserId: string;
  isAdmin?: boolean;
}

export default function ChatMessageList({
  roomId,
  onReply,
  currentUserId,
  isAdmin = false,
}: ChatMessageListProps) {
  const { messages, loading, hasMore, loadMore } = useChatMessages(roomId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const prevMessageCount = useRef(0);

  // Track scroll position to decide auto-scroll behavior
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Auto-scroll if user is near the bottom (within 100px)
    setShouldAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && messages.length > prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, shouldAutoScroll]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [loading]);

  const handleLoadMore = async () => {
    const container = containerRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;
    setLoadingMore(true);
    await loadMore();
    setLoadingMore(false);

    // Preserve scroll position after loading older messages
    requestAnimationFrame(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeight;
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        Berichten laden...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
    >
      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center py-3">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400 transition-colors"
          >
            {loadingMore ? 'Laden...' : 'Laad meer berichten'}
          </button>
        </div>
      )}

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12 text-sm text-gray-400">
          Nog geen berichten. Begin het gesprek!
        </div>
      ) : (
        <div className="py-2">
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              roomId={roomId}
              currentUserId={currentUserId}
              onReply={onReply}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
