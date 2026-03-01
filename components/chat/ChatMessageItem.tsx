'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { IconArrowBackUp, IconTrash, IconVolumeOff, IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import { Timestamp } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types/chat';
import { AvatarBadge } from '@/components/forum/AvatarBadge';
import EmojiReactions from './EmojiReactions';
import MuteUserDialog from './MuteUserDialog';

interface ChatMessageItemProps {
  message: ChatMessage;
  roomId: string;
  currentUserId: string;
  onReply: (msg: { messageId: string; userName: string; text: string }) => void;
  isAdmin?: boolean;
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
  isAdmin = false,
}: ChatMessageItemProps) {
  const timeStr = useMemo(() => formatTimestamp(message.createdAt), [message.createdAt]);
  const isOwn = message.userId === currentUserId;
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);

  const handleDelete = async () => {
    if (!confirm('Weet je zeker dat je dit bericht wilt verwijderen?')) return;
    try {
      await fetch(`/api/chat/rooms/${roomId}/messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted: true }),
      });
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.text) {
      setIsEditing(false);
      setEditText(message.text);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editText: trimmed, userId: currentUserId }),
      });
      if (res.ok) {
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(message.text);
    }
  };

  if (message.deleted) {
    return null;
  }

  const hasEditHistory = message.editHistory && message.editHistory.length > 0;
  const hasText = Boolean(message.text?.trim());
  const hasGif = Boolean(message.giphy?.url);

  return (
    <div
      className="group flex items-start gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
    >
      {/* Avatar */}
      <div className="shrink-0">
        <AvatarBadge
          name={message.userName}
          avatarUrl={message.userAvatar}
          size={32}
        />
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {message.userName}
          </span>
          <span className="text-xs text-gray-400">{timeStr}</span>
          {message.editedAt && (
            <button
              onClick={() => hasEditHistory && setShowHistory(!showHistory)}
              className={`text-xs text-gray-400 italic ${hasEditHistory ? 'hover:text-gray-600 cursor-pointer' : 'cursor-default'}`}
              title={hasEditHistory ? 'Bewerkingsgeschiedenis bekijken' : undefined}
            >
              (bewerkt)
            </button>
          )}
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

        {/* Text or edit input */}
        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={saving}
              maxLength={1000}
            />
            <button
              onClick={handleEdit}
              disabled={saving}
              className="p-1 rounded hover:bg-green-100 text-green-600 hover:text-green-700 transition-all"
              title="Opslaan"
            >
              <IconCheck className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setIsEditing(false); setEditText(message.text); }}
              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all"
              title="Annuleren"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {hasText && (
              <p className="text-sm text-gray-800 wrap-break-word whitespace-pre-wrap">
                {message.text}
              </p>
            )}
            {hasGif && (
              <img
                src={message.giphy!.previewUrl || message.giphy!.url}
                alt={message.giphy!.title || 'GIF'}
                className="mt-2 max-h-64 max-w-xs rounded-lg border border-gray-200 object-cover"
              />
            )}
          </>
        )}

        {/* Edit history */}
        {showHistory && hasEditHistory && (
          <div className="mt-2 space-y-1 border-l-2 border-gray-200 pl-3">
            <p className="text-xs font-medium text-gray-500">Bewerkingsgeschiedenis:</p>
            {message.editHistory!.map((edit, i) => {
              const editDate = edit.editedAt instanceof Timestamp
                ? edit.editedAt.toDate()
                : new Date(edit.editedAt);
              return (
                <div key={i} className="text-xs text-gray-400">
                  <span className="text-gray-500">
                    {editDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {' — '}
                  <span className="line-through">{edit.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Reactions */}
        <EmojiReactions
          reactions={message.reactions || {}}
          roomId={roomId}
          messageId={message.id}
          currentUserId={currentUserId}
        />
      </div>

      {/* Action buttons */}
      <div className="opacity-0 group-hover:opacity-100 mt-1 flex items-center gap-0.5 shrink-0">
        <button
          onClick={() =>
            onReply({
              messageId: message.id,
              userName: message.userName,
              text: message.text?.trim() || (message.giphy ? '[GIF]' : ''),
            })
          }
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all"
          title="Beantwoorden"
        >
          <IconArrowBackUp className="h-4 w-4" />
        </button>

        {isOwn && !isEditing && (
          <button
            onClick={() => { setEditText(message.text); setIsEditing(true); }}
            className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all"
            title="Bewerken"
          >
            <IconPencil className="h-4 w-4" />
          </button>
        )}

        {isAdmin && (
          <>
            <button
              onClick={handleDelete}
              className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-all"
              title="Verwijderen"
            >
              <IconTrash className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowMuteDialog(true)}
              className="p-1 rounded hover:bg-orange-100 text-gray-400 hover:text-orange-600 transition-all"
              title="Gebruiker dempen"
            >
              <IconVolumeOff className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {showMuteDialog && (
        <MuteUserDialog
          userId={message.userId}
          userName={message.userName}
          roomId={roomId}
          mutedBy={currentUserId}
          onClose={() => setShowMuteDialog(false)}
        />
      )}
    </div>
  );
}
