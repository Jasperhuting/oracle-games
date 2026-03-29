'use client'

import { useAuth } from '@/hooks/useAuth';

function CoffeeBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const classes = size === 'md'
    ? 'h-6 w-6 text-sm'
    : 'h-4 w-4 text-[10px]';

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full bg-white/80 text-[#5b3a00] ${classes}`}
    >
      ☕
    </span>
  );
}

export function BuyMeCoffeeWidget({ isExpanded }: { isExpanded?: boolean }) {
  const { user } = useAuth();

  const handleClick = async () => {
    // Track the click (with userId if logged in, otherwise IP will be tracked server-side)
    try {
      await fetch('/api/track-support-click', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.uid || null,
        }),
      });
    } catch (error) {
      console.error('Error tracking support click:', error);
      // Don't prevent navigation if tracking fails
    }
    // Link will naturally navigate to Buy Me a Coffee
  };

  // Desktop version (rotated sidebar)
  if (isExpanded === undefined) {
    return (
      <a
        href="https://buymeacoffee.com/jasperh"
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="hidden md:flex fixed bottom-[250px] rotate-90 -left-[64px] z-50 rounded-t-lg bg-[#FFDD00] text-[#000000] px-4 py-2 cursor-pointer hover:bg-[#FFED4E] transition-colors items-center gap-2"
        title="Support Oracle Games"
      >
        <CoffeeBadge />
        <span className="text-sm whitespace-nowrap">Buy me a coffee</span>
      </a>
    );
  }

  // Mobile expanded version (in floating menu)
  return (
    <a
      href="https://buymeacoffee.com/jasperh"
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="flex items-center gap-2 bg-[#FFDD00] text-[#000000] px-3 py-2 rounded-lg cursor-pointer hover:bg-[#FFED4E] transition-colors"
      title="Support Oracle Games"
    >
      <CoffeeBadge size="md" />
      <span className="text-sm whitespace-nowrap">Buy me a coffee</span>
    </a>
  );
}
