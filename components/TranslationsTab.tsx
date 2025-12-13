'use client';

import { useEffect, useState, useCallback } from 'react';
import { getFirestore, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { useTranslation, Trans } from 'react-i18next';
import toast from 'react-hot-toast';

interface Translation {
  [key: string]: string | Translation;
}

interface Language {
  locale: string;
  translations: Translation;
}

interface TranslationRow {
  key: string;
  path: string;
  enValue: string;
  depth: number;
}

interface TranslationsTabProps {
  isProgrammer?: boolean;
}

export function TranslationsTab({ isProgrammer = false }: TranslationsTabProps) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [enTranslations, setEnTranslations] = useState<Translation>({});
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['nl']);
  const [translationsMap, setTranslationsMap] = useState<Map<string, Translation>>(new Map());
  const [newLocale, setNewLocale] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingLanguage, setAddingLanguage] = useState(false);
  const [newKeyPath, setNewKeyPath] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [addingKey, setAddingKey] = useState(false);
  const [translatingKeys, setTranslatingKeys] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const { t } = useTranslation();

  const setupRealtimeListener = useCallback(() => {
    const db = getFirestore(getApp());
    const unsubscribes: (() => void)[] = [];
    const processedLocales = new Set<string>();

    // Functie om een listener voor een specifieke taal toe te voegen
    const setupLanguageListener = (locale: string) => {
      // Voorkom dubbele listeners voor dezelfde taal
      if (processedLocales.has(locale)) return;
      processedLocales.add(locale);

      const docRef = doc(db, 'translations', locale);

      const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data() as Translation;

          // Update de vertalingen voor deze specifieke taal
          setTranslationsMap(prev => {
            const newMap = new Map(prev);
            const currentData = newMap.get(locale);

            // Only update if data actually changed (deep comparison on stringified version)
            if (JSON.stringify(currentData) !== JSON.stringify(data)) {
              newMap.set(locale, data);
              return newMap;
            }
            return prev;
          });

          // Update de languages state zonder de hele lijst opnieuw te maken
          setLanguages(prevLanguages => {
            const langExists = prevLanguages.some(lang => lang.locale === locale);
            if (!langExists) {
              return [...prevLanguages, { locale, translations: data }];
            }
            return prevLanguages.map(lang => {
              if (lang.locale === locale) {
                // Only update if data actually changed
                if (JSON.stringify(lang.translations) !== JSON.stringify(data)) {
                  return { ...lang, translations: data };
                }
              }
              return lang;
            });
          });

          // Als het Engels is, update ook de enTranslations
          if (locale === 'en') {
            setEnTranslations(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(data)) {
                return data;
              }
              return prev;
            });
          }
        }
      }, (error) => {
        console.error(`Error listening to ${locale} translations:`, error);
      });

      return unsubscribe;
    };

    // Luister naar alle bestaande talen uit de huidige state
    const localesToListen = new Set([...languages.map(lang => lang.locale), 'en']);
    localesToListen.forEach(locale => {
      const unsubscribe = setupLanguageListener(locale);
      if (unsubscribe) {
        unsubscribes.push(unsubscribe);
      }
    });

    // Return een cleanup functie die alle listeners opruimt
    return () => {
      unsubscribes.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      processedLocales.clear();
    };
  }, []); // Verwijder de dependency op languages om de oneindige lus te voorkomen

  const loadLanguages = useCallback(async () => {
    try {
      const response = await fetch('/api/translations');
      if (response.ok) {
        const data = await response.json();
        
        // Update de vertalingen in de map
        const newTranslationsMap = new Map<string, Translation>();
        data.languages.forEach((lang: Language) => {
          newTranslationsMap.set(lang.locale, lang.translations);
          
          // Sla Engels apart op voor referentie
          if (lang.locale === 'en') {
            setEnTranslations(lang.translations);
          }
        });
        
        setTranslationsMap(newTranslationsMap);
        setLanguages(data.languages);
      }
    } catch (error) {
      console.error('Error loading languages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Set up real-time listener for translations
    const unsubscribe = setupRealtimeListener();
    
    // Initial load of languages
    loadLanguages();
    
    // Clean up the listener when the component unmounts
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadLanguages, setupRealtimeListener]);

  const handleAddLanguage = async () => {
    if (!newLocale.trim()) return;

    // Prevent adding 'en' as it's the reference language
    if (newLocale.toLowerCase() === 'en') {
      toast.error('English cannot be added as a translation language. It is the reference language.');
      return;
    }

    try {
      setAddingLanguage(true);
      const response = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale, translations: {} }),
      });

      if (response.ok) {
        setNewLocale('');
        await loadLanguages();
        toast.success(`Language ${newLocale} added successfully!`);
      } else {
        toast.error('Failed to add language');
      }
    } catch (error) {
      console.error('Error adding language:', error);
      toast.error('Error adding language');
    } finally {
      setAddingLanguage(false);
    }
  };

  const handleToggleLanguage = async (locale: string) => {
    if (selectedLanguages.includes(locale)) {
      // Remove language
      setSelectedLanguages(selectedLanguages.filter(l => l !== locale));
      const newMap = new Map(translationsMap);
      newMap.delete(locale);
      setTranslationsMap(newMap);
    } else {
      // Add language
      const language = languages.find(l => l.locale === locale);
      if (language) {
        setSelectedLanguages([...selectedLanguages, locale]);
        const newMap = new Map(translationsMap);
        newMap.set(locale, language.translations);
        setTranslationsMap(newMap);
      }
    }
  };

  const flattenTranslations = (obj: Translation, prefix = '', depth = 0): TranslationRow[] => {
    const rows: TranslationRow[] = [];

    Object.entries(obj).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        rows.push({
          key,
          path,
          enValue: '', // Section header
          depth,
        });
        rows.push(...flattenTranslations(value as Translation, path, depth + 1));
      } else {
        rows.push({
          key,
          path,
          enValue: value as string,
          depth,
        });
      }
    });

    return rows;
  };

  const getTranslationValue = (locale: string, path: string): string => {
    const translations = translationsMap.get(locale);
    if (!translations) return '';

    const keys = path.split('.');
    let current: any = translations;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return '';
      }
    }

    return typeof current === 'string' ? current : '';
  };

  const handleUpdateTranslation = (locale: string, path: string, value: string) => {
    const translations = translationsMap.get(locale);
    if (!translations) return;

    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(translations));

    let current: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    // If value is empty, delete the key instead of setting it to empty string
    if (value.trim() === '') {
      delete current[keys[keys.length - 1]];
    } else {
      current[keys[keys.length - 1]] = value;
    }

    const newMap = new Map(translationsMap);
    newMap.set(locale, updated);
    setTranslationsMap(newMap);
  };

  const handleSaveTranslation = async (locale: string) => {
    try {
      const translations = translationsMap.get(locale);
      if (!translations) return;

      // Clean up empty strings from translations before saving
      const cleanTranslations = (obj: Translation): Translation => {
        const cleaned: Translation = {};

        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            const cleanedNested = cleanTranslations(value as Translation);
            // Only include nested object if it has content
            if (Object.keys(cleanedNested).length > 0) {
              cleaned[key] = cleanedNested;
            }
          } else if (typeof value === 'string' && value.trim() !== '') {
            // Only include non-empty strings
            cleaned[key] = value;
          }
        });

        return cleaned;
      };

      const cleanedTranslations = cleanTranslations(translations);

      const db = getFirestore(getApp());
      await setDoc(doc(db, 'translations', locale), cleanedTranslations, { merge: true });

      // Update the local state immediately for better UX
      setLanguages(prevLanguages => {
        const updated = [...prevLanguages];
        const langIndex = updated.findIndex(lang => lang.locale === locale);
        if (langIndex >= 0) {
          updated[langIndex] = { locale, translations: cleanedTranslations };
        } else {
          updated.push({ locale, translations: cleanedTranslations });
        }
        return updated;
      });

      // Also update the translationsMap with the cleaned version
      const newMap = new Map(translationsMap);
      newMap.set(locale, cleanedTranslations);
      setTranslationsMap(newMap);
    } catch (error) {
      console.error('Error saving translation:', error);
    }
  };

  const handleAddNewKey = async () => {
    if (!newKeyPath.trim() || !newKeyValue.trim()) {
      toast.error('Please provide both key path and English value');
      return;
    }

    try {
      setAddingKey(true);

      // Add to English translations
      const keys = newKeyPath.split('.');
      const updated = JSON.parse(JSON.stringify(enTranslations));

      let current: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = newKeyValue;

      // Save to Firestore
      const db = getFirestore(getApp());
      await setDoc(doc(db, 'translations', 'en'), updated, { merge: true });

      // Update local state
      setEnTranslations(updated);
      setNewKeyPath('');
      setNewKeyValue('');

      toast.success('New translation key added successfully!');
    } catch (error) {
      console.error('Error adding new key:', error);
      toast.error('Failed to add new key. Please try again.');
    } finally {
      setAddingKey(false);
    }
  };

  const handleDeleteKey = async (path: string) => {
    if (!confirm(`Are you sure you want to delete the key "${path}"? This will remove it from ALL languages.`)) {
      return;
    }

    try {
      const db = getFirestore(getApp());

      // Delete from all languages
      const allLocales = ['en', ...languages.map(lang => lang.locale)];

      for (const locale of allLocales) {
        const translations = locale === 'en' ? enTranslations : translationsMap.get(locale);
        if (!translations) continue;

        const keys = path.split('.');
        const updated = JSON.parse(JSON.stringify(translations));

        // Navigate to the parent object and delete the key
        let current: any = updated;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) break;
          current = current[keys[i]];
        }

        if (current && keys[keys.length - 1] in current) {
          delete current[keys[keys.length - 1]];

          // Save to Firestore
          await setDoc(doc(db, 'translations', locale), updated);

          // Update local state
          if (locale === 'en') {
            setEnTranslations(updated);
          } else {
            const newMap = new Map(translationsMap);
            newMap.set(locale, updated);
            setTranslationsMap(newMap);
          }
        }
      }

      toast.success('Translation key deleted successfully from all languages!');
    } catch (error) {
      console.error('Error deleting key:', error);
      toast.error('Failed to delete key. Please try again.');
    }
  };

  const handleTranslateKey = async (locale: string, path: string, englishValue: string) => {
    const keyId = `${locale}-${path}`;
    setTranslatingKeys(prev => new Set(prev).add(keyId));

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: englishValue,
          targetLanguage: locale,
          sourceLanguage: 'en',
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const { translatedText } = await response.json();

      // Get current translations from the map
      const translations = translationsMap.get(locale);
      if (!translations) return;

      // Create updated translation object
      const keys = path.split('.');
      const updated = JSON.parse(JSON.stringify(translations));

      let current: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = translatedText;

      // Update local state immediately for responsive UI
      const newMap = new Map(translationsMap);
      newMap.set(locale, updated);
      setTranslationsMap(newMap);

      // Save to Firestore
      const db = getFirestore(getApp());
      await setDoc(doc(db, 'translations', locale), updated, { merge: true });

      toast.success('Translation completed!');
    } catch (error) {
      console.error('Error translating:', error);
      toast.error('Failed to translate. Please try again.');
    } finally {
      setTranslatingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(keyId);
        return newSet;
      });
    }
  };

  const toggleSection = (path: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const isPathUnderCollapsedSection = (path: string, collapsedSections: Set<string>): boolean => {
    for (const collapsedPath of collapsedSections) {
      if (path.startsWith(collapsedPath + '.')) {
        return true;
      }
    }
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading translations...</div>
      </div>
    );
  }

  const rows = flattenTranslations(enTranslations);
  const availableLanguages = languages.filter(l => l.locale !== 'en');

  return (
    <div className="space-y-6">
      {/* Add new language */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Add New Language</h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Language code (e.g., nl, fr, de)"
            value={newLocale}
            onChange={(e) => setNewLocale(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={handleAddLanguage}
            disabled={addingLanguage || !newLocale.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {addingLanguage ? 'Adding...' : 'Add Language'}
          </button>
        </div>
      </div>

      {/* Add new translation key - Only for programmers */}
      {isProgrammer && (
        <div className="bg-amber-50 p-6 rounded-lg border-2 border-amber-300">
          <h2 className="text-xl font-semibold mb-2 text-amber-900">Add New Translation Key (Programmer Only)</h2>
          <p className="text-sm text-amber-700 mb-4">
            Add a new translation key to the English (reference) translations. Use dot notation for nested keys (e.g., "admin.tabs.newTab")
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key Path (e.g., "admin.tabs.newFeature")
              </label>
              <input
                type="text"
                placeholder="e.g., admin.tabs.newFeature"
                value={newKeyPath}
                onChange={(e) => setNewKeyPath(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                English Value
              </label>
              <input
                type="text"
                placeholder="e.g., New Feature"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              onClick={handleAddNewKey}
              disabled={addingKey || !newKeyPath.trim() || !newKeyValue.trim()}
              className="px-6 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
            >
              {addingKey ? 'Adding Key...' : 'Add Translation Key'}
            </button>
          </div>
        </div>
      )}

      {/* Language selector (checkboxes) */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Select Languages to Translate</h2>
        <div className="flex flex-wrap gap-4">
          {availableLanguages.map((lang) => (
            <label key={lang.locale} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedLanguages.includes(lang.locale)}
                onChange={() => handleToggleLanguage(lang.locale)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">{lang.locale}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Translation editor */}
      {selectedLanguages.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              Translations
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Changes are saved automatically when you leave an input field
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-4 font-semibold bg-gray-50">Key</th>
                  <th className="text-left py-3 px-4 font-semibold bg-blue-50 min-w-[300px]">
                    English (reference)
                  </th>
                  {selectedLanguages.map(locale => (
                    <th key={locale} className="text-left py-3 px-4 font-semibold bg-green-50 min-w-[300px]">
                      {locale}
                    </th>
                  ))}
                  {isProgrammer && (
                    <th className="text-left py-3 px-4 font-semibold bg-red-50 w-[100px]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isSection = row.enValue === '';
                  const isCollapsed = collapsedSections.has(row.path);
                  const isHidden = isPathUnderCollapsedSection(row.path, collapsedSections);

                  // Skip rendering if this row is under a collapsed section
                  if (isHidden) {
                    return null;
                  }

                  if (isSection) {
                    return (
                      <tr key={row.path} className="border-t-2 border-gray-400 bg-gray-100">
                        <td
                          colSpan={2 + selectedLanguages.length + (isProgrammer ? 1 : 0)}
                          className="py-3 px-4 font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                          style={{ paddingLeft: `${row.depth * 20 + 16}px` }}
                          onClick={() => toggleSection(row.path)}
                          title="Click to expand/collapse"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="text-gray-500 text-lg">
                              {isCollapsed ? '▶' : '▼'}
                            </span>
                            {row.key}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.path} className="border-b border-gray-200 hover:bg-gray-50">
                      <td
                        className="py-3 px-4 text-sm text-gray-600 align-top"
                        style={{ paddingLeft: `${row.depth * 20 + 16}px` }}
                      >
                        {row.key}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="text-sm text-gray-900 bg-blue-50 p-2 rounded border border-blue-200">
                          {row.enValue}
                        </div>
                      </td>
                      {selectedLanguages.map(locale => {
                        const keyId = `${locale}-${row.path}`;
                        const isTranslating = translatingKeys.has(keyId);

                        return (
                          <td key={locale} className="py-3 px-4 align-top">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={getTranslationValue(locale, row.path)}
                                onChange={(e) => handleUpdateTranslation(locale, row.path, e.target.value)}
                                onBlur={() => handleSaveTranslation(locale)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder={`Translate from: ${row.enValue}`}
                                disabled={isTranslating}
                              />
                              <button
                                onClick={() => handleTranslateKey(locale, row.path, row.enValue)}
                                disabled={isTranslating || !row.enValue}
                                className="px-3 py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                title="Auto-translate with OpenAI"
                              >
                                {isTranslating ? '...' : 'AI'}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      {isProgrammer && (
                        <td className="py-3 px-4 align-top">
                          <button
                            onClick={() => handleDeleteKey(row.path)}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                            title={`Delete key: ${row.path}`}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
