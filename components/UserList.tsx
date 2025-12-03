'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "./Button";
import Link from "next/link";
import { EmailUserModal } from "./EmailUserModal";

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
  deletedAt?: string;
  deletedBy?: string;
}

export const UserList = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showDeleted, setShowDeleted] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [changingUserTypeId, setChangingUserTypeId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ email: string; name: string } | null>(null);

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

  const deleteUser = async (userId: string) => {
    if (!user || !confirm('Weet je zeker dat je deze gebruiker wilt verwijderen? De gebruiker wordt gemarkeerd als verwijderd maar niet permanent gewist.')) return;

    setDeletingUserId(userId);
    try {
      const response = await fetch('/api/deleteUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          targetUserId: userId,
          deleteUser: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon gebruiker niet verwijderen');
      }

      // Success - the realtime listener will update the UI automatically
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(error.message || 'Er is iets misgegaan bij het verwijderen');
    } finally {
      setDeletingUserId(null);
    }
  };

  const restoreUser = async (userId: string) => {
    if (!user || !confirm('Weet je zeker dat je deze gebruiker wilt herstellen?')) return;

    setDeletingUserId(userId);
    try {
      const response = await fetch('/api/deleteUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          targetUserId: userId,
          deleteUser: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon gebruiker niet herstellen');
      }

      // Success - the realtime listener will update the UI automatically
    } catch (error: any) {
      console.error('Error restoring user:', error);
      alert(error.message || 'Er is iets misgegaan bij het herstellen');
    } finally {
      setDeletingUserId(null);
    }
  };

  const changeUserType = async (userId: string, currentUserType: string, newUserType: string) => {
    if (!user) return;

    // Prevent changing admin to user
    if (currentUserType === 'admin' && newUserType === 'user') {
      alert('It is not allowed to downgrade an admin to user');
      return;
    }

    if (!confirm(`Are you sure you want to change this user to ${newUserType}?`)) return;

    setChangingUserTypeId(userId);
    try {
      const response = await fetch('/api/changeUserType', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          targetUserId: userId,
          newUserType: newUserType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon gebruikerstype niet wijzigen');
      }

      // Success - the realtime listener will update the UI automatically
    } catch (error: any) {
      console.error('Error changing user type:', error);
      alert(error.message || 'Er is iets misgegaan bij het wijzigen van het gebruikerstype');
    } finally {
      setChangingUserTypeId(null);
    }
  };

  const openEmailModal = (email: string, name: string) => {
    setSelectedUser({ email, name });
    setEmailModalOpen(true);
  };

  const closeEmailModal = () => {
    setEmailModalOpen(false);
    setSelectedUser(null);
  };

  // Filter users based on search term and type
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.playername.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === "all" || user.userType === filterType;

    const matchesDeletedFilter = showDeleted || !user.deletedAt;

    return matchesSearch && matchesType && matchesDeletedFilter;
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
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Toon verwijderde gebruikers
            </label>
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
                  <tr key={user.uid} className={`hover:bg-gray-50 transition-colors ${user.deletedAt ? 'bg-gray-100 opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex flex-col items-start gap-2">
                          <div className="text-sm font-medium text-gray-900">
                            <Link href={`/user/${user.uid}`}>{user.playername}</Link>
                          </div>
                          {user.deletedAt && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500 text-white">
                              Verwijderd
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
                      {isAdmin ? (
                        <select
                          value={user.userType}
                          onChange={(e) => changeUserType(user.uid, user.userType, e.target.value)}
                          disabled={changingUserTypeId === user.uid || user.userType === 'admin'}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            user.userType === 'admin'
                              ? 'bg-primary text-white cursor-not-allowed'
                              : 'bg-blue-100 text-blue-800 cursor-pointer'
                          } ${changingUserTypeId === user.uid ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.userType === 'admin'
                            ? 'bg-primary text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.userType}
                        </span>
                      )}
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
                      <div className="flex gap-2">
                        {user.deletedAt ? (
                          <Button
                            className="py-1 px-3 text-sm bg-green-600 hover:bg-green-700"
                            text={deletingUserId === user.uid ? "busy..." : "Restore"}
                            onClick={() => restoreUser(user.uid)}
                            disabled={deletingUserId === user.uid}
                          />
                        ) : (
                          <Button
                            className="py-1 px-3 text-sm bg-gray-600 hover:bg-gray-700"
                            text={deletingUserId === user.uid ? "busy..." : "Delete"}
                            onClick={() => deleteUser(user.uid)}
                            disabled={deletingUserId === user.uid}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Totaal Gebruikers</div>
          <div className="text-2xl font-bold text-gray-900">{users.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Admins</div>
          <div className="text-2xl font-bold text-primary">
            {users.filter(u => u.userType === 'admin').length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Reguliere Gebruikers</div>
          <div className="text-2xl font-bold text-blue-600">
            {users.filter(u => u.userType === 'user').length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">Verwijderde Gebruikers</div>
          <div className="text-2xl font-bold text-gray-600">
            {users.filter(u => u.deletedAt).length}
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {selectedUser && (
        <EmailUserModal
          isOpen={emailModalOpen}
          onClose={closeEmailModal}
          userEmail={selectedUser.email}
          userName={selectedUser.name}
        />
      )}
    </div>
  );
}
