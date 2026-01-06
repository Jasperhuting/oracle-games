'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { EmailTemplate, EmailTemplateType } from '@/lib/types/admin';

const TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  birthday: 'Verjaardagsmail',
  message_single: 'Nieuw bericht (enkelvoud)',
  message_multiple: 'Nieuwe berichten (meervoud)',
  budget_reminder: 'Budget herinnering',
};

export function EmailTemplatesTab() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string>('nl');
  const [availableLocales, setAvailableLocales] = useState<string[]>(['nl']);
  const [newLocale, setNewLocale] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/email-templates?userId=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);

        // Collect all available locales from all templates
        const locales = new Set<string>();
        data.templates.forEach((t: EmailTemplate) => {
          Object.keys(t.translations).forEach((locale) => locales.add(locale));
        });
        setAvailableLocales(Array.from(locales).sort());

        // Select first template by default
        if (data.templates.length > 0) {
          selectTemplate(data.templates[0]);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    const translation = template.translations[selectedLocale] || { subject: '', body: '' };
    setEditedSubject(translation.subject);
    setEditedBody(translation.body);
  };

  const handleLocaleChange = (locale: string) => {
    setSelectedLocale(locale);
    if (selectedTemplate) {
      const translation = selectedTemplate.translations[locale] || { subject: '', body: '' };
      setEditedSubject(translation.subject);
      setEditedBody(translation.body);
    }
  };

  const handleAddLocale = () => {
    if (!newLocale.trim() || availableLocales.includes(newLocale.trim())) return;
    const locale = newLocale.trim().toLowerCase();
    setAvailableLocales([...availableLocales, locale].sort());
    setNewLocale('');
    setSelectedLocale(locale);
    setEditedSubject('');
    setEditedBody('');
  };

  const handleSave = async () => {
    if (!selectedTemplate || !user) return;

    setSaving(true);
    try {
      const updatedTranslations = {
        ...selectedTemplate.translations,
        [selectedLocale]: {
          subject: editedSubject,
          body: editedBody,
        },
      };

      const response = await fetch(`/api/email-templates?userId=${user.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedTemplate.type,
          translations: updatedTranslations,
        }),
      });

      if (response.ok) {
        // Update local state
        setTemplates((prev) =>
          prev.map((t) =>
            t.type === selectedTemplate.type
              ? { ...t, translations: updatedTranslations }
              : t
          )
        );
        setSelectedTemplate({
          ...selectedTemplate,
          translations: updatedTranslations,
        });
        alert('Template opgeslagen!');
      } else {
        const error = await response.json();
        alert(`Fout bij opslaan: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-600 mb-6">
        Beheer de email templates voor automatische notificaties. Gebruik{' '}
        <code className="bg-gray-100 px-1 rounded">{'{{variabele}}'}</code> voor dynamische waarden.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template selector */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">Templates</h3>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.type}
                  onClick={() => selectTemplate(template)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedTemplate?.type === template.type
                      ? 'bg-blue-600 text-white'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {TEMPLATE_LABELS[template.type] || template.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Template editor */}
        <div className="lg:col-span-3">
          {selectedTemplate ? (
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {TEMPLATE_LABELS[selectedTemplate.type] || selectedTemplate.name}
                  </h3>
                  <p className="text-gray-500 text-sm">{selectedTemplate.description}</p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>

              {/* Locale selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Taal</label>
                <div className="flex gap-2 flex-wrap">
                  {availableLocales.map((locale) => (
                    <button
                      key={locale}
                      onClick={() => handleLocaleChange(locale)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        selectedLocale === locale
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      {locale.toUpperCase()}
                    </button>
                  ))}
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="en"
                      value={newLocale}
                      onChange={(e) => setNewLocale(e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      maxLength={5}
                    />
                    <button
                      onClick={handleAddLocale}
                      disabled={!newLocale.trim()}
                      className="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Variables info */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-800 mb-1">Beschikbare variabelen:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map((variable) => (
                    <code
                      key={variable}
                      className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-blue-200"
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${variable}}}`);
                      }}
                      title="Klik om te kopiëren"
                    >
                      {`{{${variable}}}`}
                    </code>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Onderwerp
                </label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Email onderwerp..."
                />
              </div>

              {/* Body */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inhoud
                </label>
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Email inhoud..."
                />
              </div>

              {/* Preview */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="font-semibold text-gray-800 mb-2 pb-2 border-b text-sm">
                    {editedSubject || '(geen onderwerp)'}
                  </div>
                  <div className="text-gray-700 whitespace-pre-wrap text-sm">
                    {editedBody || '(geen inhoud)'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center text-gray-500">
              Selecteer een template om te bewerken
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
