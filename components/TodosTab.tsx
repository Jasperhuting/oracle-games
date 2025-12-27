'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AdminTodo } from '@/app/api/admin/todos/route';

type TodoStatus = 'todo' | 'in_progress' | 'done';

interface SortableTodoItemProps {
  todo: AdminTodo;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onCategoryChange: (id: string, category: string) => void;
  onDelete: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onOpenDetails: (todo: AdminTodo) => void;
  categories: string[];
}

interface TodoDetailsModalProps {
  todo: AdminTodo;
  onClose: () => void;
  onUpdateDescription: (id: string, description: string) => void;
  formatCategoryName: (category: string) => string;
}

function TodoDetailsModal({ todo, onClose, onUpdateDescription, formatCategoryName }: TodoDetailsModalProps) {
  const [localDescription, setLocalDescription] = useState(todo.description || '');

  // Update local state when todo changes
  useEffect(() => {
    setLocalDescription(todo.description || '');
  }, [todo.description]);

  const handleDescriptionChange = (value: string) => {
    setLocalDescription(value);
    onUpdateDescription(todo.id, value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold">{todo.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
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
                {new Date(todo.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Updated:</span>
              <span className="ml-2 text-gray-600">
                {new Date(todo.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
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
}

function SortableTodoItem({
  todo,
  onStatusChange,
  onCategoryChange,
  onDelete,
  onTitleChange,
  onOpenDetails,
  categories
}: SortableTodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== todo.title) {
      onTitleChange(todo.id, editTitle.trim());
    } else {
      setEditTitle(todo.title);
    }
    setIsEditing(false);
  };

  const getStatusColor = (status: TodoStatus) => {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 bg-white border rounded-lg ${
        todo.status === 'done' ? 'opacity-60' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </div>

      {/* Todo Content */}
      <div className="flex-1 flex items-center gap-3">
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle();
              if (e.key === 'Escape') {
                setEditTitle(todo.title);
                setIsEditing(false);
              }
            }}
            className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <div
              onClick={() => setIsEditing(true)}
              className={`flex-1 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded ${
                todo.status === 'done' ? 'line-through' : ''
              }`}
            >
              {todo.title}
            </div>
            <button
              onClick={() => onOpenDetails(todo)}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="View details"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Category Selector */}
        <select
          value={todo.category}
          onChange={(e) => onCategoryChange(todo.id, e.target.value)}
          className="px-3 py-1 rounded border text-sm bg-purple-50 text-purple-800 border-purple-200"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'global' ? 'Global' :
               cat === 'auctioneer' ? 'Auctioneer' :
               cat === 'slipstream' ? 'Slipstream' :
               cat === 'last-man-standing' ? 'Last Man Standing' :
               cat === 'poisoned-cup' ? 'Poisoned Cup' :
               cat === 'nations-cup' ? 'Nations Cup' :
               cat === 'rising-stars' ? 'Rising Stars' :
               cat === 'country-roads' ? 'Country Roads' :
               cat === 'worldtour-manager' ? 'WorldTour Manager' :
               cat === 'marginal-gains' ? 'Marginal Gains' :
               cat === 'fan-flandrien' ? 'Fan Flandrien' :
               cat === 'giorgio-armada' ? 'Giorgio Armada' :
               cat}
            </option>
          ))}
        </select>

        {/* Status Selector */}
        <select
          value={todo.status}
          onChange={(e) => onStatusChange(todo.id, e.target.value as TodoStatus)}
          className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(todo.status)}`}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(todo.id)}
          className="text-red-500 hover:text-red-700 p-1"
          title="Delete todo"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user) {
      fetchTodos();
    }
  }, [user]);

  useEffect(() => {
    // Extract unique categories from todos
    const uniqueCategories = Array.from(new Set(todos.map(t => t.category)));
    const allCategories = Array.from(new Set([...categories, ...uniqueCategories]));
    setCategories(allCategories);
  }, [todos]);

  const fetchTodos = async () => {
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
  };

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

      setTodos(todos.map(todo =>
        todo.id === id
          ? { ...todo, status, updatedAt: new Date().toISOString() }
          : todo
      ));
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

      setTodos(todos.map(todo =>
        todo.id === id
          ? { ...todo, category, updatedAt: new Date().toISOString() }
          : todo
      ));
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

      setTodos(todos.map(todo =>
        todo.id === id
          ? { ...todo, title, updatedAt: new Date().toISOString() }
          : todo
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo');
    }
  };

  const handleOpenDetails = (todo: AdminTodo) => {
    setSelectedTodo(todo);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTodo(null);
  };

  const descriptionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateDescription = useCallback(async (id: string, description: string) => {
    if (!user) return;

    // Clear any existing timeout
    if (descriptionUpdateTimeoutRef.current) {
      clearTimeout(descriptionUpdateTimeoutRef.current);
    }

    // Debounce the API call
    descriptionUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/admin/todos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            todoId: id,
            description,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update todo');
        }

        setTodos(prevTodos => prevTodos.map(todo =>
          todo.id === id
            ? { ...todo, description, updatedAt: new Date().toISOString() }
            : todo
        ));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update todo');
      }
    }, 500); // Wait 500ms after user stops typing
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !user) {
      return;
    }

    // Get the current view's todos (what the user sees on screen)
    // Sort by global order only
    let visibleTodos = [...todos].sort((a, b) => a.order - b.order);

    // Apply the same filters as the display
    if (selectedCategory !== 'all') {
      visibleTodos = visibleTodos.filter(todo => todo.category === selectedCategory);
    }
    if (hideDone) {
      visibleTodos = visibleTodos.filter(todo => todo.status !== 'done');
    }

    // Find positions in the visible list
    const oldIndex = visibleTodos.findIndex(t => t.id === active.id);
    const newIndex = visibleTodos.findIndex(t => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder within the visible list
    const reorderedVisible = arrayMove(visibleTodos, oldIndex, newIndex);

    // Build a map of all todos with their new order
    // Start by getting all todos sorted by current order
    const allTodosSorted = [...todos].sort((a, b) => a.order - b.order);
    const newOrderMap = new Map<string, number>();
    const changedTodos: { id: string; newOrder: number }[] = [];

    // Assign order values based on the reordered visible list and keeping invisible todos in place
    let orderCounter = 0;
    let visibleIndex = 0;

    for (const todo of allTodosSorted) {
      // Check if this todo is in the visible list
      const indexInVisible = visibleTodos.findIndex(t => t.id === todo.id);

      if (indexInVisible !== -1) {
        // This todo is visible, use its position in the reordered list
        const newOrder = orderCounter;
        newOrderMap.set(reorderedVisible[visibleIndex].id, newOrder);

        if (reorderedVisible[visibleIndex].order !== newOrder) {
          changedTodos.push({ id: reorderedVisible[visibleIndex].id, newOrder });
        }

        visibleIndex++;
        orderCounter++;
      } else {
        // This todo is not visible (filtered out), keep its relative position
        newOrderMap.set(todo.id, orderCounter);
        if (todo.order !== orderCounter) {
          changedTodos.push({ id: todo.id, newOrder: orderCounter });
        }
        orderCounter++;
      }
    }

    // Update all todos with new order values (keep category unchanged)
    const updatedTodos = todos.map(todo => {
      const newOrder = newOrderMap.get(todo.id);
      if (newOrder !== undefined) {
        return { ...todo, order: newOrder };
      }
      return todo;
    });

    // Optimistically update UI
    setTodos(updatedTodos);

    // Update changed todos in database
    try {
      await Promise.all(
        changedTodos.map(async ({ id, newOrder }) => {
          await fetch('/api/admin/todos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              todoId: id,
              order: newOrder,
            }),
          });
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo order');
      // Revert on error
      fetchTodos();
    }
  };

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
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

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

        {/* Todo List */}
        {filteredTodos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {hideDone && todos.length > 0
              ? 'All todos are completed! 🎉'
              : 'No todos yet. Add one above to get started.'}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredTodos.map(todo => todo.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {filteredTodos.map((todo) => (
                  <SortableTodoItem
                    key={todo.id}
                    todo={todo}
                    onStatusChange={handleStatusChange}
                    onCategoryChange={handleCategoryChange}
                    onDelete={handleDelete}
                    onTitleChange={handleTitleChange}
                    onOpenDetails={handleOpenDetails}
                    categories={categories}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Todo Details Modal */}
      {isModalOpen && selectedTodo && (
        <TodoDetailsModal
          todo={selectedTodo}
          onClose={handleCloseModal}
          onUpdateDescription={handleUpdateDescription}
          formatCategoryName={formatCategoryName}
        />
      )}
    </div>
  );
}
