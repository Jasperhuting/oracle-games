'use client'

import Image from 'next/image';

export function BuyMeCoffeeWidget() {
  return (
    <a
      href="https://buymeacoffee.com/jasperh"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-[250px] rotate-90 -left-[62px] z-50 rounded-t-lg bg-[#FFDD00] text-[#000000] px-4 py-2 cursor-pointer hover:bg-[#FFED4E] transition-colors flex items-center gap-2"
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
