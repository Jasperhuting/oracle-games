'use client'

import { useState, useEffect, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

export type BlockId =
  | 'carriere'
  | 'inbox'
  | 'forum'
  | 'active-games'
  | 'available-games'
  | 'rules'
  | 'calendar';

export interface BlockConfig {
  id: BlockId;
  label: string;
  column: 'left' | 'right';
  visible: boolean;
}

export const DEFAULT_BLOCKS: BlockConfig[] = [
  { id: 'carriere',        label: 'Carrière',              column: 'left',  visible: true },
  { id: 'inbox',           label: 'Berichten',             column: 'left',  visible: true },
  { id: 'forum',           label: 'Forumactiviteit',       column: 'left',  visible: true },
  { id: 'active-games',    label: 'Actieve spellen',       column: 'right', visible: true },
  { id: 'available-games', label: 'Beschikbare spellen',   column: 'right', visible: true },
  { id: 'rules',           label: 'Spelregels',            column: 'right', visible: true },
  { id: 'calendar',        label: 'Kalender',              column: 'right', visible: true },
];

const STORAGE_KEY = 'oracle-dashboard-layout';

function mergeWithDefaults(stored: BlockConfig[]): BlockConfig[] {
  const storedIds = new Set(stored.map(b => b.id));
  const missing = DEFAULT_BLOCKS.filter(b => !storedIds.has(b.id));
  return [...stored, ...missing];
}

export function useDashboardLayout() {
  const [blocks, setBlocks] = useState<BlockConfig[]>(DEFAULT_BLOCKS);

  // Load from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: BlockConfig[] = JSON.parse(raw);
        setBlocks(mergeWithDefaults(parsed));
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const persist = useCallback((next: BlockConfig[]) => {
    setBlocks(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const toggleVisibility = useCallback((id: BlockId) => {
    setBlocks(prev => {
      const next = prev.map(b => (b.id === id ? { ...b, visible: !b.visible } : b));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** Call from onDragOver to move block between columns live */
  const moveToColumn = useCallback((activeId: BlockId, targetColumn: 'left' | 'right') => {
    setBlocks(prev => {
      const active = prev.find(b => b.id === activeId);
      if (!active || active.column === targetColumn) return prev;
      return prev.map(b => (b.id === activeId ? { ...b, column: targetColumn } : b));
    });
  }, []);

  /** Call from onDragEnd to reorder within a column and persist */
  const reorderAndPersist = useCallback((
    activeId: BlockId,
    overId: string,
    currentBlocks: BlockConfig[],
  ) => {
    const activeBlock = currentBlocks.find(b => b.id === activeId);
    if (!activeBlock) return;

    const columnBlocks = currentBlocks.filter(b => b.column === activeBlock.column);
    const oldIdx = columnBlocks.findIndex(b => b.id === activeId);
    const newIdx = columnBlocks.findIndex(b => b.id === overId);

    let next = currentBlocks;
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      const reordered = arrayMove(columnBlocks, oldIdx, newIdx);
      next = [
        ...currentBlocks.filter(b => b.column !== activeBlock.column),
        ...reordered,
      ];
    }

    persist(next);
  }, [persist]);

  return { blocks, setBlocks, toggleVisibility, moveToColumn, reorderAndPersist, persist };
}
