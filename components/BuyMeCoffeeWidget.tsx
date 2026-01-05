'use client'

import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';

export function BuyMeCoffeeWidget() {
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

  return (
    <a
      href="https://buymeacoffee.com/jasperh"
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="fixed bottom-[250px] rotate-90 -left-[64px] z-50 rounded-t-lg bg-[#FFDD00] text-[#000000] px-4 py-2 cursor-pointer hover:bg-[#FFED4E] transition-colors flex items-center gap-2"
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
