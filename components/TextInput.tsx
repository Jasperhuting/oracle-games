import React from "react";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
    ({ label, className, ...props }, ref) => {
        return (
            <div className="flex flex-col">
                <label className="text-xs font-bold mt-4 mb-2">{label}</label>
                <input 
                    ref={ref}
                    className={`border border-gray-200 rounded-sm p-2 bg-white ${className || ''}`}
                    {...props}
                />        
            </div>
        );
    }
);

TextInput.displayName = 'TextInput';