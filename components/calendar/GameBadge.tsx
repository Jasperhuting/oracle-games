import type { CalendarGame } from '@/lib/types';

export function GameBadge({ game }: { game: CalendarGame }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
      {game.name}
    </span>
  );
}
