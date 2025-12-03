'use client'

import { useState, useEffect } from 'react';
import { RichTextEditor } from './RichTextEditor';

interface Page {
  id: string;
  title: string;
  content: string;
}

const AVAILABLE_PAGES = [
  { id: 'home', title: 'Home Page' },
  { id: 'about', title: 'About Page' },
  { id: 'rules', title: 'Rules Page' },
  { id: 'faq', title: 'FAQ Page' },
  { id: 'privacy', title: 'Privacy Policy' },
  { id: 'terms', title: 'Terms of Service' },
];

export const PageEditor = () => {
  const [selectedPageId, setSelectedPageId] = useState<string>('home');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load page content when selected page changes
  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const response = await fetch(`/api/pages/${selectedPageId}`);
        if (response.ok) {
          const data = await response.json();
          setContent(data.content || '');
        } else {
          // Page doesn't exist yet, start with empty content
          setContent('');
        }
      } catch (error) {
        console.error('Error loading page:', error);
        setMessage({ type: 'error', text: 'Failed to load page content' });
        setContent('');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [selectedPageId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/pages/${selectedPageId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          title: AVAILABLE_PAGES.find(p => p.id === selectedPageId)?.title || selectedPageId,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Page saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save page' });
      }
    } catch (error) {
      console.error('Error saving page:', error);
      setMessage({ type: 'error', text: 'Failed to save page' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-2xl font-bold mb-4">Page Editor</h2>
        <p className="text-gray-600 mb-6">
          Edit the content of various pages in the application using the rich text editor below.
        </p>

        {/* Page Selector */}
        <div className="mb-6">
          <label htmlFor="page-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Page
          </label>
          <select
            id="page-select"
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            className="w-full max-w-md px-4 py-3 pr-10 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
            }}
          >
            {AVAILABLE_PAGES.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Editor */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">
                {AVAILABLE_PAGES.find(p => p.id === selectedPageId)?.title}
              </h3>
              <RichTextEditor content={content} onChange={setContent} />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  saving
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {saving ? 'Saving...' : 'Save Page'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Preview Section */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-xl font-bold mb-4">Preview</h3>
        <div
          className="prose prose-sm sm:prose-base max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
};
