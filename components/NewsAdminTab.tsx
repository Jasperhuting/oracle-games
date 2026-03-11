'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { slugifyNewsTitle } from '@/lib/news-utils';
import { NewsHeaderLayout, NewsItem, NewsStatus } from '@/lib/types/news';
import { RichTextEditor } from '@/components/RichTextEditor';
import { NewsHero } from '@/components/news/NewsHero';
import { NewsImageUpload } from '@/components/news/NewsImageUpload';

type MessageState = { type: 'success' | 'error'; text: string } | null;

interface NewsFormState {
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  status: NewsStatus;
  headerLayout: NewsHeaderLayout;
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  heroImageUrl: string;
  heroImageAlt: string;
  heroPrimaryLinkLabel: string;
  heroPrimaryLinkUrl: string;
  publishedAt: string;
}

const EMPTY_FORM: NewsFormState = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  category: '',
  status: 'draft',
  headerLayout: 'full',
  heroEyebrow: '',
  heroTitle: '',
  heroText: '',
  heroImageUrl: '',
  heroImageAlt: '',
  heroPrimaryLinkLabel: '',
  heroPrimaryLinkUrl: '',
  publishedAt: '',
};

function toLocalDateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function fromItemToForm(item: NewsItem): NewsFormState {
  return {
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    content: item.content,
    category: item.category,
    status: item.status,
    headerLayout: item.headerLayout,
    heroEyebrow: item.heroEyebrow,
    heroTitle: item.heroTitle,
    heroText: item.heroText,
    heroImageUrl: item.heroImageUrl,
    heroImageAlt: item.heroImageAlt,
    heroPrimaryLinkLabel: item.heroPrimaryLinkLabel,
    heroPrimaryLinkUrl: item.heroPrimaryLinkUrl,
    publishedAt: toLocalDateTimeInput(item.publishedAt),
  };
}

function buildPreviewItem(form: NewsFormState, selectedId: string | null): NewsItem {
  const isoPublishedAt = form.publishedAt ? new Date(form.publishedAt).toISOString() : null;

  return {
    id: selectedId || 'preview',
    slug: form.slug,
    title: form.title || 'Nieuwsbericht zonder titel',
    summary: form.summary,
    content: form.content,
    category: form.category,
    status: form.status,
    headerLayout: form.headerLayout,
    heroEyebrow: form.heroEyebrow,
    heroTitle: form.heroTitle || form.title || 'Nieuwsbericht zonder titel',
    heroText: form.heroText || form.summary,
    heroImageUrl: form.heroImageUrl,
    heroImageAlt: form.heroImageAlt,
    heroPrimaryLinkLabel: form.heroPrimaryLinkLabel,
    heroPrimaryLinkUrl: form.heroPrimaryLinkUrl,
    createdAt: null,
    updatedAt: null,
    publishedAt: isoPublishedAt,
    createdBy: null,
    updatedBy: null,
  };
}

