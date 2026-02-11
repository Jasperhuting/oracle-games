/**
 * Component Props Types
 * Shared prop interfaces for React components
 */

import { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

// UI Component Props
export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string | React.ReactNode;
  fullWidth?: boolean;
  endIcon?: React.ReactNode;
  startIcon?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'text' | 'white';
  outline?: boolean;
  ghost?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'text';
}

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

export interface SelectorProps<T> {
  items: T[];
  selectedItems: T[];
  setSelectedItems: (items: T[]) => void;
  multiSelect?: boolean;
  multiSelectShowSelected?: boolean;
  placeholder?: string;
  searchFilter: (item: T, searchTerm: string) => boolean;
  isEqual: (item1: T, item2: T) => boolean;
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  renderSelectedItem: (item: T, index: number, onRemove: () => void) => React.ReactNode;
  localStorageKey?: string;
  initialResultsLimit?: number;
  showSelected?: boolean;
  showCheckboxes?: boolean;
  getItemLabel?: (item: T) => string;
  sortKey?: (item: T) => string;
  showClearButton?: boolean;
  clearButtonLabel?: string;
}

export interface RowProps<T> {
  item: T;
  onSelect: (item: T) => void;
  isSelected?: boolean;
  fullWidth?: boolean;
  index?: number | boolean;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

// Tab Components
export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export interface TabGroup {
  id: string;
  label: string;
  tabs: Tab[];
}

export interface NestedTabsProps {
  groups: TabGroup[];
  defaultGroup?: string;
  defaultTab?: string;
}

// Form Props
export interface LoginFormProps {
  email: string;
  password: string;
}

export interface RegisterFormProps {
  email: string;
  password: string;
  password_confirmation: string;
  playername: string;
}

export interface ResetPasswordFormProps {
  email: string;
}

// Modal Props
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

// Other Props
export interface MountedCheckProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export interface RichTextEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
