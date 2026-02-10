'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Feedback } from "@/lib/types/games";
import { Button } from "./Button";
import toast from "react-hot-toast";

export const FeedbackTab = () => {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'reviewed' | 'resolved'>('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchFeedback();
  }, [user]);

  const fetchFeedback = async () => {

    if (!user) return;

    try {
      const response = await fetch(`/api/feedback?userId=${user.uid}`);

      if (response.ok) {
        const data: Feedback[] = await response.json();
        setFeedback(data);
      } else {
        toast.error('Failed to fetch feedback');
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Error loading feedback');
    } finally {
      setLoading(false);
    }
  };

  const deleteFeedback = async (feedbackId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/feedback', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedbackId }),
      });
      if (response.ok) {
        toast.success('Feedback deleted successfully');
        // Update local state
        setFeedback(prev => prev.filter(f => f.id !== feedbackId));
      } else {
        toast.error('Failed to delete feedback');
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      toast.error('Error deleting feedback');
    }
  };

  const updateStatus = async (feedbackId: string, status: 'new' | 'reviewed' | 'resolved') => {
    if (!user) return;

    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          feedbackId,
          status,
        }),
      });

      if (response.ok) {
        toast.success('Status updated successfully');
        // Update local state
        setFeedback(prev => prev.map(f =>
          f.id === feedbackId ? { ...f, status } : f
        ));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating feedback status:', error);
      toast.error('Error updating status');
    }
  };

  const submitReply = async (feedbackId: string) => {
    if (!user) return;

    const reply = replyText[feedbackId]?.trim();
    if (!reply) {
      toast.error('Please enter a response');
      return;
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          feedbackId,
          adminResponse: reply,
        }),
      });

      if (response.ok) {
        toast.success('Response added successfully');
        // Update local state
        setFeedback(prev => prev.map(f =>
          f.id === feedbackId 
            ? { ...f, adminResponse: reply, adminResponseDate: new Date().toISOString() } 
            : f
        ));
        setReplyingTo(null);
        setReplyText(prev => ({ ...prev, [feedbackId]: '' }));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add response');
      }
    } catch (error) {
      console.error('Error adding response:', error);
      toast.error('Error adding response');
    }
  };

  const filteredFeedback = filter === 'all'
    ? feedback
    : feedback.filter(f => f.status === filter);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'reviewed':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

    const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading feedback...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">User Feedback</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({feedback.length})
            </button>
            <button
              onClick={() => setFilter('new')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                filter === 'new'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              New ({feedback.filter(f => f.status === 'new').length})
            </button>
            <button
              onClick={() => setFilter('reviewed')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                filter === 'reviewed'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reviewed ({feedback.filter(f => f.status === 'reviewed').length})
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                filter === 'resolved'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Resolved ({feedback.filter(f => f.status === 'resolved').length})
            </button>
          </div>
        </div>

        {filteredFeedback.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No feedback found.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFeedback.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base break-words">{item.userEmail}</p>
                    <p className="text-xs sm:text-sm text-gray-500 flex flex-wrap gap-2 items-center">
                      {new Date(item.createdAt).toLocaleString()}
                      <span title={item.currentPage} className="text-[10px] sm:text-xs text-gray-500 cursor-pointer">Current Page</span>
                    </p>
                  </div>
                  <span className={`self-start px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium ${getStatusColor(item.status)}`}>
                    {item.status || 'new'}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base">{item.message}</p>
                </div>

                {/* Admin Response Section */}
                {item.adminResponse && (
                  <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-green-900">Admin Response:</p>
                      {item.adminResponseDate && (
                        <p className="text-xs text-green-600">
                          {formatDate(item.adminResponseDate)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-green-800 whitespace-pre-wrap">{item.adminResponse}</p>
                  </div>
                )}

                {/* Reply Input Section */}
                {replyingTo === item.id && (
                  <div className="mb-4">
                    <textarea
                      value={replyText[item.id!] || ''}
                      onChange={(e) => setReplyText(prev => ({ ...prev, [item.id!]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[90px] text-sm"
                      placeholder="Type your response..."
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button
                        text="Send Response"
                        onClick={() => submitReply(item.id!)}
                        className="px-3 py-1 text-xs sm:text-sm"
                        variant="primary"
                      />
                      <Button
                        text="Cancel"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText(prev => ({ ...prev, [item.id!]: '' }));
                        }}
                        className="px-3 py-1 text-xs sm:text-sm"
                        variant="secondary"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {item.status !== 'new' && (
                    <Button
                      text="Mark as New"
                      onClick={() => updateStatus(item.id!, 'new')}
                      className="px-3 py-1 text-xs sm:text-sm"
                      variant="secondary"
                      ghost
                    />
                  )}
                  {item.status !== 'reviewed' && (
                    <Button
                      text="Mark as Reviewed"
                      onClick={() => updateStatus(item.id!, 'reviewed')}
                      className="px-3 py-1 text-xs sm:text-sm"
                      variant="secondary"
                      ghost
                    />
                  )}
                  {item.status !== 'resolved' && (
                    <Button
                      text="Mark as Resolved"
                      onClick={() => updateStatus(item.id!, 'resolved')}
                      className="px-3 py-1 text-xs sm:text-sm"
                      variant="success"
                      ghost
                    />
                  )}
                  
                  {!item.adminResponse && (
                    <Button
                      text={replyingTo === item.id ? "Cancel Reply" : "Reply"}
                      onClick={() => {
                        if (replyingTo === item.id) {
                          setReplyingTo(null);
                          setReplyText(prev => ({ ...prev, [item.id!]: '' }));
                        } else {
                          setReplyingTo(item.id!);
                        }
                      }}
                      className="px-3 py-1 text-xs sm:text-sm"
                      variant="primary"
                      ghost
                    />
                  )}
                  
                    <Button
                      text="Delete"
                      onClick={() => deleteFeedback(item.id!)}
                      className="px-3 py-1 text-xs sm:text-sm"
                      variant="danger"
                      ghost
                    />
                  
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
