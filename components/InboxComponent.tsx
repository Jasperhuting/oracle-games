'use client';

import { useAuth } from '@/hooks/useAuth';
import { ClientMessage } from '@/lib/types/games';
import { useEffect, useState } from 'react';
import { Mail, MailOpened, X, Trash, Send } from 'tabler-icons-react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

type TabType = 'inbox' | 'outbox';

export default function InboxComponent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const [inboxMessages, setInboxMessages] = useState<ClientMessage[]>([]);
  const [outboxMessages, setOutboxMessages] = useState<ClientMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ClientMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const checkBannerCookie = () => {
      // Clear any localStorage value (legacy)
      if (typeof window !== 'undefined' && localStorage.getItem('hide-beta-banner') !== null) {
        localStorage.removeItem('hide-beta-banner');
      }
  
      const cookies = document.cookie.split('; ');
      const hideBannerCookie = cookies.find(cookie => cookie.startsWith('hide-beta-banner='));
  
      if (hideBannerCookie) {
        // Extract the value after 'hide-beta-banner='
        const value = hideBannerCookie.split('=')[1];
        setShowBanner(value !== 'true');
      } else {
        setShowBanner(true);
      }
    };
  
    // Check initially
    checkBannerCookie();
  
    // Poll for cookie changes (since cookies don't trigger events)
    const interval = setInterval(checkBannerCookie, 100);
  
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, 'messages');

    // Set up real-time listener for inbox messages (received)
    const inboxQuery = query(
      messagesRef,
      where('recipientId', '==', user.uid)
    );

    const unsubscribeInbox = onSnapshot(
      inboxQuery,
      (snapshot) => {
        // Filter out messages deleted by recipient
        const messagesData: ClientMessage[] = snapshot.docs
          .filter(doc => !doc.data().deletedAt && !doc.data().deletedByRecipient)
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
        setInboxMessages(messagesData);
        setLoading(false);
      },
      (error) => {
        console.log('Inbox initializing... (indexes building)');
        setInboxMessages([]);
        setLoading(false);
      }
    );

    // Set up real-time listener for outbox messages (sent)
    const outboxQuery = query(
      messagesRef,
      where('senderId', '==', user.uid)
    );

    const unsubscribeOutbox = onSnapshot(
      outboxQuery,
      (snapshot) => {
        // Filter out messages deleted by sender
        const messagesData: ClientMessage[] = snapshot.docs
          .filter(doc => !doc.data().deletedAt && !doc.data().deletedBySender)
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
        setOutboxMessages(messagesData);
      },
      (error) => {
        console.log('Outbox initializing... (indexes building)');
        setOutboxMessages([]);
      }
    );

    return () => {
      unsubscribeInbox();
      unsubscribeOutbox();
    };
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

  const messages = activeTab === 'inbox' ? inboxMessages : outboxMessages;

  return (
    <div className={`container mx-auto px-4 py-8 ${showBanner ? 'mt-[36px]' : 'mt-0'}`}>
      <h1 className="text-3xl font-bold mb-6">Messages</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setActiveTab('inbox');
            setSelectedMessage(null);
          }}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'inbox'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Mail className="w-5 h-5" />
          Inbox ({inboxMessages.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('outbox');
            setSelectedMessage(null);
          }}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'outbox'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Send className="w-5 h-5" />
          Outbox ({outboxMessages.length})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">
              {activeTab === 'inbox' ? 'Received' : 'Sent'} ({messages.length})
            </h2>
            {activeTab === 'inbox' && (
              <p className="text-sm text-gray-600">
                {inboxMessages.filter((m) => !m.read).length} unread
              </p>
            )}
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {activeTab === 'inbox' ? (
                  <Mail className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                ) : (
                  <Send className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                )}
                <p>{activeTab === 'inbox' ? 'No messages yet' : 'No sent messages yet'}</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    activeTab === 'inbox' && !message.read ? 'bg-blue-50' : ''
                  } ${selectedMessage?.id === message.id ? 'bg-blue-100' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {activeTab === 'inbox' ? (
                        message.read ? (
                          <MailOpened className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Mail className="w-5 h-5 text-blue-600" />
                        )
                      ) : (
                        <Send className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-sm font-medium truncate ${activeTab === 'inbox' && !message.read ? 'font-bold' : ''}`}>
                          {activeTab === 'inbox' ? message.senderName : message.recipientName || 'Broadcast'}
                        </p>
                        <div className="flex items-center gap-2">
                          {message.type === 'broadcast' && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              Broadcast
                            </span>
                          )}
                          <button
                            onClick={(e) => deleteMessage(message.id!, e)}
                            className="p-1 hover:bg-red-100 rounded cursor-pointer transition-colors"
                            title="Delete message"
                          >
                            <Trash className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                      <p className={`text-sm truncate ${activeTab === 'inbox' && !message.read ? 'font-semibold' : 'text-gray-600'}`}>
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
                    {activeTab === 'inbox' ? (
                      <p>From: <span className="font-medium">{selectedMessage.senderName}</span></p>
                    ) : (
                      <p>To: <span className="font-medium">{selectedMessage.recipientName || 'All users (Broadcast)'}</span></p>
                    )}
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
                    className="p-2 hover:bg-red-100 rounded-full cursor-pointer transition-colors"
                    title="Delete message"
                  >
                    <Trash className="w-5 h-5 text-red-600" />
                  </button>
                  <button
                    onClick={closeMessageDetail}
                    className="p-2 hover:bg-gray-100 rounded-full cursor-pointer transition-colors"
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
