'use client'

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle } from 'tabler-icons-react';

interface MobileFloatingMenuProps {
    onFeedbackClick: () => void;
}

export function MobileFloatingMenu({ onFeedbackClick }: MobileFloatingMenuProps) {
    const [feedbackExpanded, setFeedbackExpanded] = useState(false);
    const [coffeeExpanded, setCoffeeExpanded] = useState(false);
    const [prizesExpanded, setPrizesExpanded] = useState(false);
    const [showPrizesModal, setShowPrizesModal] = useState(false);
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);

    // Click outside to collapse
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setFeedbackExpanded(false);
                setCoffeeExpanded(false);
                setPrizesExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            setPrizesExpanded(false);
        }
    };

    const handleCoffeeButtonClick = (e: React.MouseEvent) => {
        if (coffeeExpanded) {
            // Already expanded, let the link work
            handleCoffeeClick();
        } else {
            e.preventDefault();
            setCoffeeExpanded(true);
            setFeedbackExpanded(false);
            setPrizesExpanded(false);
        }
    };

    const handlePrizesButtonClick = (e: React.MouseEvent) => {
        if (prizesExpanded) {
            e.preventDefault();
            setShowPrizesModal(true);
        } else {
            e.preventDefault();
            setPrizesExpanded(true);
            setFeedbackExpanded(false);
            setCoffeeExpanded(false);
        }
    };

    return (
        <div ref={containerRef} className="md:hidden fixed bottom-4 left-4 z-50 flex flex-col gap-3">
            {showPrizesModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <button
                        className="absolute inset-0 bg-black/40"
                        aria-label="Sluit prijzen"
                        onClick={() => setShowPrizesModal(false)}
                    />
                    <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-xl border border-gray-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Prijzen</h3>
                            <button
                                className="text-gray-500 hover:text-gray-700"
                                aria-label="Sluit"
                                onClick={() => setShowPrizesModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="px-5 py-4 text-sm text-gray-700 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-2">
                                <div className="font-semibold text-gray-900">1e prijs</div>
                                <div>&#39;Bike &amp; Pancakes&#39; arrangement voor 4 personen.</div>
                                <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <img
                                        src="https://bercbike.nl/wp-content/uploads/2023/02/gravelbike-huren-montferland-1024x683.jpg"
                                        alt="1e prijs - Bike & Pancakes arrangement"
                                        className="w-full h-40 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-gray-900">2e prijs</div>
                                <div>Gravel arrangement voor 2 personen.</div>
                                <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <img
                                        src="https://bercbike.nl/wp-content/uploads/2021/11/mtb-verhuur-zeddam-montferland.jpg"
                                        alt="2e prijs - Gravel arrangement"
                                        className="w-full h-40 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-gray-900">3e prijs</div>
                                <div>&#39;Proefritje&#39; te nuttigen in het wielercafe in Zeddam</div>
                                <div className="text-xs text-gray-500">(3 speciaalbiertjes geserveerd met lokale kaas &amp; worst)</div>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <img
                                        src="https://bercbike.nl/wp-content/uploads/2021/07/achterhoekse-bieren-wielercafe-1024x1024.jpg"
                                        alt="3e prijs - Proefritje"
                                        className="w-full h-40 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-gray-900">4e &amp; 5e prijs</div>
                                <div>een &#39;Veloholic&#39; shirt</div>
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <img
                                        src="https://res.cloudinary.com/dtkg71eih/image/upload/v1771949728/wielershirt_z4m8wc.jpg"
                                        alt="4e en 5e prijs - Veloholic shirt"
                                        className="w-full h-40 object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                            <div className="text-xs text-gray-500">
                                * Het buffje mag je houden als aandenken aan een leuke sportieve middag!
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowPrizesModal(false)}
                                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900"
                            >
                                Sluiten
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Buy me a coffee button */}
            <a
                href="https://buymeacoffee.com/jasperh"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCoffeeButtonClick}
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

            {/* Berc Bike prizes button */}
            <button
                onClick={handlePrizesButtonClick}
                className={`h-12 rounded-full shadow-lg flex items-center cursor-pointer transition-all duration-300 ease-out bg-white hover:bg-emerald-50 overflow-hidden border border-emerald-200 ${prizesExpanded ? 'px-4 gap-2' : 'w-12 justify-center'}`}
            >
                <div className="flex-shrink-0 w-9 h-9 bg-white flex items-center justify-center overflow-hidden">
                    <Image
                        src="/berc-bike-logo.jpg"
                        alt="Berc Bike"
                        width={36}
                        height={36}
                        className="w-fit h-fit object-contain"
                    />
                </div>
                <span className={`text-sm text-emerald-700 font-medium whitespace-nowrap transition-all duration-300 ${prizesExpanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0'}`}>
                    Prijzen
                </span>
            </button>

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
