'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AdminTodo, TodoStatus } from '@/lib/types/admin';
import md5 from 'blueimp-md5';

// Get Gravatar URL using MD5 hash of email
function getGravatarUrl(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  const hash = md5(normalizedEmail);
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=48`;
}

interface KanbanCardProps {
  todo: AdminTodo;
  onCategoryChange: (id: string, category: string) => void;
  onDelete: (id: string) => void;
  onOpenDetails: (todo: AdminTodo) => void;
  categories: string[];
  isDragging?: boolean;
}

interface KanbanColumnProps {
  status: TodoStatus;
  title: string;
  todos: AdminTodo[];
  count: number;
  onCategoryChange: (id: string, category: string) => void;
  onDelete: (id: string) => void;
  onOpenDetails: (todo: AdminTodo) => void;
  categories: string[];
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
}

interface TodoDetailsModalProps {
  todo: AdminTodo;
  onClose: () => void;
  onUpdateTodo: (id: string, updates: { title?: string; description?: string; assigneeId?: string | null; assigneeName?: string | null; assigneeEmail?: string | null }) => void;
  formatCategoryName: (category: string) => string;
  adminUsers: AdminUser[];
}

const TodoDetailsModal = memo(function TodoDetailsModal({ todo, onClose, onUpdateTodo, formatCategoryName, adminUsers }: TodoDetailsModalProps) {
  const [localTitle, setLocalTitle] = useState(todo.title || '');
  const [localDescription, setLocalDescription] = useState(todo.description || '');
  const [localAssigneeId, setLocalAssigneeId] = useState(todo.assigneeId || '');
  const [isSaved, setIsSaved] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const todoIdRef = useRef(todo.id);
  const initialTodoRef = useRef(todo);

  // Only initialize once when modal mounts
  useEffect(() => {
    setLocalTitle(initialTodoRef.current.title || '');
    setLocalDescription(initialTodoRef.current.description || '');
    setLocalAssigneeId(initialTodoRef.current.assigneeId || '');
    setIsSaved(true);
    todoIdRef.current = initialTodoRef.current.id;
  }, []);

  const handleTitleChange = (value: string) => {
    setLocalTitle(value);
    setIsSaved(false);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout to save after user stops typing
    saveTimeoutRef.current = setTimeout(() => {
      onUpdateTodo(todoIdRef.current, { title: value });
      setIsSaved(true);
    }, 1000);
  };

  const handleDescriptionChange = (value: string) => {
    setLocalDescription(value);
    setIsSaved(false);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout to save after user stops typing
    saveTimeoutRef.current = setTimeout(() => {
      onUpdateTodo(todoIdRef.current, { description: value });
      setIsSaved(true);
    }, 1000);
  };

  const handleAssigneeChange = (assigneeId: string) => {
    setLocalAssigneeId(assigneeId);
    const assignee = adminUsers.find(u => u.id === assigneeId);
    onUpdateTodo(todoIdRef.current, { 
      assigneeId: assigneeId || null, 
      assigneeName: assignee?.name || null,
      assigneeEmail: assignee?.email || null
    });
  };

  const handleSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    const assignee = adminUsers.find(u => u.id === localAssigneeId);
    onUpdateTodo(todoIdRef.current, { 
      title: localTitle, 
      description: localDescription,
      assigneeId: localAssigneeId || null,
      assigneeName: assignee?.name || null,
      assigneeEmail: assignee?.email || null
    });
    setIsSaved(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-auto"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Editable Title */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Title
              </label>
              {!isSaved && (
                <span className="text-xs text-gray-500 italic">Autosaving...</span>
              )}
            </div>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Todo title..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
            />
          </div>

          {/* Editable Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={localDescription}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Add a detailed description..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px]"
            />
          </div>

          {/* Assignee Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignee
            </label>
            <select
              value={localAssigneeId}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {adminUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Category:</span>
              <span className="ml-2 text-gray-600">{formatCategoryName(todo.category)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Status:</span>
              <span className="ml-2 text-gray-600">
                {todo.status === 'todo' ? 'To Do' :
                 todo.status === 'in_progress' ? 'In Progress' : 'Done'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <span className="ml-2 text-gray-600">
                {todo.createdAt?.toDate?.() ? new Date(todo.createdAt.toDate()).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Updated:</span>
              <span className="ml-2 text-gray-600">
                {todo.updatedAt?.toDate?.() ? new Date(todo.updatedAt.toDate()).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              disabled={isSaved}
            >
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}, () => {
  // Never re-render - modal maintains its own state
  // This prevents re-renders when parent todos state changes
  return true;
});

function KanbanCard({
  todo,
  onCategoryChange,
  onDelete,
  onOpenDetails,
  categories,
  isDragging = false,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'global': 'bg-gray-100 text-gray-700',
      'auctioneer': 'bg-blue-100 text-blue-700',
      'slipstream': 'bg-green-100 text-green-700',
      'last-man-standing': 'bg-red-100 text-red-700',
      'poisoned-cup': 'bg-purple-100 text-purple-700',
      'nations-cup': 'bg-yellow-100 text-yellow-700',
      'rising-stars': 'bg-pink-100 text-pink-700',
      'country-roads': 'bg-orange-100 text-orange-700',
      'worldtour-manager': 'bg-indigo-100 text-indigo-700',
      'marginal-gains': 'bg-teal-100 text-teal-700',
      'fan-flandrien': 'bg-cyan-100 text-cyan-700',
      'giorgio-armada': 'bg-emerald-100 text-emerald-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const formatCategoryName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'global': 'Global',
      'auctioneer': 'Auctioneer',
      'slipstream': 'Slipstream',
      'last-man-standing': 'Last Man Standing',
      'poisoned-cup': 'Poisoned Cup',
      'nations-cup': 'Nations Cup',
      'rising-stars': 'Rising Stars',
      'country-roads': 'Country Roads',
      'worldtour-manager': 'WorldTour Manager',
      'marginal-gains': 'Marginal Gains',
      'fan-flandrien': 'Fan Flandrien',
      'giorgio-armada': 'Giorgio Armada',
    };
    return categoryNames[category] || category;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''
      }`}
    >
      {/* Header with drag handle and title */}
      <div className="flex items-start gap-2 mb-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mt-0.5 flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>

        {/* Title - click to open modal */}
        <div
          onClick={() => onOpenDetails(todo)}
          className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline flex-1"
        >
          {todo.title}
        </div>
      </div>

      {/* Footer: Category, Actions, and Avatar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <select
            value={todo.category}
            onChange={(e) => onCategoryChange(todo.id, e.target.value)}
            className={`text-xs px-2 py-0.5 rounded cursor-pointer border-0 flex-shrink-0 ${getCategoryColor(todo.category)}`}
          >
            {categories.map((cat: string) => (
              <option key={cat} value={cat}>
                {formatCategoryName(cat)}
              </option>
            ))}
          </select>
        </div>

        {/* Actions and Avatar */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onOpenDetails(todo)}
            className="text-gray-400 hover:text-gray-600 p-1"
            title="View details"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(todo.id)}
            className="text-gray-400 hover:text-red-500 p-1"
            title="Delete todo"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Assignee Avatar */}
          <img
            src={getGravatarUrl(todo.assigneeEmail || 'jasper.huting@gmail.com')}
            alt={todo.assigneeName || 'Jasper'}
            title={todo.assigneeName || 'Jasper Huting'}
            className="w-6 h-6 rounded-full ml-1"
          />
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  title,
  todos,
  count,
  onCategoryChange,
  onDelete,
  onOpenDetails,
  categories,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const getColumnHeaderColor = () => {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'done':
        return 'bg-green-100 text-green-700';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-gray-50 rounded-lg min-w-[280px] flex-1 ${
        isOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''
      }`}
    >
      {/* Column Header */}
      <div className={`px-3 py-2 rounded-t-lg ${getColumnHeaderColor()}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide">{title}</h3>
          <span className="bg-white/50 text-xs font-medium px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
      </div>

      {/* Cards Container */}
      <div className="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-350px)]">
        <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {todos.map((todo) => (
            <KanbanCard
              key={todo.id}
              todo={todo}
              onCategoryChange={onCategoryChange}
              onDelete={onDelete}
              onOpenDetails={onOpenDetails}
              categories={categories}
            />
          ))}
        </SortableContext>
        {todos.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Drop items here
          </div>
        )}
      </div>
    </div>
  );
}

