'use client';

import { useAuth } from '@/hooks/useAuth';
import { ClientMessage } from '@/lib/types/games';
import { useEffect, useState } from 'react';
import { Mail, MailOpened, X, Trash } from 'tabler-icons-react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export default function InboxComponent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ClientMessage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Set up real-time listener for messages (simplified query for testing)
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('recipientId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter out deleted messages client-side
        const messagesData: ClientMessage[] = snapshot.docs
          .filter(doc => !doc.data().deletedAt)
          .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            senderId: data.senderId,
            senderName: data.senderName,
            recipientId: data.recipientId,
            recipientName: data.recipientName,
            subject: data.subject,
            message: data.message,
            sentAt: data.sentAt?.toDate().toISOString(),
            read: data.read,
            readAt: data.readAt?.toDate().toISOString(),
          };
        });
        // Sort by sentAt descending (most recent first)
        messagesData.sort((a, b) => {
          const aTime = new Date(a.sentAt || 0).getTime();
          const bTime = new Date(b.sentAt || 0).getTime();
          return bTime - aTime;
        });
        setMessages(messagesData);
        setLoading(false);
      },
      (error) => {
        console.log('Inbox initializing... (indexes building)');
        setMessages([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (messageId: string) => {
    if (!user) return;

    try {
      await fetch(`/api/messages/${messageId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleMessageClick = (message: ClientMessage) => {
    setSelectedMessage(message);
    if (!message.read) {
      markAsRead(message.id!);
    }
  };

  const deleteMessage = async (messageId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent opening the message when clicking delete
    }
    
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (response.ok) {
        // Close modal if the deleted message was selected
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(null);
        }
      } else {
        console.error('Failed to delete message');
        alert('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Error deleting message');
    }
  };

  const closeMessageDetail = () => {
    setSelectedMessage(null);
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Please log in to view your messages.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 mt-[36px]">        
      <h1 className="text-3xl font-bold mb-6">Inbox</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Messages ({messages.length})</h2>
            <p className="text-sm text-gray-600">
              {messages.filter((m) => !m.read).length} unread
            </p>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No messages yet</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !message.read ? 'bg-blue-50' : ''
                  } ${selectedMessage?.id === message.id ? 'bg-blue-100' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {message.read ? (
                        <MailOpened className="w-5 h-5 text-gray-400" />
                      ) : (
                        <Mail className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-sm font-medium truncate ${!message.read ? 'font-bold' : ''}`}>
                          {message.senderName}
                        </p>
                        <div className="flex items-center gap-2">
                          {message.type === 'broadcast' && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              Broadcast
                            </span>
                          )}
                          <button
                            onClick={(e) => deleteMessage(message.id!, e)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Delete message"
                          >
                            <Trash className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                      <p className={`text-sm truncate ${!message.read ? 'font-semibold' : 'text-gray-600'}`}>
                        {message.subject}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(message.sentAt).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          {selectedMessage ? (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold">{selectedMessage.subject}</h2>
                    {selectedMessage.type === 'broadcast' && (
                      <span className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded">
                        Broadcast
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>From: <span className="font-medium">{selectedMessage.senderName}</span></p>
                    <p>
                      {new Date(selectedMessage.sentAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteMessage(selectedMessage.id!)}
                    className="p-2 hover:bg-red-100 rounded-full transition-colors"
                    title="Delete message"
                  >
                    <Trash className="w-5 h-5 text-red-600" />
                  </button>
                  <button
                    onClick={closeMessageDetail}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="prose max-w-none whitespace-pre-wrap">
                  {selectedMessage.message}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4" />
                <p>Select a message to read</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
