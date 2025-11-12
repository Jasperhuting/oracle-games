'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "./Button";
import Link from "next/link";

interface User {
  uid: string;
  email: string;
  playername: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  userType: string;
  authMethod?: string;
  lastLoginMethod?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
  blocked?: boolean;
  blockedAt?: string;
  blockedBy?: string;
}

export const UserList = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/getUser?userId=${user.uid}`);
        if (response.ok) {
          const userData = await response.json();
          setIsAdmin(userData.userType === 'admin');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdmin();
  }, [user]);

  // Set up Firestore realtime listener
  useEffect(() => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

    // Create query for users collection
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc')
    );

    // Set up realtime listener with onSnapshot
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const usersList: User[] = [];
        snapshot.forEach((doc) => {
          usersList.push({
            uid: doc.id,
            ...doc.data()
          } as User);
        });
        setUsers(usersList);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error fetching users:', error);
        setError('Kon gebruikers niet laden. Mogelijk ontbreken de juiste rechten.');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [user, isAdmin]);

  const blockUser = async (userId: string) => {
    if (!user || !confirm('Weet je zeker dat je deze gebruiker wilt blokkeren?')) return;

    setBlockingUserId(userId);
    try {
      const response = await fetch('/api/blockUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          targetUserId: userId,
          block: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon gebruiker niet blokkeren');
      }

      // Success - the realtime listener will update the UI automatically
    } catch (error: any) {
      console.error('Error blocking user:', error);
      alert(error.message || 'Er is iets misgegaan bij het blokkeren');
    } finally {
      setBlockingUserId(null);
    }
  };

  const unblockUser = async (userId: string) => {
    if (!user || !confirm('Weet je zeker dat je deze gebruiker wilt deblokkeren?')) return;

    setBlockingUserId(userId);
    try {
      const response = await fetch('/api/blockUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          targetUserId: userId,
          block: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon gebruiker niet deblokkeren');
      }

      // Success - the realtime listener will update the UI automatically
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      alert(error.message || 'Er is iets misgegaan bij het deblokkeren');
    } finally {
      setBlockingUserId(null);
    }
  };

  // Filter users based on search term and type
  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.playername.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === "all" || user.userType === filterType;

    return matchesSearch && matchesType;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Gebruikers laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <span className="text-red-700 text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Gebruikers</h2>
            <p className="text-sm text-gray-600">
              {filteredUsers.length} van {users.length} gebruikers
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle types</option>
              <option value="user">Gebruiker</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <input
          type="text"
          placeholder="Zoek op naam, e-mail of spelersnaam..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* User list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gebruiker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  E-mail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auth Methode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Laatste Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aangemaakt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    Geen gebruikers gevonden
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.uid} className={`hover:bg-gray-50 transition-colors ${user.blocked ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex flex-col items-start gap-2">
                          <div className="text-sm font-medium text-gray-900">
                            <Link href={`/user/${user.uid}`}>{user.playername}</Link>
                          </div>
                          {user.blocked && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Geblokkeerd
                            </span>
                          )}
                        </div>
                        {(user.firstName || user.lastName) && (
                          <div className="text-xs text-gray-500">
                            {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.userType === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.userType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {user.lastLoginMethod || user.authMethod || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {formatDate(user.lastLoginAt || '')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.blocked ? (
                        <Button 
                          className="py-1 px-3 text-sm bg-green-600 hover:bg-green-700" 
                          text={blockingUserId === user.uid ? "Bezig..." : "Deblokkeer"} 
                          onClick={() => unblockUser(user.uid)}
                          disabled={blockingUserId === user.uid}
                        />
                      ) : (
                        <Button 
                          className="py-1 px-3 text-sm " 
                          text={blockingUserId === user.uid ? "Bezig..." : "Blokkeer"} 
                          onClick={() => blockUser(user.uid)}
                          disabled={blockingUserId === user.uid}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Totaal Gebruikers</div>
          <div className="text-2xl font-bold text-gray-900">{users.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Admins</div>
          <div className="text-2xl font-bold text-purple-600">
            {users.filter(u => u.userType === 'admin').length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Reguliere Gebruikers</div>
          <div className="text-2xl font-bold text-blue-600">
            {users.filter(u => u.userType === 'user').length}
          </div>
        </div>
      </div>
    </div>
  );
}
