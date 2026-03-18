'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { IconMessage, IconX, IconArrowRight, IconArrowsDiagonal, IconArrowsDiagonalMinimize, IconExternalLink, IconChevronLeft } from '@tabler/icons-react';
import { useChatRooms, markRoomAsSeen } from '@/hooks/useChatRooms';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useAuth } from '@/hooks/useAuth';
import ChatMessageItem from './ChatMessageItem';
import ChatInput from './ChatInput';
import type { ChatRoom } from '@/lib/types/chat';

type OverlayMode = 'popup' | 'drawer';

interface OverlayUser {
  uid: string;
  displayName: string | null;
  photoURL?: string | null;
}

interface OverlayProps {
  rooms: ChatRoom[];
  unreadByRoom: Map<string, number>;
  selectedRoom: ChatRoom | null;
  user: OverlayUser;
  mode: OverlayMode;
  onClose: () => void;
  onExpand?: () => void;
  onCollapse?: () => void;
  onGoToFullPage: () => void;
  onSelectRoom: (room: ChatRoom) => void;
  onBackToList: () => void;
  fabRef?: React.RefObject<HTMLButtonElement | null>;
}

function OverlayHeader({
  selectedRoom, rooms, mode, onClose, onExpand, onCollapse, onGoToFullPage, onBackToList,
}: Pick<OverlayProps, 'selectedRoom' | 'rooms' | 'mode' | 'onClose' | 'onExpand' | 'onCollapse' | 'onGoToFullPage' | 'onBackToList'>) {
  const isMultiRoom = rooms.length > 1;
  const showBack = isMultiRoom && selectedRoom !== null;

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 bg-white flex-shrink-0">
      {showBack && (
        <button onClick={onBackToList} className="mr-1 text-gray-400 hover:text-gray-700 transition-colors" aria-label="Terug naar overzicht">
          <IconChevronLeft size={16} />
        </button>
      )}
      <span className="flex-1 text-sm font-semibold text-gray-900 truncate">
        {selectedRoom ? selectedRoom.title : 'Chats'}
      </span>
      <div className="flex items-center gap-1">
        {mode === 'popup' && onExpand && (
          <button onClick={onExpand} className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" aria-label="Uitbreiden" title="Uitbreiden naar zijpaneel">
            <IconArrowsDiagonal size={15} />
          </button>
        )}
        {mode === 'drawer' && onCollapse && (
          <button onClick={onCollapse} className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" aria-label="Minimaliseren" title="Terug naar popup">
            <IconArrowsDiagonalMinimize size={15} />
          </button>
        )}
        <button onClick={onGoToFullPage} className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" aria-label="Volledige pagina" title="Open volledige chatpagina">
          <IconExternalLink size={15} />
        </button>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" aria-label="Sluiten">
          <IconX size={15} />
        </button>
      </div>
    </div>
  );
}

function RoomListView({
  rooms, unreadByRoom, onSelectRoom, onGoToFullPage,
}: Pick<OverlayProps, 'rooms' | 'unreadByRoom' | 'onSelectRoom' | 'onGoToFullPage'>) {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {rooms.map((room) => {
        const unread = unreadByRoom.get(room.id) ?? 0;
        return (
          <button key={room.id} onClick={() => onSelectRoom(room)} className="flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {room.gameType === 'cycling' && '🚴 '}
                {room.gameType === 'football' && '⚽ '}
                {room.gameType === 'f1' && '🏎️ '}
                {room.title}
              </p>
            </div>
            {unread > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        );
      })}
      <button onClick={onGoToFullPage} className="flex items-center justify-center gap-2 px-3 py-3 text-sm text-blue-600 hover:text-blue-700 hover:bg-gray-50 transition-colors">
        Ga naar overzicht
        <IconArrowRight size={14} />
      </button>
    </div>
  );
}

