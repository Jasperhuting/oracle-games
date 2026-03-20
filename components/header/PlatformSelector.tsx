'use client'

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "tabler-icons-react";
import type { PlatformKey } from "@/lib/platform";

interface PlatformOption {
    key: PlatformKey;
    label: string;
}

const PLATFORM_EMOJIS: Record<PlatformKey, string> = {
    cycling: "🚴",
    f1: "🏎️",
    football: "⚽",
};

interface PlatformSelectorProps {
    currentPlatform: PlatformKey;
    platformOptions: PlatformOption[];
    onPlatformChange: (platform: PlatformKey) => void;
    className?: string;
    buttonClassName?: string;
    dropdownClassName?: string;
}

export function PlatformSelector({
    currentPlatform,
    platformOptions,
    onPlatformChange,
    className = "",
    buttonClassName = "",
    dropdownClassName = "",
}: PlatformSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentOption = useMemo(
        () => platformOptions.find((option) => option.key === currentPlatform) ?? platformOptions[0],
        [currentPlatform, platformOptions],
    );

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--platform-header-accent-soft)] hover:text-[var(--platform-header-link-hover)] ${buttonClassName}`}
                style={{
                    color: "var(--platform-header-title)",
                    background: "var(--platform-header-bg)",
                    borderColor: "var(--platform-selector-border)",
                }}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="shrink-0 text-base leading-none">
                        {currentOption ? PLATFORM_EMOJIS[currentOption.key] : "🌐"}
                    </span>
                    <span className="truncate">{currentOption?.label ?? "Select platform"}</span>
                </span>
                <ChevronDown
                    size={18}
                    className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && (
                <div
                    className={`absolute right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl ${dropdownClassName}`}
                    style={{
                        minWidth: "100%",
                        background: "var(--platform-header-bg)",
                    }}
                >
                    <div className="max-h-72 overflow-y-auto py-2">
                        <div
                            className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                            style={{ color: "var(--platform-header-link)" }}
                        >
                            Platforms
                        </div>
                        {platformOptions.map((platform, index) => {
                            const isSelected = platform.key === currentPlatform;

                            return (
                                <button
                                    key={platform.key}
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        if (!isSelected) {
                                            onPlatformChange(platform.key);
                                        }
                                    }}
                                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--platform-header-accent-soft)] hover:text-[var(--platform-header-link-hover)] ${
                                        index % 2 === 0 ? "" : "bg-black/[0.02]"
                                    }`}
                                    style={{
                                        color: isSelected
                                            ? "var(--platform-header-link-active)"
                                            : "var(--platform-header-link)",
                                        background: isSelected
                                            ? "var(--platform-header-accent-soft)"
                                            : undefined,
                                        fontWeight: isSelected ? 600 : 400,
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        <span aria-hidden="true" className="shrink-0 text-base leading-none">
                                            {PLATFORM_EMOJIS[platform.key]}
                                        </span>
                                        <span>{platform.label}</span>
                                    </span>
                                    {isSelected && <Check size={18} className="shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
