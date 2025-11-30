'use client'

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './Button';
import toast from 'react-hot-toast';

export const FeedbackModal = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to submit feedback');
      return;
    }

    if (message.trim().length === 0) {
      toast.error('Please enter your feedback');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          message: message.trim(),
          currentPage: window.location.href,
        }),
      });

      if (response.ok) {
        toast.success('Feedback submitted successfully. Thank you!');
        setMessage('');
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Error submitting feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Send Feedback</h2>
        <p className="text-gray-600 mb-4">
          We'd love to hear your thoughts, suggestions, or report any issues you've encountered.
        </p>

        <div className="mb-4">
          <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 mb-2">
            Your Feedback
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
            placeholder="Tell us what you think..."
            disabled={submitting}
          />
        </div>

        <div className="flex justify-end space-x-3">
          <Button
            text="Cancel"
            onClick={onClose}
            disabled={submitting}
            variant="secondary"
          />
          <Button
            text={submitting ? 'Submitting...' : 'Submit Feedback'}
            onClick={handleSubmit}
            disabled={submitting || message.trim().length === 0}
            variant="primary"
          />
        </div>
      </div>
    </div>
  );
};