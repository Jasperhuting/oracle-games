'use client'

import { Button } from "./Button";

interface ImpersonationBannerProps {
  impersonatedUserName: string;
  adminName: string;
  onStop: () => void;
  topOffset: number; // 0 or 36 depending on beta banner
}

export const ImpersonationBanner = ({ 
  impersonatedUserName, 
  adminName, 
  onStop,
  topOffset 
}: ImpersonationBannerProps) => {
  return (
    <div 
      className="fixed left-0 right-0 z-50 bg-purple-600 text-white h-[48px]"
      style={{ top: `${topOffset}px` }}
    >
      <div className="container mx-auto px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">⚠️ Impersonating:</span>
          <span>{impersonatedUserName}</span>
          <span className="text-purple-200 text-sm">
            (Admin: {adminName})
          </span>
        </div>
        <Button
          onClick={onStop}
          variant="white"
          className="px-4 py-1"
        >
          Stop Impersonation
        </Button>
      </div>
    </div>
  );
}
