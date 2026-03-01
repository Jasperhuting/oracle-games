'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Countdown from 'react-countdown';
import { IconArrowLeft, IconLock, IconMessageCircle } from '@tabler/icons-react';
import { Timestamp } from 'firebase/firestore';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useAuth } from '@/hooks/useAuth';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput from '@/components/chat/ChatInput';

interface ReplyTo {
  messageId: string;
  userName: string;
  text: string;
}

function CountdownRenderer({
  days,
  hours,
  minutes,
  seconds,
  completed,
}: {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  completed: boolean;
}) {
  if (completed) {
    return <span className="text-xs text-gray-500">Gesloten</span>;
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}u`);
  parts.push(`${minutes}m`);
  if (days === 0) parts.push(`${seconds}s`);

  return (
    <span className="text-xs font-medium text-orange-600">
      {parts.join(' ')}
    </span>
  );
}

function getClosesAtDate(closesAt: Timestamp | string): Date {
  if (closesAt instanceof Timestamp) {
    return closesAt.toDate();
  }
  return new Date(closesAt);
}

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { room, loading: roomLoading, error: roomError } = useChatRoom(roomId);
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      fetch(`/api/getUser?userId=${user.uid}`)
        .then(res => res.json())
        .then(data => setIsAdmin(data.userType === 'admin'))
        .catch(() => setIsAdmin(false));
    }
  }, [user]);

  const loading = roomLoading || authLoading;

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
        <div className="mx-auto container max-w-4xl">
          <div className="text-sm text-gray-500">Laden...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
        <div className="mx-auto container max-w-4xl">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <IconLock className="mx-auto h-10 w-10 text-gray-400 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Inloggen vereist
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Je moet ingelogd zijn om de chat te bekijken.
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Inloggen
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
        <div className="mx-auto container max-w-4xl">
          <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
            <Link
              href="/chat"
              className="text-sm text-gray-600 hover:text-gray-900 underline flex items-center gap-1"
            >
              <IconArrowLeft className="h-4 w-4" />
              Terug naar chatrooms
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-red-600">
              {roomError
                ? 'Kon de chatroom niet laden.'
                : 'Chatroom niet gevonden.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const closesAtDate = getClosesAtDate(room.closesAt);
  const isExpired = closesAtDate.getTime() <= Date.now();
  const isClosed = room.status === 'closed' || isExpired;

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
      <div className="mx-auto container max-w-4xl flex flex-col flex-1">
        {/* Back link */}
        <div className="flex flex-row border border-gray-200 mb-4 items-center bg-white px-6 py-3 rounded-lg">
          <Link
            href="/chat"
            className="text-sm text-gray-600 hover:text-gray-900 underline flex items-center gap-1"
          >
            <IconArrowLeft className="h-4 w-4" />
            Terug naar chatrooms
          </Link>
        </div>

        {/* Chat container */}
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col flex-1 overflow-hidden" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {/* Header */}
          <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                  <IconMessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-gray-900 truncate">
                    {room.title}
                  </h1>
                  {room.description && (
                    <p className="text-xs text-gray-500 truncate">
                      {room.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {isClosed ? (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                    Gesloten
                  </span>
                ) : (
                  <>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      Open
                    </span>
                    <Countdown
                      date={closesAtDate}
                      renderer={CountdownRenderer}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Message list */}
          <ChatMessageList
            roomId={roomId}
            replyingTo={replyingTo}
            onReply={setReplyingTo}
            currentUserId={user!.uid}
            isAdmin={isAdmin}
          />

          {/* Input */}
          <ChatInput
            roomId={roomId}
            user={{
              uid: user!.uid,
              displayName: user!.displayName,
              photoURL: user!.photoURL,
            }}
            replyingTo={replyingTo}
            onClearReply={() => setReplyingTo(null)}
            disabled={isClosed}
            disabledReason={
              isClosed ? 'Deze chat is gesloten. Je kunt geen berichten meer sturen.' : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
