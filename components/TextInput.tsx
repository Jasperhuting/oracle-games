import React from "react";
import { TextInputProps } from "@/lib/types/component-props";

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
    ({ label, className, ...props }, ref) => {
        return (
            <div className="flex flex-col">
                <label className="text-xs font-semibold mt-4 mb-1.5 text-gray-700 tracking-wide uppercase">{label}</label>
                <input
                    ref={ref}
                    className={`border border-gray-300 rounded px-3 py-2.5 bg-white text-sm text-gray-900 placeholder:text-gray-400 transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:border-gray-400 ${className || ''}`}
                    {...props}
                />
            </div>
        );
    }
);

TextInput.displayName = 'TextInput';