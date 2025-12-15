import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'tabler-icons-react';

interface CollapsibleProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const Collapsible = ({ title, children, defaultOpen = true, className = '' }: CollapsibleProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors"
        aria-expanded={isOpen}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        {isOpen ? (
          <ChevronUp size={20} className="text-gray-600" />
        ) : (
          <ChevronDown size={20} className="text-gray-600" />
        )}
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
};
