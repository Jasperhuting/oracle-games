'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'tabler-icons-react';

interface DeadlineCountdownProps {
  deadline: string | Date;
  raceName?: string;
  onDeadlinePassed?: () => void;
  showWarningAt?: number; // Minutes before deadline to show warning style
}

export function DeadlineCountdown({
  deadline,
  raceName,
  onDeadlinePassed,
  showWarningAt = 60
}: DeadlineCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isPassed, setIsPassed] = useState(false);

  useEffect(() => {
    const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = deadlineDate.getTime() - now;

      if (remaining <= 0) {
        setTimeRemaining(0);
        setIsPassed(true);
        onDeadlinePassed?.();
      } else {
        setTimeRemaining(remaining);
        setIsPassed(false);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [deadline, onDeadlinePassed]);

  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return 'Deadline passed';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;

    if (days > 0) {
      return `${days}d ${remainingHours}h ${remainingMinutes}m`;
    }
    if (hours > 0) {
      return `${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }
    if (minutes > 0) {
      return `${remainingMinutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const isWarning = timeRemaining > 0 && timeRemaining <= showWarningAt * 60 * 1000;
  const isUrgent = timeRemaining > 0 && timeRemaining <= 10 * 60 * 1000; // 10 minutes

  if (isPassed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-gray-600">
        <Clock className="w-4 h-4" />
        <div>
          <div className="text-sm font-medium">Deadline passed</div>
          {raceName && <div className="text-xs">{raceName}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        isUrgent
          ? 'bg-red-100 text-red-700 animate-pulse'
          : isWarning
          ? 'bg-orange-100 text-orange-700'
          : 'bg-blue-50 text-blue-700'
      }`}
    >
      {isUrgent ? (
        <AlertCircle className="w-4 h-4" />
      ) : (
        <Clock className="w-4 h-4" />
      )}
      <div>
        <div className="text-sm font-medium font-mono">
          {formatCountdown(timeRemaining)}
        </div>
        {raceName && <div className="text-xs opacity-75">{raceName}</div>}
      </div>
    </div>
  );
}

interface MultiDeadlineCountdownProps {
  races: Array<{
    raceSlug: string;
    raceName: string;
    pickDeadline: string;
    status: string;
  }>;
  onSelectRace?: (raceSlug: string) => void;
}

export function NextDeadlineCountdown({
  races,
  onSelectRace
}: MultiDeadlineCountdownProps) {
  const upcomingRaces = races
    .filter(r => r.status === 'upcoming' && new Date(r.pickDeadline) > new Date())
    .sort((a, b) => new Date(a.pickDeadline).getTime() - new Date(b.pickDeadline).getTime());

  const nextRace = upcomingRaces[0];

  if (!nextRace) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-gray-500">
        <Clock className="w-4 h-4" />
        <span className="text-sm">No upcoming deadlines</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelectRace?.(nextRace.raceSlug)}
      className={onSelectRace ? 'cursor-pointer' : ''}
    >
      <DeadlineCountdown
        deadline={nextRace.pickDeadline}
        raceName={nextRace.raceName}
      />
    </div>
  );
}
