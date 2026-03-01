'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconSend, IconX, IconMoodSmile } from '@tabler/icons-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import GiphyPicker, { SelectedGif } from '@/components/giphy/GiphyPicker';

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [selectedGif, setSelectedGif] = useState<SelectedGif | null>(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [giphyPickerPos, setGiphyPickerPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const giphyButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const giphyPickerRef = useRef<HTMLDivElement>(null);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  // Position emoji picker above button
  useEffect(() => {
    if (!showEmojiPicker || !emojiButtonRef.current) return;

    const rect = emojiButtonRef.current.getBoundingClientRect();
    const pickerWidth = 320;
    const pickerHeight = 400;

    let left = rect.right - pickerWidth;
    let top = rect.top - pickerHeight - 8;

    if (left < 8) left = 8;
    if (top < 8) top = rect.bottom + 8;

    setPickerPos({ top, left });
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!showGiphyPicker || !giphyButtonRef.current) return;

    const rect = giphyButtonRef.current.getBoundingClientRect();
    const pickerWidth = 340;
    const pickerHeight = 420;

    let left = rect.right - pickerWidth;
    let top = rect.top - pickerHeight - 8;

    if (left < 8) left = 8;
    if (top < 8) top = rect.bottom + 8;

    setGiphyPickerPos({ top, left });
  }, [showGiphyPicker]);

  // Close picker on outside click
  useEffect(() => {
    if (!showEmojiPicker && !showGiphyPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        pickerRef.current && !pickerRef.current.contains(target) &&
        emojiButtonRef.current && !emojiButtonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        giphyPickerRef.current && !giphyPickerRef.current.contains(target) &&
        giphyButtonRef.current && !giphyButtonRef.current.contains(target)
      ) {
        setShowGiphyPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker, showGiphyPicker]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !selectedGif) || sending || disabled) return;

    setSending(true);
    try {
      const body: Record<string, unknown> = {
        text: trimmed,
        userId: user.uid,
        userName: user.displayName || 'Anoniem',
        userAvatar: user.photoURL || null,
      };
      if (selectedGif) {
        body.giphy = selectedGif;
      }

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
        setSelectedGif(null);
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
            className="p-1 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors shrink-0"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {selectedGif && (
        <div className="px-4 pt-3">
          <div className="w-44 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            <img
              src={selectedGif.previewUrl || selectedGif.url}
              alt={selectedGif.title || 'GIF'}
              className="h-20 w-full rounded object-cover"
            />
            <button
              type="button"
              onClick={() => setSelectedGif(null)}
              className="mt-1 text-xs text-red-600 hover:underline"
            >
              Verwijder GIF
            </button>
          </div>
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
          ref={emojiButtonRef}
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          title="Emoji toevoegen"
        >
          <IconMoodSmile className="h-5 w-5" />
        </button>
        <button
          ref={giphyButtonRef}
          type="button"
          onClick={() => setShowGiphyPicker(!showGiphyPicker)}
          className="px-2 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          title="GIF toevoegen"
        >
          GIF
        </button>
        <button
          type="submit"
          disabled={(!text.trim() && !selectedGif) || sending}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors shrink-0"
          title="Verstuur"
        >
          <IconSend className="h-5 w-5" />
        </button>
      </form>

      {/* Emoji picker portal */}
      {showEmojiPicker &&
        createPortal(
          <div
            ref={pickerRef}
            className="fixed z-9999 shadow-xl rounded-xl overflow-hidden"
            style={{ top: pickerPos.top, left: pickerPos.left }}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.LIGHT}
              width={320}
              height={400}
              searchPlaceHolder="Zoek emoji..."
              previewConfig={{ showPreview: false }}
            />
          </div>,
          document.body
        )}

      {showGiphyPicker &&
        createPortal(
          <div
            ref={giphyPickerRef}
            className="fixed z-9999"
            style={{ top: giphyPickerPos.top, left: giphyPickerPos.left }}
          >
            <GiphyPicker
              onSelect={(gif) => {
                setSelectedGif(gif);
                setShowGiphyPicker(false);
                inputRef.current?.focus();
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