function formatSidebarDate(item: NewsItem) {
  const value = item.publishedAt || item.updatedAt || item.createdAt;
  if (!value) return item.status === 'draft' ? 'Concept' : 'Geen datum';

  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function NewsAdminTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<NewsFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const selectedIdRef = useRef<string | null>(null);

  const previewItem = useMemo(() => buildPreviewItem(form, selectedId), [form, selectedId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadItems = useCallback(async (keepSelectedId?: string | null) => {
    if (!user?.uid) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/news?includeDrafts=true&userId=${user.uid}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Kon nieuwsitems niet laden');
      }

      const nextItems = (data.items || []) as NewsItem[];
      setItems(nextItems);

      const nextSelectedId = keepSelectedId ?? selectedIdRef.current;
      if (nextSelectedId) {
        const selected = nextItems.find((item) => item.id === nextSelectedId);
        if (selected) {
          setSelectedId(selected.id);
          setForm(fromItemToForm(selected));
          setSlugTouched(true);
          return;
        }
      }

      if (nextItems.length > 0) {
        setSelectedId(nextItems[0].id);
        setForm(fromItemToForm(nextItems[0]));
        setSlugTouched(true);
      } else {
        setSelectedId(null);
        setForm(EMPTY_FORM);
        setSlugTouched(false);
      }
    } catch (error) {
      console.error('[NEWS-ADMIN] load failed:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Kon nieuwsitems niet laden' });
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const updateField = <K extends keyof NewsFormState>(key: K, value: NewsFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'title' && !slugTouched) {
        next.slug = slugifyNewsTitle(String(value));
      }
      return next;
    });
  };

  const handleSelectItem = (item: NewsItem) => {
    setSelectedId(item.id);
    setForm(fromItemToForm(item));
    setSlugTouched(true);
    setMessage(null);
  };

  const handleCreateNew = () => {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!user?.uid) return;

    setSaving(true);
    setMessage(null);

    try {
      const endpoint = selectedId ? `/api/news/${selectedId}?userId=${user.uid}` : `/api/news?userId=${user.uid}`;
      const method = selectedId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Opslaan mislukt');
      }

      const savedId = data.item?.id || selectedId;
      await loadItems(savedId);
      setMessage({ type: 'success', text: 'Nieuwsbericht opgeslagen' });
    } catch (error) {
      console.error('[NEWS-ADMIN] save failed:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Opslaan mislukt' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.uid || !selectedId) return;
    if (!window.confirm('Weet je zeker dat je dit nieuwsbericht wilt verwijderen?')) return;

    setDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/news/${selectedId}?userId=${user.uid}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Verwijderen mislukt');
      }

      await loadItems(null);
      setMessage({ type: 'success', text: 'Nieuwsbericht verwijderd' });
    } catch (error) {
      console.error('[NEWS-ADMIN] delete failed:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Verwijderen mislukt' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nieuwsbeheer</h2>
          <p className="mt-1 text-sm text-gray-600">
            Maak nieuwsberichten voor releases, wedstrijduitslagen of andere updates. De header kan full width of als split-layout met beeld links of rechts.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Nieuw bericht
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 text-sm font-semibold text-gray-700">Bestaande berichten</div>
          {loading ? (
            <div className="rounded-xl bg-white p-4 text-sm text-gray-500">Laden...</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl bg-white p-4 text-sm text-gray-500">Nog geen nieuwsitems.</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      active ? 'border-primary bg-primary-light' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        item.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-gray-500">
                      {item.category || 'Nieuws'} · {formatSidebarDate(item)}
                    </div>
                    {item.summary && <p className="mt-3 line-clamp-3 text-sm text-gray-600">{item.summary}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Titel</span>
                <input
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="Bijv. Oracle Rider Stats Chrome-extensie live"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    updateField('slug', slugifyNewsTitle(event.target.value));
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="oracle-rider-stats-live"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Categorie</span>
                <input
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="Productupdate, Wedstrijd, Uitslag..."
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value as NewsStatus)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                >
                  <option value="draft">Concept</option>
                  <option value="published">Gepubliceerd</option>
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Samenvatting</span>
                <textarea
                  value={form.summary}
                  onChange={(event) => updateField('summary', event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="Korte intro voor de overzichtspagina en header."
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Publicatiedatum</span>
                <input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(event) => updateField('publishedAt', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-5">
              <h3 className="text-lg font-bold text-gray-900">Header</h3>
              <p className="mt-1 text-sm text-gray-600">Kies hier de hero-layout en bijbehorende content.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Header layout</span>
                <select
                  value={form.headerLayout}
                  onChange={(event) => updateField('headerLayout', event.target.value as NewsHeaderLayout)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                >
                  <option value="full">Volle breedte</option>
                  <option value="image-left">Afbeelding links, tekst rechts</option>
                  <option value="image-right">Tekst links, afbeelding rechts</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Eyebrow / label</span>
                <input
                  value={form.heroEyebrow}
                  onChange={(event) => updateField('heroEyebrow', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="Nieuw, Release, Wedstrijdverslag..."
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Header titel</span>
                <input
                  value={form.heroTitle}
                  onChange={(event) => updateField('heroTitle', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="Leeg laten om de gewone titel te gebruiken"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Header tekst</span>
                <textarea
                  value={form.heroText}
                  onChange={(event) => updateField('heroText', event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="Korte intro in de hero. Leeg laten gebruikt de samenvatting."
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Headerafbeelding</span>
                <NewsImageUpload
                  currentImageUrl={form.heroImageUrl}
                  onUploadSuccess={(url) => updateField('heroImageUrl', url)}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Afbeelding alt-tekst</span>
                <input
                  value={form.heroImageAlt}
                  onChange={(event) => updateField('heroImageAlt', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="Beschrijving van de headerafbeelding"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Button label</span>
                <input
                  value={form.heroPrimaryLinkLabel}
                  onChange={(event) => updateField('heroPrimaryLinkLabel', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="Bekijk extensie"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Button URL</span>
                <input
                  value={form.heroPrimaryLinkUrl}
                  onChange={(event) => updateField('heroPrimaryLinkUrl', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-primary"
                  placeholder="https://chromewebstore.google.com/..."
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-5">
              <h3 className="text-lg font-bold text-gray-900">Inhoud</h3>
              <p className="mt-1 text-sm text-gray-600">Gebruik de WYSIWYG-editor om het bericht op te maken.</p>
            </div>
            <RichTextEditor content={form.content} onChange={(value) => updateField('content', value)} />
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Preview</h3>
                <p className="mt-1 text-sm text-gray-600">Zo ziet het bericht eruit op de publieke nieuwspagina.</p>
              </div>
            </div>
            <div className="space-y-8 rounded-[28px] bg-gray-50 p-4 sm:p-6">
              <NewsHero item={previewItem} compact />
              <div className="page-content rounded-2xl bg-white p-6 text-gray-800 shadow-sm" dangerouslySetInnerHTML={{ __html: form.content || '<p>Nog geen content.</p>' }} />
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {selectedId && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Verwijderen...' : 'Verwijderen'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
