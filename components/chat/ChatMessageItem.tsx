'use client';

import { useMemo } from 'react';
import { IconArrowBackUp } from '@tabler/icons-react';
import { Timestamp } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types/chat';
import EmojiReactions from './EmojiReactions';

interface ChatMessageItemProps {
  message: ChatMessage;
  roomId: string;
  currentUserId: string;
  onReply: (msg: { messageId: string; userName: string; text: string }) => void;
}

function getInitialColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function formatTimestamp(createdAt: Timestamp | string): string {
  const date =
    createdAt instanceof Timestamp
      ? createdAt.toDate()
      : new Date(createdAt);

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'Zojuist';
  if (diffMin < 60) return `${diffMin} min geleden`;
  if (diffHour < 24) {
    return date.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatMessageItem({
  message,
  roomId,
  currentUserId,
  onReply,
}: ChatMessageItemProps) {
  const avatarColor = useMemo(() => getInitialColor(message.userId), [message.userId]);
  const timeStr = useMemo(() => formatTimestamp(message.createdAt), [message.createdAt]);
  const isOwn = message.userId === currentUserId;

  if (message.deleted) {
    return (
      <div className="flex items-start gap-3 px-4 py-2">
        <div className="h-8 w-8 flex-shrink-0" />
        <p className="text-sm italic text-gray-400">Dit bericht is verwijderd</p>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-2 hover:bg-gray-50 transition-colors ${
        isOwn ? '' : ''
      }`}
    >
      {/* Avatar */}
      {message.userAvatar ? (
        <img
          src={message.userAvatar}
          alt={message.userName}
          className="h-8 w-8 rounded-full flex-shrink-0 object-cover"
        />
      ) : (
        <div
          className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold ${avatarColor}`}
        >
          {message.userName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {message.userName}
          </span>
          <span className="text-xs text-gray-400">{timeStr}</span>
        </div>

        {/* Reply reference */}
        {message.replyTo && (
          <div className="mt-1 mb-1 px-3 py-1.5 bg-gray-100 border-l-2 border-gray-300 rounded text-xs text-gray-500">
            <span className="font-medium text-gray-600">
              ↩ {message.replyTo.userName}:
            </span>{' '}
            {message.replyTo.text.length > 80
              ? message.replyTo.text.slice(0, 80) + '...'
              : message.replyTo.text}
          </div>
        )}

        {/* Text */}
        <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">
          {message.text}
        </p>

        {/* Reactions */}
        <EmojiReactions
          reactions={message.reactions || {}}
          roomId={roomId}
          messageId={message.id}
          currentUserId={currentUserId}
        />
      </div>

      {/* Reply button */}
      <button
        onClick={() =>
          onReply({
            messageId: message.id,
            userName: message.userName,
            text: message.text,
          })
        }
        className="opacity-0 group-hover:opacity-100 mt-1 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all flex-shrink-0"
        title="Beantwoorden"
      >
        <IconArrowBackUp className="h-4 w-4" />
      </button>
    </div>
  );
}