export function TodosTab() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<AdminTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([
    'global',
    'auctioneer',
    'slipstream',
    'last-man-standing',
    'poisoned-cup',
    'nations-cup',
    'rising-stars',
    'country-roads',
    'worldtour-manager',
    'marginal-gains',
    'fan-flandrien',
    'giorgio-armada'
  ]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newTodoCategory, setNewTodoCategory] = useState('global');
  const [selectedTodo, setSelectedTodo] = useState<AdminTodo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchTodos = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/todos?userId=${user.uid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch todos');
      }
      const data = await response.json();
      setTodos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchAdminUsers = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/admin/users?userId=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setAdminUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTodos();
      fetchAdminUsers();
    }
  }, [user, fetchTodos, fetchAdminUsers]);

  useEffect(() => {
    // Extract unique categories from todos
    const uniqueCategories = Array.from(new Set(todos.map(t => t.category)));
    const allCategories = Array.from(new Set([...categories, ...uniqueCategories]));
    setCategories(allCategories);
  }, [todos]);

  const handleAddTodo = async () => {
    if (!user || !newTodoTitle.trim()) return;

    try {
      const response = await fetch('/api/admin/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          title: newTodoTitle.trim(),
          category: newTodoCategory,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create todo');
      }

      const result = await response.json();
      setTodos([...todos, result.todo]);
      setNewTodoTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create todo');
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;

    const categoryName = newCategoryName.trim().toLowerCase();
    if (!categories.includes(categoryName)) {
      setCategories([...categories, categoryName]);
    }
    setNewCategoryName('');
    setShowAddCategory(false);
  };

  const handleStatusChange = async (id: string, status: TodoStatus) => {
    if (!user) return;

    try {
      const response = await fetch('/api/admin/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          todoId: id,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update todo');
      }

      // Refetch todos to get updated timestamp
      await fetchTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo');
    }
  };

  const handleCategoryChange = async (id: string, category: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/admin/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          todoId: id,
          category,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update todo');
      }

      // Refetch todos to get updated timestamp
      await fetchTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo');
    }
  };

  const handleTitleChange = async (id: string, title: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/admin/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          todoId: id,
          title,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update todo');
      }

      // Refetch todos to get updated timestamp
      await fetchTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo');
    }
  };

  const handleOpenDetails = (todo: AdminTodo) => {
    setSelectedTodo(todo);
    setIsModalOpen(true);
  };

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTodo(null);
    // Refresh todos when modal closes to get the updated description
    fetchTodos();
  }, [fetchTodos]);

  const handleUpdateTodo = useCallback(async (id: string, updates: { title?: string; description?: string; assigneeId?: string | null; assigneeName?: string | null; assigneeEmail?: string | null }) => {
    if (!user) return;

    // Just save to API - don't update any state
    // State will be updated when modal closes

    try {
      const response = await fetch('/api/admin/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          todoId: id,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update todo');
      }

      // Don't update state here - it will be refreshed when modal closes
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo');
    }
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Are you sure you want to delete this todo?')) return;

    try {
      const response = await fetch('/api/admin/todos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          todoId: id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete todo');
      }

      setTodos(todos.filter(todo => todo.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete todo');
    }
  };

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = async (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if we're dragging over a column (status)
    const isOverColumn = ['todo', 'in_progress', 'done'].includes(overId);
    
    if (isOverColumn) {
      const activeTodo = todos.find(t => t.id === activeId);
      if (activeTodo && activeTodo.status !== overId) {
        // Update status when dragging over a different column
        setTodos(prev => prev.map(t => 
          t.id === activeId ? { ...t, status: overId as TodoStatus } : t
        ));
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || !user) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const isOverColumn = ['todo', 'in_progress', 'done'].includes(overId);
    const activeTodo = todos.find(t => t.id === activeId);

    if (!activeTodo) return;

    // Determine the new status
    let newStatus: TodoStatus = activeTodo.status;
    
    if (isOverColumn) {
      newStatus = overId as TodoStatus;
    } else {
      // Dropped on another card - get that card's status
      const overTodo = todos.find(t => t.id === overId);
      if (overTodo) {
        newStatus = overTodo.status;
      }
    }

    // If status changed, update in database
    if (newStatus !== activeTodo.status || !isOverColumn) {
      // Update local state
      const updatedTodos = todos.map(t => 
        t.id === activeId ? { ...t, status: newStatus } : t
      );
      setTodos(updatedTodos);

      // Persist to database
      try {
        await fetch('/api/admin/todos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            todoId: activeId,
            status: newStatus,
          }),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update todo status');
        fetchTodos();
      }
    }

    // Handle reordering within the same column
    if (!isOverColumn && overId !== activeId) {
      const overTodo = todos.find(t => t.id === overId);
      if (overTodo && overTodo.status === newStatus) {
        // Get todos in the same column
        const columnTodos = todos
          .filter(t => t.status === newStatus)
          .sort((a, b) => a.order - b.order);
        
        const oldIndex = columnTodos.findIndex(t => t.id === activeId);
        const newIndex = columnTodos.findIndex(t => t.id === overId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(columnTodos, oldIndex, newIndex);
          
          // Update orders
          const orderUpdates = reordered.map((t, idx) => ({
            id: t.id,
            newOrder: idx,
          }));

          // Update local state
          const updatedTodos = todos.map(t => {
            const update = orderUpdates.find(u => u.id === t.id);
            return update ? { ...t, order: update.newOrder } : t;
          });
          setTodos(updatedTodos);

          // Persist to database
          try {
            await Promise.all(
              orderUpdates.map(({ id, newOrder }) =>
                fetch('/api/admin/todos', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: user.uid,
                    todoId: id,
                    order: newOrder,
                  }),
                })
              )
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update todo order');
            fetchTodos();
          }
        }
      }
    }
  };

  const activeTodo = activeDragId ? todos.find(t => t.id === activeDragId) : null;

  // Sort todos by global order
  let filteredTodos = [...todos].sort((a, b) => a.order - b.order);

  if (selectedCategory !== 'all') {
    filteredTodos = filteredTodos.filter(todo => todo.category === selectedCategory);
  }

  if (hideDone) {
    filteredTodos = filteredTodos.filter(todo => todo.status !== 'done');
  }

  const getCategoryStats = (category: string) => {
    const categoryTodos = category === 'all'
      ? todos
      : todos.filter(t => t.category === category);

    return {
      total: categoryTodos.length,
      todo: categoryTodos.filter(t => t.status === 'todo').length,
      inProgress: categoryTodos.filter(t => t.status === 'in_progress').length,
      done: categoryTodos.filter(t => t.status === 'done').length,
    };
  };

  const formatCategoryName = useCallback((category: string) => {
    const categoryNames: { [key: string]: string } = {
      'global': 'Global',
      'auctioneer': 'Auctioneer',
      'slipstream': 'Slipstream',
      'last-man-standing': 'Last Man Standing',
      'poisoned-cup': 'Poisoned Cup',
      'nations-cup': 'Nations Cup',
      'rising-stars': 'Rising Stars',
      'country-roads': 'Country Roads',
      'worldtour-manager': 'WorldTour Manager',
      'marginal-gains': 'Marginal Gains',
      'fan-flandrien': 'Fan Flandrien',
      'giorgio-armada': 'Giorgio Armada',
    };
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Loading todos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-2xl font-bold mb-4">Admin Todo List</h2>

        {/* Category Management */}
        <div className="mb-4 flex gap-2 items-center">
          <span className="text-sm font-medium text-gray-700">Categorieën:</span>
          {showAddCategory ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCategory();
                  if (e.key === 'Escape') {
                    setNewCategoryName('');
                    setShowAddCategory(false);
                  }
                }}
                placeholder="Nieuwe categorie..."
                className="px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleAddCategory}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Toevoegen
              </button>
              <button
                onClick={() => {
                  setNewCategoryName('');
                  setShowAddCategory(false);
                }}
                className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Annuleren
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              + Nieuwe categorie
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedCategory === 'all'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Alle ({getCategoryStats('all').total})
          </button>
          {categories.map(category => {
            const stats = getCategoryStats(category);
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedCategory === category
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {formatCategoryName(category)} ({stats.total})
              </button>
            );
          })}
        </div>

        {/* Add Todo */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTodo();
            }}
            placeholder="Add a new todo..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newTodoCategory}
            onChange={(e) => setNewTodoCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{formatCategoryName(cat)}</option>
            ))}
          </select>
          <button
            onClick={handleAddTodo}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="hideDone"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="hideDone" className="text-sm text-gray-700">
            Hide completed todos
          </label>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-6 text-sm">
          <span className="text-gray-600">
            Total: <strong>{getCategoryStats(selectedCategory).total}</strong>
          </span>
          <span className="text-gray-600">
            To Do: <strong>{getCategoryStats(selectedCategory).todo}</strong>
          </span>
          <span className="text-blue-600">
            In Progress: <strong>{getCategoryStats(selectedCategory).inProgress}</strong>
          </span>
          <span className="text-green-600">
            Done: <strong>{getCategoryStats(selectedCategory).done}</strong>
          </span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            <KanbanColumn
              status="todo"
              title="TO DO"
              todos={filteredTodos.filter(t => t.status === 'todo')}
              count={filteredTodos.filter(t => t.status === 'todo').length}
              onCategoryChange={handleCategoryChange}
              onDelete={handleDelete}
              onOpenDetails={handleOpenDetails}
              categories={categories}
            />
            <KanbanColumn
              status="in_progress"
              title="IN PROGRESS"
              todos={filteredTodos.filter(t => t.status === 'in_progress')}
              count={filteredTodos.filter(t => t.status === 'in_progress').length}
              onCategoryChange={handleCategoryChange}
              onDelete={handleDelete}
              onOpenDetails={handleOpenDetails}
              categories={categories}
            />
            {!hideDone && (
              <KanbanColumn
                status="done"
                title="DONE"
                todos={filteredTodos.filter(t => t.status === 'done')}
                count={filteredTodos.filter(t => t.status === 'done').length}
                onCategoryChange={handleCategoryChange}
                onDelete={handleDelete}
                onOpenDetails={handleOpenDetails}
                categories={categories}
              />
            )}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeTodo ? (
              <div className="bg-white rounded-lg shadow-lg border-2 border-blue-400 p-3 w-[280px] opacity-90">
                <div className="text-sm font-medium text-gray-900">{activeTodo.title}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {filteredTodos.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No todos yet. Add one above to get started.
          </div>
        )}
      </div>

      {/* Todo Details Modal */}
      {isModalOpen && selectedTodo && (
        <TodoDetailsModal
          todo={selectedTodo}
          onClose={handleCloseModal}
          onUpdateTodo={handleUpdateTodo}
          formatCategoryName={formatCategoryName}
          adminUsers={adminUsers}
        />
      )}
    </div>
  );
}
