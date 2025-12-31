'use client';

import { JSX, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Translation, Language } from '@/lib/types/admin';

export default function TranslationsAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLocale, setSelectedLocale] = useState<string>('');
  const [translations, setTranslations] = useState<Translation>({});
  const [newLocale, setNewLocale] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const response = await fetch(`/api/getUser?userId=${user.uid}`);
        if (response.ok) {
          const userData = await response.json();
          if (userData.userType === 'admin') {
            setIsAdmin(true);
            loadLanguages();
          } else {
            router.push('/home');
          }
        }
      }
    };
    if (user) {
      checkAdmin();
    }
  }, [user, router]);

  const loadLanguages = async () => {
    try {
      const response = await fetch('/api/translations');
      if (response.ok) {
        const data = await response.json();
        setLanguages(data.languages);
        if (data.languages.length > 0) {
          setSelectedLocale(data.languages[0].locale);
          setTranslations(data.languages[0].translations);
        }
      }
    } catch (error) {
      console.error('Error loading languages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocaleChange = (locale: string) => {
    const language = languages.find(l => l.locale === locale);
    if (language) {
      setSelectedLocale(locale);
      setTranslations(language.translations);
    }
  };

  const handleAddLanguage = async () => {
    if (!newLocale.trim()) return;

    try {
      setSaving(true);
      const response = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale, translations: {} }),
      });

      if (response.ok) {
        setNewLocale('');
        await loadLanguages();
      }
    } catch (error) {
      console.error('Error adding language:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTranslation = (path: string, value: string) => {
    const keys = path.split('.');
    const updated = { ...translations };

    let current: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setTranslations(updated);
  };

  const handleSaveTranslations = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/translations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: selectedLocale, translations }),
      });

      if (response.ok) {
        alert('Translations saved successfully!');
      }
    } catch (error) {
      console.error('Error saving translations:', error);
      alert('Error saving translations');
    } finally {
      setSaving(false);
    }
  };

  const renderTranslationInputs = (obj: Translation, path = ''): JSX.Element[] => {
    const elements: JSX.Element[] = [];

    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = path ? `${path}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        elements.push(
          <div key={fullPath} className="ml-4 mt-2">
            <h3 className="font-semibold text-gray-700">{key}</h3>
            {renderTranslationInputs(value as Translation, fullPath)}
          </div>
        );
      } else {
        elements.push(
          <div key={fullPath} className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {fullPath}
            </label>
            <input
              type="text"
              value={value as string}
              onChange={(e) => handleUpdateTranslation(fullPath, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        );
      }
    });

    return elements;
  };

  if (!isAdmin || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 mt-[36px]">
      <h1 className="text-3xl font-bold mb-6">Translations Management</h1>

      {/* Add new language */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Add New Language</h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Language code (e.g., nl-NL)"
            value={newLocale}
            onChange={(e) => setNewLocale(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={handleAddLanguage}
            disabled={saving || !newLocale.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Add Language
          </button>
        </div>
      </div>

      {/* Language selector */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Select Language</h2>
        <select
          value={selectedLocale}
          onChange={(e) => handleLocaleChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          {languages.map((lang) => (
            <option key={lang.locale} value={lang.locale}>
              {lang.locale}
            </option>
          ))}
        </select>
      </div>

      {/* Translation editor */}
      {selectedLocale && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Edit Translations - {selectedLocale}
            </h2>
            <button
              onClick={handleSaveTranslations}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Translations'}
            </button>
          </div>

          <div className="space-y-4">
            {Object.keys(translations).length > 0 ? (
              renderTranslationInputs(translations)
            ) : (
              <p className="text-gray-500">No translations yet. Start adding some!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
