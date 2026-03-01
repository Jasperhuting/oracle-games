'use client';

import { useState, useRef, useEffect } from 'react';
import { IconMoodSmile } from '@tabler/icons-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

interface EmojiReactionsProps {
  reactions: Record<string, string[]>;
  roomId: string;
  messageId: string;
  currentUserId: string;
}

export default function EmojiReactions({
  reactions,
  roomId,
  messageId,
  currentUserId,
}: EmojiReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  const toggleReaction = async (emoji: string) => {
    if (loading) return;
    setLoading(true);
    setShowPicker(false);

    try {
      await fetch(`/api/chat/rooms/${roomId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: emoji, userId: currentUserId }),
      });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    toggleReaction(emojiData.emoji);
  };

  const reactionEntries = Object.entries(reactions).filter(
    ([, users]) => users.length > 0
  );

  return (
    <div className="flex items-center flex-wrap gap-1 mt-1">
      {reactionEntries.map(([emoji, users]) => {
        const hasReacted = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            disabled={loading}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
              hasReacted
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{emoji}</span>
            <span>{users.length}</span>
          </button>
        );
      })}

      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center justify-center h-6 w-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Reactie toevoegen"
        >
          <IconMoodSmile className="h-4 w-4" />
        </button>

        {showPicker && (
          <div className="absolute bottom-full right-0 mb-1 z-50">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.LIGHT}
              width={320}
              height={400}
              searchPlaceHolder="Zoek emoji..."
              previewConfig={{ showPreview: false }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
