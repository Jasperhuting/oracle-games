'use client';

interface AvatarBadgeProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function AvatarBadge({ name, avatarUrl, size = 36 }: AvatarBadgeProps) {
  const initials = getInitials(name);
  const dimension = `${size}px`;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Avatar'}
        className="rounded-full object-cover border border-gray-200"
        style={{ width: dimension, height: dimension }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold border border-gray-200"
      style={{ width: dimension, height: dimension }}
    >
      {initials}
    </div>
  );
}
