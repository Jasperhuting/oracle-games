/**
 * Admin & Management Types
 * Types for admin panel, scraping, and system management
 */

// Scraper Types
export interface ScraperFormData {
  race: string;
  year: number;
  type: 'startlist' | 'stage' | 'all-stages';
  stage?: number;
}

export interface ScraperFormProps {
  onSubmit?: (data: ScraperFormData) => void;
  loading?: boolean;
}

export interface ScraperJob {
  id: string;
  type: 'startlist' | 'stage-result';
  race: string;
  stage?: number;
  year?: number;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  output?: string;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface CommandButtonProps {
  label: string;
  command: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

// Translations
export interface Translation {
  [key: string]: string | Translation;
}

export interface Language {
  translations: Translation;
  locale: string;
}

export interface TranslationRow {
  key: string;
  path: string;
  enValue: string;
  depth: number;
}

export interface TranslationsTabProps {
  languages: Language[];
  isProgrammer: boolean;
  onSave: (translations: Language[]) => void;
}

// Todos
export type TodoStatus = 'todo' | 'in_progress' | 'done';

export interface AdminTodo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  category: string;
  order: number;
  createdAt: {
    toDate: () => Date;
    seconds: number;
    nanoseconds: number;
  };
  updatedAt: {
    toDate: () => Date;
    seconds: number;
    nanoseconds: number;
  };
}

export interface SortableTodoItemProps {
  id: string;
  title: string;
  status: TodoStatus;
  order: number;
}

export interface TodoDetailsModalProps {
  todoId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Page Editor
export interface Page {
  id: string;
  title: string;
  content: string;
  slug: string;
  published: boolean;
}
