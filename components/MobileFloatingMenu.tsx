'use client'

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle } from 'tabler-icons-react';

interface MobileFloatingMenuProps {
    onFeedbackClick: () => void;
}

export function MobileFloatingMenu({ onFeedbackClick }: MobileFloatingMenuProps) {
    const [feedbackExpanded, setFeedbackExpanded] = useState(false);
    const [coffeeExpanded, setCoffeeExpanded] = useState(false);
    const { user } = useAuth();

    const handleCoffeeClick = async () => {
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
        }
    };

    const handleFeedbackButtonClick = () => {
        if (feedbackExpanded) {
            onFeedbackClick();
            setFeedbackExpanded(false);
        } else {
            setFeedbackExpanded(true);
            setCoffeeExpanded(false);
        }
    };

    const handleCoffeeButtonClick = () => {
        if (!coffeeExpanded) {
            setCoffeeExpanded(true);
            setFeedbackExpanded(false);
        }
    };

    return (
        <div className="md:hidden fixed bottom-4 left-4 z-50 flex flex-col gap-3">
            {/* Buy me a coffee button */}
            <a
                href={coffeeExpanded ? "https://buymeacoffee.com/jasperh" : undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                    if (!coffeeExpanded) {
                        e.preventDefault();
                        handleCoffeeButtonClick();
                    } else {
                        handleCoffeeClick();
                    }
                }}
                className={`h-12 rounded-full shadow-lg flex items-center cursor-pointer transition-all duration-300 ease-out bg-[#FFDD00] hover:bg-[#FFED4E] overflow-hidden ${coffeeExpanded ? 'px-4 gap-2' : 'w-12 justify-center'}`}
            >
                <Image
                    src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg"
                    alt="Buy me a coffee"
                    width={24}
                    height={24}
                    className="flex-shrink-0"
                />
                <span className={`text-sm text-black font-medium whitespace-nowrap transition-all duration-300 ${coffeeExpanded ? 'opacity-100 max-w-[150px]' : 'opacity-0 max-w-0'}`}>
                    Buy me a coffee
                </span>
            </a>

            {/* Feedback button */}
            <button
                onClick={handleFeedbackButtonClick}
                className={`h-12 rounded-full shadow-lg flex items-center cursor-pointer transition-all duration-300 ease-out bg-primary hover:bg-[#357771] overflow-hidden ${feedbackExpanded ? 'px-4 gap-2' : 'w-12 justify-center'}`}
            >
                <MessageCircle size={24} className="text-white flex-shrink-0" />
                <span className={`text-sm text-white font-medium whitespace-nowrap transition-all duration-300 ${feedbackExpanded ? 'opacity-100 max-w-[100px]' : 'opacity-0 max-w-0'}`}>
                    Feedback
                </span>
            </button>
        </div>
    );
}
