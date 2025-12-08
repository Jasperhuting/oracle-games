'use client'

import { useState } from 'react';
import { Button } from './Button';

interface EmailUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
}

export const EmailUserModal = ({ isOpen, onClose, userEmail, userName }: EmailUserModalProps) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Vul alsjeblieft een onderwerp en bericht in');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userEmail,
          subject: subject,
          message: message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Kon email niet versturen');
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error: unknown) {
      console.error('Error sending email:', error);
      setError(error instanceof Error ? error.message : 'Er is iets misgegaan bij het versturen van de email');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setMessage('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 z-10">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Email send to {userName}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{userEmail}</p>
          </div>

          {/* Success message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">Email successfully sent!</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject of your email"
                disabled={sending || success}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>  

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message..."
                rows={8}
                disabled={sending || success}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={handleClose}
              disabled={sending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <Button
              text={sending ? 'Sending...' : 'Send Email'}
              onClick={handleSend}
              disabled={sending || success}
              className="px-4 py-2 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
