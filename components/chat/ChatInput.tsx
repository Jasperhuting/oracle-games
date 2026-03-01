'use client';

import { useState, useRef, useEffect } from 'react';
import { IconSend, IconX } from '@tabler/icons-react';

interface ReplyTo {
  messageId: string;
  userName: string;
  text: string;
}

interface ChatInputProps {
  roomId: string;
  user: {
    uid: string;
    displayName: string | null;
    photoURL?: string | null;
  };
  replyingTo: ReplyTo | null;
  onClearReply: () => void;
  disabled: boolean;
  disabledReason?: string;
}

export default function ChatInput({
  roomId,
  user,
  replyingTo,
  onClearReply,
  disabled,
  disabledReason,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      const body: Record<string, unknown> = {
        text: trimmed,
        userId: user.uid,
        userName: user.displayName || 'Anoniem',
        userAvatar: user.photoURL || null,
      };

      if (replyingTo) {
        body.replyTo = {
          messageId: replyingTo.messageId,
          userName: replyingTo.userName,
          text: replyingTo.text,
        };
      }

      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setText('');
        onClearReply();
      } else {
        console.error('Failed to send message:', await res.text());
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  if (disabled) {
    return (
      <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
        <p className="text-sm text-gray-500 text-center">
          {disabledReason || 'Chat is gesloten.'}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-600 font-medium">
              Antwoord op {replyingTo.userName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {replyingTo.text}
            </p>
          </div>
          <button
            onClick={onClearReply}
            className="p-1 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Typ een bericht..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm outline-none"
          disabled={sending}
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex-shrink-0"
          title="Verstuur"
        >
          <IconSend className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
