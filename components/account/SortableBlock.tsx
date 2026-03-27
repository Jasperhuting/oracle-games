'use client'

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical, IconEye, IconEyeOff } from '@tabler/icons-react';
import { ReactNode } from 'react';

interface Props {
  id: string;
  label: string;
  editMode: boolean;
  visible: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function SortableBlock({ id, label, editMode, visible, onToggle, children }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode });

  // Hidden blocks are invisible in normal mode
  if (!editMode && !visible) return null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? 'opacity-40 z-50' : ''}
    >
      {editMode && (
        <div className="flex items-center justify-between mb-1.5 px-1">
          {/* Drag handle */}
          <button
            {...listeners}
            {...attributes}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 cursor-grab active:cursor-grabbing select-none touch-none transition-colors"
          >
            <IconGripVertical className="w-4 h-4 shrink-0" />
            <span className="font-medium">{label}</span>
          </button>

          {/* Visibility toggle */}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            title={visible ? 'Verbergen' : 'Tonen'}
          >
            {visible
              ? <IconEye className="w-4 h-4 text-gray-500" />
              : <IconEyeOff className="w-4 h-4 text-gray-300" />
            }
          </button>
        </div>
      )}

      <div className={!visible ? 'opacity-35 pointer-events-none select-none' : ''}>
        {children}
      </div>
    </div>
  );
}
