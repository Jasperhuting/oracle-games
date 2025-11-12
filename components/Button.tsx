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
    [key: string]: any;
}

export const Button = ({ text, fullWidth, endIcon, startIcon, selected, className, disabled, ...props }: ButtonProps) => {
    return <button className={cn(`bg-primary ${fullWidth ? 'w-full' : 'w-fit'} cursor-pointer rounded-sm text-white text-left text-sm px-3 py-2 flex items-center justify-between hover:bg-white hover:text-primary border-primary border hover:border hover:border-primary transition-colors ${selected ? 'bg-white text-primary border border-primary' : ''} ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-primary hover:text-white' : ''}`, className)} disabled={disabled} {...props}>
        {startIcon && <span className="mr-2">{startIcon}</span>}
        {text && <span className={`${selected ? 'text-primary' : ''}`}>{text}</span>}
        {endIcon && <span className={`${text ? 'ml-2' : ''} ${selected ? 'text-primary' : ''}`}>{endIcon}</span>}
    </button>
}