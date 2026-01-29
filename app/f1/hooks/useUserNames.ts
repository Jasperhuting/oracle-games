'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface UserNameMap {
  [userId: string]: string;
}

// Hook to fetch display names for a list of user IDs from the default database
export function useUserNames(userIds: string[]) {
  const [names, setNames] = useState<UserNameMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchNames = async () => {
      const nameMap: UserNameMap = {};
      
      // Fetch each user's display name
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const data = userDoc.data();
              // Use playername first, then fallback to other fields
              if (data.playername) {
                nameMap[userId] = data.playername;
              } else if (data.displayName) {
                nameMap[userId] = data.displayName;
              } else if (data.firstName && data.lastName) {
                nameMap[userId] = `${data.firstName} ${data.lastName}`;
              } else if (data.firstName) {
                nameMap[userId] = data.firstName;
              } else if (data.name) {
                nameMap[userId] = data.name;
              } else {
                nameMap[userId] = userId.substring(0, 8) + '...';
              }
            } else {
              nameMap[userId] = userId.substring(0, 8) + '...';
            }
          } catch (err) {
            console.error(`Error fetching user ${userId}:`, err);
            nameMap[userId] = userId.substring(0, 8) + '...';
          }
        })
      );

      setNames(nameMap);
      setLoading(false);
    };

    fetchNames();
  }, [userIds.join(',')]); // Re-run when userIds change

  return { names, loading };
}
