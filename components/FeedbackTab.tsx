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

  useEffect(() => {
    console.log('kom je hier wel?')
    fetchFeedback();
  }, [user]);

  const fetchFeedback = async () => {


    console.log(user);
    if (!user) return;

    try {
      const response = await fetch(`/api/feedback?userId=${user.uid}`);

      console.log(response);
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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">User Feedback</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({feedback.length})
            </button>
            <button
              onClick={() => setFilter('new')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'new'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              New ({feedback.filter(f => f.status === 'new').length})
            </button>
            <button
              onClick={() => setFilter('reviewed')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'reviewed'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reviewed ({feedback.filter(f => f.status === 'reviewed').length})
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{item.userEmail}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                    {item.status || 'new'}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{item.message}</p>
                </div>

                <div className="flex gap-2">
                  {item.status !== 'new' && (
                    <Button
                      text="Mark as New"
                      onClick={() => updateStatus(item.id!, 'new')}
                      className="px-3 py-1 text-sm"
                      variant="secondary"
                      ghost
                    />
                  )}
                  {item.status !== 'reviewed' && (
                    <Button
                      text="Mark as Reviewed"
                      onClick={() => updateStatus(item.id!, 'reviewed')}
                      className="px-3 py-1 text-sm"
                      variant="secondary"
                      ghost
                    />
                  )}
                  {item.status !== 'resolved' && (
                    <Button
                      text="Mark as Resolved"
                      onClick={() => updateStatus(item.id!, 'resolved')}
                      className="px-3 py-1 text-sm"
                      variant="primary"
                      ghost
                    />
                  )}
                  
                    <Button
                      text="Delete"
                      onClick={() => deleteFeedback(item.id!)}
                      className="px-3 py-1 text-sm"
                      variant="primary"
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
