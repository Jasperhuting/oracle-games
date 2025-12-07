'use client';

import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Send, Users, User } from 'tabler-icons-react';

interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

export default function MessagingTab() {
  const { user } = useAuth();
  const [messageType, setMessageType] = useState<'broadcast' | 'individual'>('broadcast');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch all users for individual messaging
    const fetchUsers = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/getUsers?userId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          // Map the data to the correct format
          const mappedUsers = (data.users || []).map((u: any) => ({
            id: u.uid,
            displayName: u.displayName || u.email || 'Unknown User',
            email: u.email || ''
          }));
          setUsers(mappedUsers);
        } else {
          console.error('Failed to fetch users:', await response.text());
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (messageType === 'individual' && user) {
      fetchUsers();
    }
  }, [messageType, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    if (!user) {
      setError('You must be logged in to send messages');
      setLoading(false);
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setError('Subject and message are required');
      setLoading(false);
      return;
    }

    if (messageType === 'individual' && !selectedUserId) {
      setError('Please select a recipient');
      setLoading(false);
      return;
    }

    try {
      const selectedUser = users.find((u) => u.id === selectedUserId);
      
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: user.uid,
          senderName: user.displayName || user.email || 'Admin',
          type: messageType,
          recipientId: messageType === 'individual' ? selectedUserId : undefined,
          recipientName: messageType === 'individual' ? selectedUser?.displayName || selectedUser?.email : undefined,
          subject,
          message,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Message sent successfully!');
        // Reset form
        setSubject('');
        setMessage('');
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('An error occurred while sending the message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Send Message</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Message Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Type
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setMessageType('broadcast')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  messageType === 'broadcast'
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 hover:border-primary'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Broadcast to All Users</span>
              </button>
              <button
                type="button"
                onClick={() => setMessageType('individual')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  messageType === 'individual'
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 hover:border-primary'
                }`}
              >
                <User className="w-5 h-5" />
                <span>Individual User</span>
              </button>
            </div>
          </div>

          {/* Recipient Selection (for individual messages) */}
          {messageType === 'individual' && (
            <div>
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-2">
                Select Recipient
              </label>
              <select
                id="recipient"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required={messageType === 'individual'}
              >
                <option value="">-- Select a user --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter message subject"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Enter your message"
              required
            />
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {success}
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
              <span>{loading ? 'Sending...' : 'Send Message'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">About Messaging</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Broadcast:</strong> Sends the message to all registered users</li>
          <li>• <strong>Individual:</strong> Sends the message to a specific user</li>
          <li>• Users will receive real-time notifications for new messages</li>
          <li>• Messages can be viewed in the user's inbox</li>
        </ul>
      </div>
    </div>
  );
}
