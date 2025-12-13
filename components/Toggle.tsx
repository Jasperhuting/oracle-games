import { motion } from "framer-motion";
import { useState, useRef, useCallback, useEffect } from "react";

export const Toggle = ({ toggleOn, toggleOff, status, onText, offText }: { toggleOn: () => void, toggleOff: () => void, status: boolean, onText: string, offText: string }) => {
    const [optimisticStatus, setOptimisticStatus] = useState(status);
    const [dimensions, setDimensions] = useState({ onWidth: 0, offWidth: 0, onLeft: 0, offLeft: 0 });
    const onButtonRef = useRef<HTMLButtonElement>(null);
    const offButtonRef = useRef<HTMLButtonElement>(null);

    const getButtonDimensions = useCallback(() => {
        if (onButtonRef.current && offButtonRef.current) {
            return {
                onWidth: onButtonRef.current.offsetWidth,
                offWidth: offButtonRef.current.offsetWidth,
                onLeft: 0,
                offLeft: onButtonRef.current.offsetWidth
            };
        }
        return { onWidth: 0, offWidth: 0, onLeft: 0, offLeft: 0 };
    }, []);

    // Update dimensions when buttons are mounted and when text changes
    useEffect(() => {
        const updateDimensions = () => {
            const newDimensions = getButtonDimensions();
            if (newDimensions.onWidth > 0 && newDimensions.offWidth > 0) {
                setDimensions(newDimensions);
            }
        };

        updateDimensions();
    }, [getButtonDimensions, onText, offText]);

    const handleToggleOn = () => {
        setOptimisticStatus(true);
        toggleOn();
    };

    const handleToggleOff = () => {
        setOptimisticStatus(false);
        toggleOff();
    };

    // Sync optimistic state with actual state
    if (optimisticStatus !== status) {
        setOptimisticStatus(status);
    }

    return (
        <div className="flex items-center w-fit gap-0 border bg-white border-gray-200 relative rounded-md">
            <button 
                ref={onButtonRef}
                onClick={handleToggleOn} 
                className={`${optimisticStatus ? ' text-white' : ''} p-2 z-10 rounded-l-md transition-colors duration-150 cursor-pointer whitespace-nowrap`}
            >
                {onText}
            </button>
            <button 
                ref={offButtonRef}
                onClick={handleToggleOff} 
                className={`${!optimisticStatus ? ' text-white' : ''} p-2 z-10 rounded-r-md transition-colors duration-150 cursor-pointer whitespace-nowrap`}
            >
                {offText}
            </button>
            <motion.div 
                className="bg-primary z-0 rounded-md h-full absolute top-0 bottom-0 pointer-events-none"
                initial={false}
                animate={{
                    left: optimisticStatus ? dimensions.onLeft : dimensions.offLeft,
                    width: optimisticStatus ? dimensions.onWidth : dimensions.offWidth
                }}
                transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 35,
                    mass: 0.5
                }}
            />
        </div>
    );
};