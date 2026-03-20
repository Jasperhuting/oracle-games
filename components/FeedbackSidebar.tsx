"use client";

interface FeedbackSidebarProps {
  onFeedbackClick: () => void;
  onBercClick: () => void;
  hidden: boolean;
}

export function FeedbackSidebar({
  onFeedbackClick,
  onBercClick,
  hidden,
}: FeedbackSidebarProps) {
  if (hidden) return null;

  return (
    <>
      <button
        className="hidden md:block fixed bottom-[100px] rotate-90 -left-[40px] z-50 rounded-t-lg bg-primary text-white px-4 py-2 cursor-pointer hover:bg-primary-hover transition-colors"
        onClick={onFeedbackClick}
      >
        Feedback
      </button>
      <button
        className="hidden md:flex fixed bottom-[404px] rotate-90 -left-[46px] z-50 rounded-t-lg bg-[#e9fbf4] text-[#0f5132] px-4 py-2 cursor-pointer border border-[#b5f0d4] hover:bg-[#def8ee] transition-colors items-center gap-2"
        onClick={onBercClick}
        aria-label="Berc Bikes prijzenactie"
      >
        <img
          src="/berc-bike-logo-transparent.png"
          alt="Berc Bikes"
          className="w-5 h-5 object-contain"
        />
        <span className="text-sm whitespace-nowrap">Berc Bike</span>
      </button>
    </>
  );
}
