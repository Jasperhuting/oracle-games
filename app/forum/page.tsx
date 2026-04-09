'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AvatarBadge } from '@/components/forum/AvatarBadge';
import type { ForumCategory, ForumGame } from '@/lib/types/forum';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecentTopic {
  id: string;
  title: string;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  gameId: string | null;
  gameName: string | null;
  createdBy: string;
  createdByName: string;
  createdByAvatarUrl: string | null;
  lastReplyUserId: string | null;
  lastReplyUserName: string | null;
  lastReplyUserAvatarUrl: string | null;
  lastReplyPreview: string | null;
  lastReplyAt: string | null;
  createdAt: string;
  replyCount: number;
  pinned: boolean;
  status: 'open' | 'locked';
}

type SelectedSection =
  | { type: 'all' }
  | { type: 'category'; category: ForumCategory }
  | { type: 'game'; game: ForumGame };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'zonet';
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dag${days === 1 ? '' : 'en'} geleden`;
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function getGameIcon(name: string): string {
  if (name.toLowerCase().includes('f1')) return '🏎️';
  return '🚴';
}

const CATEGORY_ICONS: Record<string, string> = {
  algemeen: '🗨️',
  'vragen-hulp': '❓',
  test: '🧪',
  spellen: '🎮',
  'off-topic': '💬',
};

const VISIBLE_CATEGORY_SLUGS = ['algemeen', 'vragen-hulp', 'test'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ForumPage() {
  const { user } = useAuth();

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [games, setGames] = useState<ForumGame[]>([]);
  const [topics, setTopics] = useState<RecentTopic[]>([]);
  const [readStatuses, setReadStatuses] = useState<Record<string, string | null>>({});
  const [selected, setSelected] = useState<SelectedSection>({ type: 'all' });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Load sidebar data once ────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const [gamesRes, catsRes] = await Promise.all([
        fetch('/api/forum/games'),
        fetch('/api/forum/categories'),
      ]);

      if (gamesRes.ok) {
        const data = await gamesRes.json();
        setGames(data.games || []);
      }

      if (catsRes.ok) {
        const data = await catsRes.json();
        setCategories(
          (data.categories || []).filter((c: ForumCategory) =>
            VISIBLE_CATEGORY_SLUGS.includes(c.slug)
          )
        );
      }
    };

    load();
  }, []);

  // ── Load topics when selection changes ────────────────────────────────────

  useEffect(() => {
    const loadTopics = async () => {
      setLoading(true);
      setTopics([]);

      let url: string;
      if (selected.type === 'all') {
        url = '/api/forum/recent-topics';
      } else if (selected.type === 'category') {
        url = `/api/forum/topics?categoryId=${selected.category.id}&sort=active&limit=50`;
      } else {
        const ids = selected.game.gameIds?.join(',') || selected.game.id;
        url = `/api/forum/topics?gameIds=${encodeURIComponent(ids)}&sort=active&limit=50`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || []);
      }

      setLoading(false);
    };

    loadTopics();
  }, [selected]);

  // ── Load read statuses after topics change ────────────────────────────────

  useEffect(() => {
    if (!user || topics.length === 0) return;

    const ids = topics.map((t) => t.id).join(',');
    fetch(`/api/forum/read-status?topicIds=${encodeURIComponent(ids)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.readStatuses) {
          setReadStatuses(data.readStatuses);
        }
      })
      .catch(() => {});
  }, [user, topics]);

  // ── Unread check ─────────────────────────────────────────────────────────

  function isUnread(topic: RecentTopic): boolean {
    if (!user) return false;
    // If user made the last reply, it's read
    if (topic.lastReplyUserId === user.uid) return false;
    const readAt = readStatuses[topic.id];
    if (!readAt) return true;
    if (!topic.lastReplyAt) return false;
    return topic.lastReplyAt > readAt;
  }

  // ── Derived header label ──────────────────────────────────────────────────

  const headerLabel = useMemo(() => {
    if (selected.type === 'all') return 'Recente berichten';
    if (selected.type === 'category') return selected.category.name;
    return selected.game.name;
  }, [selected]);

  const unreadCount = useMemo(
    () => topics.filter((t) => isUnread(t)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics, readStatuses, user]
  );

  // ── Nav item helper ───────────────────────────────────────────────────────

  function isActive(section: SelectedSection): boolean {
    if (section.type !== selected.type) return false;
    if (section.type === 'all') return true;
    if (section.type === 'category' && selected.type === 'category') {
      return section.category.id === selected.category.id;
    }
    if (section.type === 'game' && selected.type === 'game') {
      return section.game.id === selected.game.id;
    }
    return false;
  }

  function navItemClass(active: boolean): string {
    return [
      'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left',
      active
        ? 'bg-primary/10 text-primary font-semibold'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    ].join(' ');
  }

  function handleSelect(section: SelectedSection) {
    setSelected(section);
    setSidebarOpen(false);
  }

  // ─── Sidebar content (shared between mobile + desktop) ───────────────────

  function renderSidebarNav() {
    return (
      <>
        {/* Sidebar header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold shrink-0">
            💬
          </div>
          <span className="font-bold text-gray-900 text-base">Forum</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button
            onClick={() => handleSelect({ type: 'all' })}
            className={navItemClass(isActive({ type: 'all' }))}
          >
            <span className="text-base shrink-0">🕐</span>
            <span className="truncate">Recente berichten</span>
          </button>

          {categories.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-3">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Algemeen
                </span>
              </div>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelect({ type: 'category', category: cat })}
                  className={navItemClass(isActive({ type: 'category', category: cat }))}
                >
                  <span className="text-base shrink-0">{CATEGORY_ICONS[cat.slug] || '💬'}</span>
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </>
          )}

          {games.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-3">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Spellen
                </span>
              </div>
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleSelect({ type: 'game', game })}
                  className={navItemClass(isActive({ type: 'game', game }))}
                >
                  <span className="text-base shrink-0">{getGameIcon(game.name)}</span>
                  <span className="truncate">{game.name}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Back link */}
        <div className="p-3 border-t border-gray-100">
          <Link
            href="/account"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors px-2 py-1"
          >
            <span>←</span>
            <span>Terug naar account</span>
          </Link>
        </div>
      </>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mt-[36px]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar (fixed overlay) */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-gray-200',
          'w-56 transition-transform duration-200 md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ top: 36 }}
      >
        {renderSidebarNav()}
      </aside>

      {/* ── Centered container ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex gap-6 items-start">

          {/* Desktop sidebar (sticky in-flow) */}
          <aside className="hidden md:flex flex-col w-56 shrink-0 sticky top-[36px] max-h-[calc(100vh-36px)] bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {renderSidebarNav()}
          </aside>

          {/* ── Main content ──────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-gray-200 bg-white sticky top-[36px] z-10">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <h1 className="font-bold text-gray-900 text-base flex-1 truncate">{headerLabel}</h1>

              {unreadCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  {unreadCount} nieuw
                </span>
              )}

              {selected.type === 'category' && (
                <Link
                  href={`/forum/${selected.category.slug}`}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Volledig forum →
                </Link>
              )}
              {selected.type === 'game' && (
                <Link
                  href={`/forum/game/${selected.game.id}`}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Volledig forum →
                </Link>
              )}
            </div>

            {/* Topics list */}
            {loading && (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                Laden...
              </div>
            )}

            {!loading && topics.length === 0 && (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                Nog geen berichten.
              </div>
            )}

            {!loading && topics.length > 0 && (
              <div className="divide-y divide-gray-100">
                {topics.map((topic) => {
                  const unread = isUnread(topic);
                  const contextLabel = topic.gameName || topic.categoryName;
                  const preview = topic.lastReplyPreview
                    ? topic.lastReplyPreview.replace(/<[^>]*>/g, '').trim()
                    : topic.body
                      ? topic.body.replace(/<[^>]*>/g, '').trim()
                      : null;

                  return (
                    <Link
                      key={topic.id}
                      href={`/forum/topic/${topic.id}`}
                      className="flex items-start gap-3 px-4 md:px-6 py-4 hover:bg-gray-50 transition-colors group"
                    >
                      {/* Unread dot */}
                      <div className="mt-1.5 shrink-0 w-2.5 flex justify-center">
                        {unread && <span className="h-2 w-2 rounded-full bg-blue-500 block" />}
                      </div>

                      {/* Avatar */}
                      <div className="shrink-0 mt-0.5">
                        <AvatarBadge
                          name={topic.lastReplyUserName || topic.createdByName}
                          avatarUrl={topic.lastReplyUserAvatarUrl || topic.createdByAvatarUrl}
                          size={36}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-0.5">
                          <span
                            className={[
                              'text-sm leading-snug text-gray-900 group-hover:text-primary transition-colors',
                              unread ? 'font-semibold' : 'font-medium',
                            ].join(' ')}
                          >
                            {topic.title}
                          </span>
                          {contextLabel && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium shrink-0">
                              {contextLabel}
                            </span>
                          )}
                          {topic.pinned && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-medium shrink-0">
                              Vastgezet
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 mb-1">
                          <span className="font-medium text-gray-700">
                            {topic.lastReplyUserName || topic.createdByName}
                          </span>
                          <span className="mx-1">·</span>
                          <span>{formatRelativeTime(topic.lastReplyAt || topic.createdAt)}</span>
                          {topic.replyCount > 0 && (
                            <>
                              <span className="mx-1">·</span>
                              <span>{topic.replyCount} reactie{topic.replyCount === 1 ? '' : 's'}</span>
                            </>
                          )}
                        </div>

                        {preview && (
                          <p className="text-xs text-gray-400 line-clamp-1">
                            {preview.length > 120 ? preview.slice(0, 120) + '…' : preview}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </main>

        </div>
      </div>
    </div>
  );
}
