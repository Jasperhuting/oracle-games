'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'tabler-icons-react';

interface ChatRoomResponse {
  id: string;
  title: string;
  description: string | null;
  gameType: string | null;
  closesAt: string;
  createdAt: string;
  createdBy: string;
  status: 'open' | 'closed';
  messageCount: number;
}

const GAME_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  football: { bg: 'bg-green-100', text: 'text-green-700', label: 'Football' },
  f1: { bg: 'bg-red-100', text: 'text-red-700', label: 'F1' },
  cycling: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Cycling' },
};

function getGameTypeBadge(gameType: string | null) {
  if (!gameType) {
    return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Algemeen' };
  }
  const colors = GAME_TYPE_COLORS[gameType] || { bg: 'bg-gray-100', text: 'text-gray-600', label: gameType };
  return colors;
}

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDefaultClosesAt() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T23:59`;
}

export default function AdminChatManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  const [rooms, setRooms] = useState<ChatRoomResponse[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGameType, setFormGameType] = useState('');
  const [formClosesAt, setFormClosesAt] = useState(getDefaultClosesAt());
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!loading && !user) {
        router.push('/login');
        return;
      }

      if (user) {
        try {
          const response = await fetch(`/api/getUser?userId=${user.uid}`);
          if (response.ok) {
            const userData = await response.json();
            if (userData.userType === 'admin') {
              setIsAdmin(true);
            } else {
              router.push('/home');
            }
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          router.push('/home');
        } finally {
          setChecking(false);
        }
      }
    };

    checkAdminStatus();
  }, [user, loading, router]);

  const fetchRooms = async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const res = await fetch('/api/chat/rooms');
      if (!res.ok) {
        setRoomsError('Kon chatrooms niet laden.');
        return;
      }
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {
      setRoomsError('Kon chatrooms niet laden.');
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchRooms();
    }
  }, [isAdmin]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formTitle.trim()) return;

    setFormSubmitting(true);
    try {
      const res = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          gameType: formGameType || null,
          closesAt: new Date(formClosesAt).toISOString(),
          createdBy: user.uid,
        }),
      });

      if (res.ok) {
        await fetchRooms();
        setFormTitle('');
        setFormDescription('');
        setFormGameType('');
        setFormClosesAt(getDefaultClosesAt());
        setShowForm(false);
      } else {
        alert('Fout bij aanmaken van chatroom.');
      }
    } catch {
      alert('Fout bij aanmaken van chatroom.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (room: ChatRoomResponse) => {
    const newStatus = room.status === 'open' ? 'closed' : 'open';
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchRooms();
      } else {
        alert('Fout bij wijzigen van status.');
      }
    } catch {
      alert('Fout bij wijzigen van status.');
    }
  };

  const handleDeleteRoom = async (room: ChatRoomResponse) => {
    if (!window.confirm(`Weet je zeker dat je "${room.title}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/chat/rooms/${room.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchRooms();
      } else {
        alert('Fout bij verwijderen van chatroom.');
      }
    } catch {
      alert('Fout bij verwijderen van chatroom.');
    }
  };

  if (loading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
      <div className="container mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <div className="flex flex-row border border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
          <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Back to Home
          </Link>
          <ArrowRight className="mx-2" size={16} />
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Admin
          </Link>
          <ArrowRight className="mx-2" size={16} />
          <span className="text-sm text-gray-900">Chat Management</span>
        </div>

        {/* Create New Chat Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Nieuwe chatroom aanmaken</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 rounded-lg font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700"
            >
              {showForm ? 'Verbergen' : 'Nieuw'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Titel van de chatroom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optionele beschrijving"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Game Type</label>
                <select
                  value={formGameType}
                  onChange={(e) => setFormGameType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Algemeen</option>
                  <option value="football">Football</option>
                  <option value="f1">F1</option>
                  <option value="cycling">Cycling</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sluitdatum + tijd</label>
                <input
                  type="datetime-local"
                  value={formClosesAt}
                  onChange={(e) => setFormClosesAt(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formSubmitting ? 'Aanmaken...' : 'Chatroom aanmaken'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Rooms Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Chatrooms</h2>

          {roomsLoading && (
            <div className="text-sm text-gray-500">Chatrooms laden...</div>
          )}

          {roomsError && (
            <div className="text-sm text-red-600">{roomsError}</div>
          )}

          {!roomsLoading && !roomsError && rooms.length === 0 && (
            <div className="text-sm text-gray-500">Geen chatrooms gevonden.</div>
          )}

          {!roomsLoading && !roomsError && rooms.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4 font-semibold text-gray-700">Titel</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Berichten</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Sluit op</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room, index) => {
                    const badge = getGameTypeBadge(room.gameType);
                    return (
                      <tr
                        key={room.id}
                        className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="py-3 px-4 font-medium text-gray-900">{room.title}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {room.status === 'open' ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              Open
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                              Gesloten
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{room.messageCount}</td>
                        <td className="py-3 px-4 text-gray-600">{formatDateTime(room.closesAt)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleStatus(room)}
                              className={`px-3 py-1 text-xs rounded-lg font-semibold transition-colors ${
                                room.status === 'open'
                                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              {room.status === 'open' ? 'Sluiten' : 'Heropenen'}
                            </button>
                            <button
                              onClick={() => handleDeleteRoom(room)}
                              className="px-3 py-1 text-xs rounded-lg font-semibold transition-colors bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              Verwijderen
                            </button>
                            <a
                              href={`/chat/${room.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-xs rounded-lg font-semibold transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              Bekijken
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
