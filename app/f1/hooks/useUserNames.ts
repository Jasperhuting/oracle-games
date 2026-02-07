'use client';

import { useState, useEffect } from 'react';
interface UserNameMap {
  [userId: string]: string;
}

interface UserAvatarMap {
  [userId: string]: string | undefined;
}

interface UserNamesResult {
  names: UserNameMap;
  avatars: UserAvatarMap;
  loading: boolean;
}

// Hook to fetch display names for a list of user IDs from the default database
export function useUserNames(userIds: string[]): UserNamesResult {
  const [names, setNames] = useState<UserNameMap>({});
  const [avatars, setAvatars] = useState<UserAvatarMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchNames = async () => {
      try {
        const response = await fetch(`/api/users/names?ids=${encodeURIComponent(userIds.join(','))}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user names');
        }
        const data = await response.json();
        const nameMap: UserNameMap = data?.data || {};
        const avatarMap: UserAvatarMap = data?.avatars || {};

        setNames(nameMap);
        setAvatars(avatarMap);
      } catch (err) {
        console.error('Error fetching user names:', err);
        const fallback: UserNameMap = {};
        userIds.forEach((userId) => {
          fallback[userId] = userId.substring(0, 8) + '...';
        });
        setNames(fallback);
        setAvatars({});
      } finally {
        setLoading(false);
      }
    };

    fetchNames();
  }, [userIds.join(',')]); // Re-run when userIds change

  return { names, avatars, loading };
}