function RoomChatView({ room, user, compact }: { room: ChatRoom; user: OverlayUser; compact: boolean }) {
  const { messages, loading } = useChatMessages(room.id);
  const [replyingTo, setReplyingTo] = useState<{ messageId: string; userName: string; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRoomClosed = room.status === 'closed';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep lastSeen in sync while the user has this room open in the FAB
  useEffect(() => {
    markRoomAsSeen(room.id, room.messageCount);
  }, [room.id, room.messageCount]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 bg-gray-50">
        {loading && <p className="text-xs text-gray-400 text-center py-4">Laden...</p>}
        {!loading && messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            currentUserId={user.uid}
            roomId={room.id}
            onReply={(m) => setReplyingTo({ messageId: m.messageId, userName: m.userName, text: m.text })}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      {isRoomClosed ? (
        <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-200 bg-white">
          Deze chat is gesloten.
        </div>
      ) : (
        <ChatInput roomId={room.id} user={user} replyingTo={replyingTo} onClearReply={() => setReplyingTo(null)} disabled={false} compact={compact} />
      )}
    </div>
  );
}

function OverlayContent(props: OverlayProps & { compact: boolean }) {
  const { rooms, unreadByRoom, selectedRoom, user, compact, onSelectRoom, onGoToFullPage } = props;
  const showRoomList = rooms.length > 1 && selectedRoom === null;

  if (showRoomList) {
    return <RoomListView rooms={rooms} unreadByRoom={unreadByRoom} onSelectRoom={onSelectRoom} onGoToFullPage={onGoToFullPage} />;
  }
  if (selectedRoom) {
    return <RoomChatView room={selectedRoom} user={user} compact={compact} />;
  }
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
      Geen chat beschikbaar.
    </div>
  );
}

function ChatPopup(props: OverlayProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInsidePopup = popupRef.current?.contains(target);
      const clickedFab = props.fabRef?.current?.contains(target);
      if (!clickedInsidePopup && !clickedFab) {
        props.onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [props.onClose, props.fabRef]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [props.onClose]);

  return (
    <div ref={popupRef} className="fixed bottom-20 right-5 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-xl bg-white shadow-2xl overflow-hidden border border-gray-200" style={{ height: '520px' }}>
      <OverlayHeader {...props} />
      <OverlayContent {...props} compact={true} />
    </div>
  );
}

function ChatDrawer(props: OverlayProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [props.onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={props.onCollapse} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-[420px] max-w-full flex-col bg-white shadow-2xl border-l border-gray-200">
        <OverlayHeader {...props} />
        <OverlayContent {...props} compact={false} />
      </div>
    </>
  );
}

export default function ChatFloatingButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { rooms, unreadByRoom, totalUnread, loading } = useChatRooms();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<OverlayMode>('popup');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const isOnChatPage = pathname.startsWith('/chat');
  const hasRooms = rooms.length > 0;

  useEffect(() => {
    if (isOpen && rooms.length === 1 && selectedRoomId === null) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [isOpen, rooms, selectedRoomId]);

  const openOverlay = () => {
    setIsOpen(true);
    if (rooms.length === 1) {
      handleSelectRoom(rooms[0]);
    }
  };

  const closeOverlay = () => {
    setIsOpen(false);
    setMode('popup');
    setSelectedRoomId(null);
  };

  const handleSelectRoom = (room: ChatRoom) => {
    setSelectedRoomId(room.id);
    markRoomAsSeen(room.id, room.messageCount);
  };

  const handleBackToList = () => setSelectedRoomId(null);

  const handleGoToFullPage = () => {
    if (selectedRoomId) {
      router.push(`/chat/${selectedRoomId}`);
    } else {
      router.push('/chat');
    }
    closeOverlay();
  };

  if (loading || !hasRooms || !user || isOnChatPage) return null;

  const overlayUser: OverlayUser = {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  return (
    <>
      <button
        ref={fabRef}
        onClick={() => (isOpen ? closeOverlay() : openOverlay())}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        aria-label="Open chat"
      >
        {isOpen ? <IconX size={20} /> : <IconMessage size={20} />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-white">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && mode === 'popup' && (
        <ChatPopup rooms={rooms} unreadByRoom={unreadByRoom} selectedRoom={selectedRoom} user={overlayUser} mode={mode} onClose={closeOverlay} onExpand={() => setMode('drawer')} onGoToFullPage={handleGoToFullPage} onSelectRoom={handleSelectRoom} onBackToList={handleBackToList} fabRef={fabRef} />
      )}
      {isOpen && mode === 'drawer' && (
        <ChatDrawer rooms={rooms} unreadByRoom={unreadByRoom} selectedRoom={selectedRoom} user={overlayUser} mode={mode} onClose={closeOverlay} onCollapse={() => setMode('popup')} onGoToFullPage={handleGoToFullPage} onSelectRoom={handleSelectRoom} onBackToList={handleBackToList} />
      )}
    </>
  );
}
