'use client';

import { useState } from 'react';

interface MuteUserDialogProps {
  userId: string;
  userName: string;
  roomId: string;
  mutedBy: string;
  onClose: () => void;
}

type MuteDuration = '15' | '60' | 'permanent';

export default function MuteUserDialog({
  userId,
  userName,
  roomId,
  mutedBy,
  onClose,
}: MuteUserDialogProps) {
  const [duration, setDuration] = useState<MuteDuration>('15');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const durationOptions: { value: MuteDuration; label: string }[] = [
    { value: '15', label: '15 minuten' },
    { value: '60', label: '1 uur' },
    { value: 'permanent', label: 'Rest van de chat' },
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    const durationMinutes = duration === 'permanent' ? 99999 : parseInt(duration);

    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          mutedBy,
          durationMinutes,
          reason: reason.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Kon gebruiker niet dempen');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Gebruiker dempen: {userName}
        </h2>

        {/* Duration options */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duur
          </label>
          <div className="flex flex-col gap-2">
            {durationOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="radio"
                  name="muteDuration"
                  value={option.value}
                  checked={duration === option.value}
                  onChange={(e) => setDuration(e.target.value as MuteDuration)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-800">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reden (optioneel)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reden voor het dempen..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Dempen...' : 'Dempen'}
          </button>
        </div>
      </div>
    </div>
  );
}
