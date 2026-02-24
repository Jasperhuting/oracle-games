'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminOrImpersonatedGate } from '@/components/AdminOrImpersonatedGate';
import { useAuth } from '@/hooks/useAuth';
import type { ForumCategory, ForumTopic } from '@/lib/types/forum';
import { AvatarBadge } from '@/components/forum/AvatarBadge';
import { RichTextEditor } from '@/components/forum/RichTextEditor';

type SortOption = 'active' | 'new';

const CATEGORY_LABELS: Record<string, string> = {
  algemeen: 'Algemeen',
  spellen: 'Spellen',
  'off-topic': 'Off-topic',
};

export default function ForumCategoryPage() {
  const params = useParams();
  const category = String(params?.category || '');
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('active');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const contentPlain = content.replace(/<[^>]+>/g, '').trim();

  const currentCategory = useMemo(
    () => categories.find((c) => c.slug === category),
    [categories, category]
  );
  const label = currentCategory?.name || CATEGORY_LABELS[category] || category;

  useEffect(() => {
    const loadCategories = async () => {
      setCategoryLoading(true);
      setCategoryError(null);
      const res = await fetch('/api/forum/categories');
      if (!res.ok) {
        setCategoryError('Kon forumcategorieën niet laden.');
        setCategoryLoading(false);
        return;
      }
      const data = await res.json();
      setCategories(data.categories || []);
      setCategoryLoading(false);
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadTopics = async () => {
      if (!currentCategory) {
        setTopics([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await fetch(
        `/api/forum/topics?categoryId=${currentCategory.id}&categorySlug=${currentCategory.slug}&sort=${sort}`
      );
      if (!res.ok) {
        setTopics([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTopics(data.topics || []);
      setLoading(false);
    };

    loadTopics();
  }, [currentCategory, sort]);

  const handleCreateTopic = async () => {
    if (!currentCategory || !user) return;
    if (!title.trim() || !contentPlain) return;
    setSaving(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const res = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: currentCategory.id,
          categorySlug: currentCategory.slug,
          title: title.trim(),
          content: content.trim(),
          userId: user.uid,
        }),
      });
      if (res.ok) {
        setTitle('');
        setContent('');
        setSort('active');
        setCreateSuccess('Topic geplaatst.');
        const updated = await res.json();
        if (updated?.id) {
          const refresh = await fetch(
            `/api/forum/topics?categoryId=${currentCategory.id}&categorySlug=${currentCategory.slug}&sort=active`
          );
          if (refresh.ok) {
            const data = await refresh.json();
            setTopics(data.topics || []);
          }
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setCreateError(errorData?.error || 'Topic plaatsen mislukt.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSeedCategories = async () => {
    setSeeding(true);
    setCategoryError(null);
    try {
      const res = await fetch('/api/forum/seed', { method: 'POST' });
      if (!res.ok) {
        setCategoryError('Seeden van categorieën mislukt.');
        return;
      }
      const refreshed = await fetch('/api/forum/categories');
      if (refreshed.ok) {
        const data = await refreshed.json();
        setCategories(data.categories || []);
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AdminOrImpersonatedGate>
      <div className="flex flex-col min-h-screen p-4 md:p-8 mt-[36px] bg-gray-50">
        <div className="mx-auto container max-w-5xl">
          <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
            <Link href="/forum" className="text-sm text-gray-600 hover:text-gray-900 underline">
              ← Terug naar forum
            </Link>
          </div>

          <div className="bg-gradient-to-br from-rose-50 via-white to-amber-50 border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg font-bold">🗨️</div>
                  <h1 className="text-2xl font-bold text-gray-900">{label}</h1>
                </div>
                <p className="text-sm text-gray-600">
                  Admin preview — topics zijn alleen zichtbaar voor admins/impersonated.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Preview
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Sortering</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Actief</option>
                  <option value="new">Nieuwste</option>
                </select>
              </div>
              <div className="text-sm text-gray-500">
                {loading ? 'Laden...' : `${topics.length} topics`}
              </div>
            </div>

            <div className="border border-gray-200 rounded-2xl p-4 mb-8 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Nieuw topic</h2>
              <div className="space-y-3">
                {categoryLoading && (
                  <div className="text-sm text-gray-500">Categorieën laden...</div>
                )}
                {!categoryLoading && !currentCategory && (
                  <div className="text-sm text-red-600">
                    Deze categorie bestaat nog niet. Seed eerst de categorieën.
                  </div>
                )}
                {categoryError && (
                  <div className="text-sm text-red-600">{categoryError}</div>
                )}
                {!currentCategory && !categoryLoading && (
                  <button
                    onClick={handleSeedCategories}
                    disabled={seeding}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      seeding ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/80'
                    }`}
                  >
                    {seeding ? 'Bezig...' : 'Seed categorieën'}
                  </button>
                )}
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Schrijf je bericht..."
                />
                <button
                  onClick={handleCreateTopic}
                  disabled={saving || !title.trim() || !contentPlain || !currentCategory}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    saving || !title.trim() || !contentPlain || !currentCategory
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary/80'
                  }`}
                >
                  {saving ? 'Opslaan...' : 'Plaats topic'}
                </button>
                {createError && (
                  <div className="text-sm text-red-600">{createError}</div>
                )}
                {createSuccess && (
                  <div className="text-sm text-green-600">{createSuccess}</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {loading && (
                <div className="text-sm text-gray-500">Laden...</div>
              )}
              {!loading && topics.length === 0 && (
                <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400">
                  Nog geen topics.
                </div>
              )}
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/forum/topic/${topic.id}`}
                  className="block border border-gray-200 rounded-2xl p-4 hover:border-primary hover:shadow-sm transition-all bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AvatarBadge
                        name={topic.lastReplyUserName || topic.createdByName}
                        avatarUrl={topic.lastReplyUserAvatarUrl || topic.createdByAvatarUrl}
                        size={36}
                      />
                      <div>
                      <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                      <p className="text-xs text-gray-500">
                        Door {topic.createdByName || 'Onbekend'} •{' '}
                        Laatste activiteit: {topic.lastReplyAt ? new Date(topic.lastReplyAt).toLocaleString('nl-NL') : '—'}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        {topic.lastReplyPreview || topic.body.replace(/<[^>]*>/g, '').slice(0, 140) || '—'}
                      </p>
                      {topic.gameId && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            router.push(`/games/${topic.gameId}/dashboard`);
                          }}
                          className="text-xs text-primary underline mt-1 inline-block"
                        >
                          Open spel
                        </button>
                      )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {topic.replyCount} reacties
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminOrImpersonatedGate>
  );
}
