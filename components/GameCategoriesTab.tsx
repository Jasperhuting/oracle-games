'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ClientGameCategory } from "@/lib/types/games";
import { Button } from "./Button";
import toast from "react-hot-toast";
import { Trash, Edit, Plus, GripVertical } from "tabler-icons-react";

export const GameCategoriesTab = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ClientGameCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/gameCategories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      } else {
        toast.error('Failed to fetch categories');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Error loading categories');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingId) {
      setFormSlug(generateSlug(name));
    }
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formSlug.trim() || !user) {
      toast.error('Name and slug are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/gameCategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          order: categories.length,
          userId: user.uid,
        }),
      });

      if (response.ok) {
        toast.success('Category created successfully');
        setFormName('');
        setFormSlug('');
        setShowAddForm(false);
        fetchCategories();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Error creating category');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formName.trim() || !formSlug.trim() || !user) {
      toast.error('Name and slug are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/gameCategories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: formName.trim(),
          slug: formSlug.trim(),
          userId: user.uid,
        }),
      });

      if (response.ok) {
        toast.success('Category updated successfully');
        setEditingId(null);
        setFormName('');
        setFormSlug('');
        fetchCategories();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update category');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Error updating category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    if (!user) return;

    try {
      const response = await fetch(`/api/gameCategories?id=${id}&userId=${user.uid}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Category deleted successfully');
        fetchCategories();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Error deleting category');
    }
  };

  const startEdit = (category: ClientGameCategory) => {
    setEditingId(category.id || null);
    setFormName(category.name);
    setFormSlug(category.slug);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormName('');
    setFormSlug('');
    setShowAddForm(false);
  };

  const moveCategory = async (id: string, direction: 'up' | 'down') => {
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    if (!user) return;

    // Swap orders
    const currentOrder = categories[index].order;
    const targetOrder = categories[newIndex].order;

    try {
      await Promise.all([
        fetch('/api/gameCategories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, order: targetOrder, userId: user.uid }),
        }),
        fetch('/api/gameCategories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: categories[newIndex].id, order: currentOrder, userId: user.uid }),
        }),
      ]);
      fetchCategories();
    } catch (error) {
      console.error('Error reordering categories:', error);
      toast.error('Error reordering categories');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Game Categories</h2>
            <p className="text-gray-600 mt-1">
              Manage categories for organizing game rules (e.g., Cycling, Formula 1, Football)
            </p>
          </div>
          {!showAddForm && !editingId && (
            <Button
              text="Add Category"
              variant="primary"
              onClick={() => setShowAddForm(true)}
            />
          )}
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingId) && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingId ? 'Edit Category' : 'Add New Category'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Cycling"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g., cycling"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                text={saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                variant="primary"
                onClick={() => editingId ? handleUpdate(editingId) : handleAdd()}
                disabled={saving}
              />
              <Button
                text="Cancel"
                variant="secondary"
                onClick={cancelEdit}
                disabled={saving}
              />
            </div>
          </div>
        )}

        {/* Categories List */}
        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No categories yet. Add your first category above.
            </div>
          ) : (
            categories.map((category, index) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveCategory(category.id!, 'up')}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <GripVertical size={16} className="rotate-90" />
                    </button>
                    <button
                      onClick={() => moveCategory(category.id!, 'down')}
                      disabled={index === categories.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <GripVertical size={16} className="rotate-90" />
                    </button>
                  </div>
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-sm text-gray-500">slug: {category.slug}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(category)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id!, category.name)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
