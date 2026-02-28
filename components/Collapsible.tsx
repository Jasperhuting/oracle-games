import { useState } from 'react';
import { ChevronDown } from 'tabler-icons-react';
import { CollapsibleProps } from '@/lib/types/component-props';

export const Collapsible = ({ title, children, defaultOpen = true, className = '' }: CollapsibleProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-md transition-all duration-150 select-none group"
        aria-expanded={isOpen}
      >
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <span className={`text-gray-400 transition-transform duration-200 group-hover:text-gray-600 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <ChevronDown size={20} />
        </span>
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
};
