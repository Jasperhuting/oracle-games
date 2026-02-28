import { cn } from "@/lib/utils";
import { ButtonProps } from "@/lib/types/component-props";

// Color styles for each variant
const solidStyles = {
    primary: 'bg-primary text-white hover:bg-[#024d46] active:bg-[#013d37] border-primary shadow-sm',
    white: 'bg-primary text-white hover:bg-[#024d46] active:bg-[#013d37] border-primary shadow-sm',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800 border-gray-600 shadow-sm',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 border-green-600 shadow-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border-red-600 shadow-sm',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 border-yellow-500 shadow-sm',
    text: 'bg-transparent text-primary border-none underline hover:text-primary/80 active:text-primary/60',
};

const outlineStyles = {
    primary: 'bg-transparent text-primary border-primary hover:bg-primary hover:text-white active:bg-[#024d46]',
    white: 'bg-transparent text-primary border-primary hover:bg-primary hover:text-white active:bg-[#024d46]',
    secondary: 'bg-transparent text-gray-600 border-gray-600 hover:bg-gray-600 hover:text-white active:bg-gray-700',
    success: 'bg-transparent text-green-600 border-green-600 hover:bg-green-600 hover:text-white active:bg-green-700',
    danger: 'bg-transparent text-red-600 border-red-600 hover:bg-red-600 hover:text-white active:bg-red-700',
    warning: 'bg-transparent text-yellow-600 border-yellow-600 hover:bg-yellow-600 hover:text-white active:bg-yellow-700',
    text: 'bg-transparent text-primary border-none hover:text-primary/80 active:text-primary/60',
};

const ghostStyles = {
    primary: 'bg-transparent text-primary border-primary/30 hover:bg-primary/10 hover:border-primary active:bg-primary/20',
    secondary: 'bg-transparent text-gray-600 border-gray-600/30 hover:bg-gray-100 hover:border-gray-600 active:bg-gray-200',
    success: 'bg-transparent text-green-600 border-green-600/30 hover:bg-green-50 hover:border-green-600 active:bg-green-100',
    danger: 'bg-transparent text-red-600 border-red-600/30 hover:bg-red-50 hover:border-red-600 active:bg-red-100',
    warning: 'bg-transparent text-yellow-600 border-yellow-600/30 hover:bg-yellow-50 hover:border-yellow-600 active:bg-yellow-100',
    text: 'bg-transparent text-primary border-none hover:text-primary/80 active:text-primary/60',
    white: 'bg-transparent text-white border-white/30 hover:bg-white/10 hover:border-white active:bg-white/20',
};

// Size styles
const sizeStyles = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
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
    const baseStyles = 'rounded border transition-all duration-150 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none active:scale-[0.97]';

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