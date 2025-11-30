import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    text?: string | React.ReactNode;
    fullWidth?: boolean;
    endIcon?: React.ReactNode;
    startIcon?: React.ReactNode;
    selected?: boolean;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'text';
    outline?: boolean;
    ghost?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'text';
}

// Color styles for each variant
const solidStyles = {
    primary: 'bg-primary text-white hover:bg-primary/90 border-primary',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 border-gray-600',
    success: 'bg-green-600 text-white hover:bg-green-700 border-green-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500',
    text: 'bg-transparent text-primary border-none underline hover:text-primary/80',
};

const outlineStyles = {
    primary: 'bg-transparent text-primary border-primary hover:bg-primary hover:text-white',
    secondary: 'bg-transparent text-gray-600 border-gray-600 hover:bg-gray-600 hover:text-white',
    success: 'bg-transparent text-green-600 border-green-600 hover:bg-green-600 hover:text-white',
    danger: 'bg-transparent text-red-600 border-red-600 hover:bg-red-600 hover:text-white',
    warning: 'bg-transparent text-yellow-600 border-yellow-600 hover:bg-yellow-600 hover:text-white',
    text: 'bg-transparent text-primary border-none hover:text-primary/80',
};

const ghostStyles = {
    primary: 'bg-transparent text-primary border-primary/30 hover:bg-primary/10 hover:border-primary',
    secondary: 'bg-transparent text-gray-600 border-gray-600/30 hover:bg-gray-100 hover:border-gray-600',
    success: 'bg-transparent text-green-600 border-green-600/30 hover:bg-green-50 hover:border-green-600',
    danger: 'bg-transparent text-red-600 border-red-600/30 hover:bg-red-50 hover:border-red-600',
    warning: 'bg-transparent text-yellow-600 border-yellow-600/30 hover:bg-yellow-50 hover:border-yellow-600',
    text: 'bg-transparent text-primary border-none hover:text-primary/80',
};

// Size styles
const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
    text: 'text-sm'
};

export const Button = ({
    text,
    fullWidth,
    endIcon,
    startIcon,
    selected,
    className,
    disabled,
    children,
    variant = 'primary',
    outline = false,
    ghost = false,
    size = 'md',
    ...props
}: ButtonProps) => {
    const baseStyles = 'rounded-sm border transition-colors duration-200 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

    const widthClass = fullWidth ? 'w-full' : 'w-fit';

    const selectedStyles = selected
        ? 'bg-white text-primary border-primary ring-2 ring-primary ring-offset-2'
        : '';

    // Determine which style set to use based on outline/ghost flags
    let variantStyle: string;
    if (ghost) {
        variantStyle = ghostStyles[variant];
    } else if (outline) {
        variantStyle = outlineStyles[variant];
    } else {
        variantStyle = solidStyles[variant];
    }

    return (
        <button
            className={cn(
                baseStyles,
                variantStyle,
                sizeStyles[size],
                widthClass,
                selectedStyles,
                className
            )}
            disabled={disabled}
            {...props}
        >
            {startIcon && <span>{startIcon}</span>}
            {(text || children) && <span>{text || children}</span>}
            {endIcon && <span>{endIcon}</span>}
        </button>
    );
}