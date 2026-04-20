'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { IconChevronLeft, IconChevronRight, IconExternalLink, IconMessage } from '@tabler/icons-react';
import { useChatRooms, markRoomAsSeen } from '@/hooks/useChatRooms';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useAuth } from '@/hooks/useAuth';
import ChatInput from './ChatInput';
import type { ChatRoom, ChatMessage } from '@/lib/types/chat';
import { Timestamp } from 'firebase/firestore';

function formatTime(createdAt: Timestamp | string): string {
  const date = createdAt instanceof Timestamp ? createdAt.toDate() : new Date(createdAt as string);
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function CompactMessage({ msg }: { msg: ChatMessage }) {
  if (msg.deleted) return null;
  return (
    <div className="px-3 py-1.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-xs font-semibold text-gray-900 shrink-0">{msg.userName}</span>
        <span className="text-xs text-gray-400 shrink-0">{formatTime(msg.createdAt)}</span>
      </div>
      {msg.text && (
        <p className="text-xs text-gray-700 break-words whitespace-pre-wrap leading-relaxed mt-0.5">
          {msg.text}
        </p>
      )}
      {!msg.text && msg.giphy && (
        <p className="text-xs text-gray-400 italic mt-0.5">[GIF]</p>
      )}
      {msg.replyTo && (
        <div className="mt-1 pl-2 border-l-2 border-gray-200 text-xs text-gray-400 truncate">
          ↩ {msg.replyTo.userName}: {msg.replyTo.text.slice(0, 40)}{msg.replyTo.text.length > 40 ? '…' : ''}
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  room,
  user,
  onCollapse,
}: {
  room: ChatRoom;
  user: { uid: string; displayName: string | null; photoURL?: string | null };
  onCollapse: () => void;
}) {
  const router = useRouter();
  const { messages, loading } = useChatMessages(room.id);
  const [replyingTo, setReplyingTo] = useState<{ messageId: string; userName: string; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRoomClosed = room.status === 'closed';

  useEffect(() => {
    markRoomAsSeen(room.id, room.messageCount);
  }, [room.id, room.messageCount]);

  const visibleMessages = messages.filter((m) => !m.deleted);
  const shownMessages = visibleMessages.slice(-5);
  const hiddenCount = visibleMessages.length - shownMessages.length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="flex-1 text-xs font-semibold text-gray-900 truncate min-w-0">{room.title}</span>
        <button
          onClick={() => router.push(`/chat/${room.id}`)}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          title="Open volledige chat"
        >
          <IconExternalLink size={13} />
        </button>
        <button
          onClick={onCollapse}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          aria-label="Chat verbergen"
          title="Chat verbergen"
        >
          <IconChevronLeft size={13} />
        </button>
      </div>

      {/* Input at top (as requested) */}
      <div className="flex-shrink-0">
        {isRoomClosed ? (
          <div className="px-3 py-2 text-xs text-gray-400 text-center bg-gray-50 border-b border-gray-200">
            Chat is gesloten
          </div>
        ) : (
          <ChatInput
            roomId={room.id}
            user={user}
            replyingTo={replyingTo}
            onClearReply={() => setReplyingTo(null)}
            disabled={false}
            compact
          />
        )}
      </div>

      {/* Messages — last 5 visible, scrollable */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-4">Laden...</p>
        )}
        {!loading && visibleMessages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6 px-3">
            Nog geen berichten. Wees de eerste!
          </p>
        )}
        {!loading && hiddenCount > 0 && (
          <button
            onClick={() => router.push(`/chat/${room.id}`)}
            className="w-full px-3 py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-b border-gray-100 transition-colors text-center"
          >
            ↑ {hiddenCount} eerdere berichten bekijken
          </button>
        )}
        {!loading && shownMessages.map((msg) => (
          <CompactMessage key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </>
  );
}

function RoomListPanel({
  rooms,
  unreadByRoom,
  onSelectRoom,
  onCollapse,
}: {
  rooms: ChatRoom[];
  unreadByRoom: Map<string, number>;
  onSelectRoom: (room: ChatRoom) => void;
  onCollapse: () => void;
}) {
  const router = useRouter();
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <span className="flex-1 text-xs font-semibold text-gray-900">Live chats</span>
        <button
          onClick={onCollapse}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Chat verbergen"
        >
          <IconChevronLeft size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rooms.map((room) => {
          const unread = unreadByRoom.get(room.id) ?? 0;
          return (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="flex-1 text-xs font-medium text-gray-900 truncate min-w-0">{room.title}</span>
              {unread > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white shrink-0">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
              <IconChevronRight size={12} className="text-gray-400 shrink-0" />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => router.push('/chat')}
        className="px-3 py-2 text-xs text-blue-600 text-center border-t border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0 w-full"
      >
        Bekijk alle chatrooms →
      </button>
    </>
  );
}

export default function SidebarChatWidget() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { rooms, unreadByRoom, totalUnread, loading } = useChatRooms();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [headerBottom, setHeaderBottom] = useState(120);

  const isOnChatPage = pathname.startsWith('/chat');
  const hasRooms = rooms.length > 0;

  // Track the bottom edge of the sticky header so the panel starts exactly below it
  useEffect(() => {
    const update = () => {
      const header = document.querySelector('header');
      if (header) setHeaderBottom(header.getBoundingClientRect().bottom);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Close and reset when rooms disappear
  useEffect(() => {
    if (!hasRooms) {
      setIsOpen(false);
      setSelectedRoomId(null);
    }
  }, [hasRooms]);

  // Auto-select when there's exactly one room
  useEffect(() => {
    if (rooms.length === 1) {
      setSelectedRoomId(rooms[0].id);
    } else if (rooms.length === 0) {
      setSelectedRoomId(null);
    }
  }, [rooms]);

  if (loading || !hasRooms || !user || isOnChatPage) return null;

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const overlayUser = {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };

  // Collapsed: small tab on left edge
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 bg-blue-600 text-white px-1.5 py-3 rounded-r-lg shadow-lg hover:bg-blue-700 transition-colors hidden sm:flex"
        aria-label="Open chat"
        title="Open live chat"
      >
        <IconMessage size={15} />
        {totalUnread > 0 && (
          <span className="text-[10px] font-bold leading-none">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    );
  }

  // Expanded: full sidebar panel
  return (
    <div className="fixed left-0 bottom-0 z-[39] w-[272px] bg-white border-r border-t border-gray-200 shadow-xl rounded-tr-lg overflow-hidden hidden sm:flex sm:flex-col" style={{ top: headerBottom }}>
      {selectedRoom ? (
        <ChatPanel
          room={selectedRoom}
          user={overlayUser}
          onCollapse={() => setIsOpen(false)}
        />
      ) : (
        <RoomListPanel
          rooms={rooms}
          unreadByRoom={unreadByRoom}
          onSelectRoom={(room) => {
            setSelectedRoomId(room.id);
            markRoomAsSeen(room.id, room.messageCount);
          }}
          onCollapse={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
