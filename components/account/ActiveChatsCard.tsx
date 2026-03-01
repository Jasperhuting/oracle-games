'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import Countdown from 'react-countdown';
import { IconMessageCircle } from '@tabler/icons-react';
import { Timestamp } from 'firebase/firestore';

interface ChatRoomPreview {
  id: string;
  title: string;
  description?: string;
  closesAt: Timestamp | string;
  messageCount: number;
}

function CountdownCompact({ date }: { date: Date }) {
  return (
    <Countdown
      date={date}
      renderer={({ days, hours, minutes, completed }) => {
        if (completed) return <span className="text-xs text-gray-400">Gesloten</span>;
        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0 || days > 0) parts.push(`${hours}u`);
        parts.push(`${minutes}m`);
        return (
          <span className="text-xs text-orange-600 font-medium">
            {parts.join(' ')}
          </span>
        );
      }}
    />
  );
}

export function ActiveChatsCard() {
  const [rooms, setRooms] = useState<ChatRoomPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const roomsRef = collection(db, 'chat_rooms');
    const q = query(
      roomsRef,
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ChatRoomPreview[];
        setRooms(data);
        setLoading(false);
      },
      () => {
        setRooms([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const getClosesAtDate = (closesAt: Timestamp | string): Date => {
    if (closesAt instanceof Timestamp) return closesAt.toDate();
    return new Date(closesAt);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-900">Actieve Chats</h2>
        <Link
          href="/chat"
          className="text-sm text-primary hover:underline"
        >
          Bekijk alles
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Laden...</p>
      ) : rooms.length > 0 ? (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/chat/${room.id}`}
                className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <IconMessageCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {room.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{room.messageCount || 0} berichten</span>
                    <span>·</span>
                    <CountdownCompact date={getClosesAtDate(room.closesAt)} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400">Geen actieve chatrooms</p>
      )}
    </div>
  );
}
