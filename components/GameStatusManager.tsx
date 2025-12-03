'use client'

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GAME_STATUSES, GameStatus } from '@/lib/types/games';
import { Button } from '@ariakit/react';
import { ConfirmDialog } from './ConfirmDialog';

interface GameStatusManagerProps {
  gameId: string;
  currentStatus: GameStatus;
  onStatusChange?: () => void;
  compact?: boolean;
}

const STATUS_LABELS: Record<GameStatus, string> = {
  draft: 'Draft',
  registration: 'Registration',
  bidding: 'Bidding',
  active: 'Active',
  finished: 'Finished'
};

const STATUS_COLORS: Record<GameStatus, string> = {
  draft: 'bg-gray-500',
  registration: 'bg-blue-500',
  bidding: 'bg-purple-500',
  active: 'bg-green-500',
  finished: 'bg-red-500'
};

export const GameStatusManager = ({
  gameId,
  currentStatus,
  onStatusChange,
  compact = false
}: GameStatusManagerProps) => {
  const [updating, setUpdating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<GameStatus | null>(null);

  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left, // Align left edge of dropdown with left edge of button
        width: rect.width
      });
    }
  }, [showDropdown]);

  const confirmStatusChange = (newStatus: GameStatus) => {
    if (newStatus === currentStatus) {
      setShowDropdown(false);
      return;
    }

    setPendingStatus(newStatus);
    setConfirmOpen(true);
    setShowDropdown(false);
  };

  const handleStatusChange = async () => {
    if (!pendingStatus) return;

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: pendingStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      setShowDropdown(false);
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      setError(error.message || 'Failed to update status');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdating(false);
    }
  };

  if (compact) {
    return (
      <>
        <div className="relative inline-block">
          <button
            ref={buttonRef}
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={updating}
            className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLORS[currentStatus]} hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Click to change status"
          >
            {updating ? 'Updating...' : STATUS_LABELS[currentStatus]}
          </button>
        </div>

        {showDropdown && typeof document !== 'undefined' && createPortal(
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setShowDropdown(false)}
            />
            <div
              className="fixed w-40 bg-white border border-gray-200 rounded-md shadow-xl z-[101]"
              style={{
                top: `${dropdownPosition.top + 8}px`,
                left: `${dropdownPosition.left}px`,
              }}
            >
              {GAME_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => confirmStatusChange(status)}
                  disabled={updating}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    status === currentStatus ? 'bg-gray-50 font-semibold' : ''
                  } ${updating ? 'opacity-50 cursor-not-allowed' : ''} first:rounded-t-md last:rounded-b-md`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                    {STATUS_LABELS[status]}
                  </div>
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

        {error && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-700 whitespace-nowrap z-[101]"
            style={{
              top: `${dropdownPosition.top + 8}px`,
              left: `${dropdownPosition.left}px`,
            }}
          >
            {error}
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Current Status:</span>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLORS[currentStatus]}`}>
          {STATUS_LABELS[currentStatus]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {GAME_STATUSES.map((status) => (
          <Button
            key={status}
            onClick={() => confirmStatusChange(status)}
            disabled={updating || status === currentStatus}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              status === currentStatus
                ? `${STATUS_COLORS[status]} text-white cursor-default`
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {STATUS_LABELS[status]}
          </Button>
        ))}
      </div>

      {updating && (
        <div className="text-sm text-gray-600">
          Updating status...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700 space-y-1">
        <div className="font-semibold">Status Guide:</div>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><strong>Draft:</strong> Game is being set up (not visible to players)</li>
          <li><strong>Registration:</strong> Players can join the game</li>
          <li><strong>Bidding:</strong> Auction/bidding period is active</li>
          <li><strong>Active:</strong> Game is currently running</li>
          <li><strong>Finished:</strong> Game has ended</li>
        </ul>
      </div>

      {/* Status Change Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title="Change Game Status"
        description={
          pendingStatus ? (
            <>
              <p>Are you sure you want to change the game status from <strong>"{STATUS_LABELS[currentStatus]}"</strong> to <strong>"{STATUS_LABELS[pendingStatus]}"</strong>?</p>
              <p className="mt-2 text-sm text-gray-600">This will affect player access and game functionality.</p>
            </>
          ) : ''
        }
        confirmText="Change Status"
        cancelText="Cancel"
        variant="primary"
      />
    </div>
  );
};
