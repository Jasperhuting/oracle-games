interface RowProps<T> {
    item: T;
    onSelect: (item: T) => void;
    isSelected?: boolean;
    fullWidth?: boolean;
    index?: number | boolean;
    children: React.ReactNode;
    rightContent?: React.ReactNode;
}

export function Row<T>({ 
    item, 
    onSelect, 
    isSelected = false, 
    fullWidth = false, 
    index,
    children,
    rightContent
}: RowProps<T>) {
    const getBackgroundClass = () => {
        if (typeof index === 'number') {
            return index % 2 === 0 ? 'bg-gray-100 hover:bg-gray-100' : 'hover:bg-gray-100';
        }
        return '';
    };

    return (
        <div 
            className={`flex items-center ${rightContent ? 'justify-between' : ''} gap-2 cursor-pointer ${getBackgroundClass()} p-2 ${fullWidth ? 'w-full' : 'w-fit'}`}
            onMouseDown={() => onSelect(item)}
        >
            <div className="flex items-center gap-2">
                {children}
            </div>
            {rightContent && (
                <div className="flex items-center gap-2">
                    {rightContent}
                </div>
            )}
        </div>
    );
}
