'use client'

import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';

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
        <Image
          src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg"
          alt="Buy me a coffee"
          width={12}
          height={12}
        />
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
      <Image
        src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg"
        alt="Buy me a coffee"
        width={16}
        height={16}
      />
      <span className="text-sm whitespace-nowrap">Buy me a coffee</span>
    </a>
  );
}
