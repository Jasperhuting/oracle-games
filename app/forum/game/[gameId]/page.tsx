'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminOrImpersonatedGate } from '@/components/AdminOrImpersonatedGate';
import { AvatarBadge } from '@/components/forum/AvatarBadge';
import { RichTextEditor } from '@/components/forum/RichTextEditor';
import { useAuth } from '@/hooks/useAuth';
import type { ForumGame, ForumTopic } from '@/lib/types/forum';

type SortOption = 'active' | 'new';

export default function ForumGamePage() {
  const params = useParams();
  const gameId = String(params?.gameId || '');
  const { user } = useAuth();
  const router = useRouter();

  const [games, setGames] = useState<ForumGame[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [gameError, setGameError] = useState<string | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('active');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const contentPlain = content.replace(/<[^>]+>/g, '').trim();
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [selectedDivisionGameId, setSelectedDivisionGameId] = useState<string>('');
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [autoSeedChecked, setAutoSeedChecked] = useState(false);

  const currentGame = useMemo(
    () => games.find((game) => game.id === gameId || (game.gameIds || []).includes(gameId)),
    [games, gameId]
  );

  const divisionOptions = useMemo(() => {
    if (!currentGame?.divisions || currentGame.divisions.length === 0) {
      const fallbackId = currentGame?.gameIds?.[0] || currentGame?.id;
      return fallbackId ? [{ id: fallbackId, label: 'Geen divisie' }] : [];
    }

    return currentGame.divisions.map((division) => ({
      id: division.id,
      label: division.division || 'Geen divisie',
      level: division.divisionLevel ?? Number.MAX_SAFE_INTEGER,
    }));
  }, [currentGame]);

  const hasDivisionSplit = useMemo(
    () => divisionOptions.some((option) => option.label !== 'Geen divisie'),
    [divisionOptions]
  );

  useEffect(() => {
    const loadGames = async () => {
      setLoadingGames(true);
      setGameError(null);

      const res = await fetch('/api/forum/games');
      if (!res.ok) {
        setGameError('Kon spellen niet laden.');
        setLoadingGames(false);
        return;
      }

      const data = await res.json();
      setGames(data.games || []);
      setLoadingGames(false);
    };

    loadGames();
  }, []);

  useEffect(() => {
    if (!gameId) return;

    const loadTopics = async () => {
      setLoadingTopics(true);
      setTopicError(null);

      const queryGameIds = currentGame?.gameIds?.length ? currentGame.gameIds.join(',') : gameId;
      const res = await fetch(`/api/forum/topics?gameIds=${encodeURIComponent(queryGameIds)}&sort=${sort}`);
      if (!res.ok) {
        setTopicError('Kon topics niet laden.');
        setTopics([]);
        setLoadingTopics(false);
        return;
      }

      const data = await res.json();
      setTopics(data.topics || []);
      setLoadingTopics(false);
    };

    loadTopics();
  }, [gameId, sort, currentGame]);

  useEffect(() => {
    if (divisionOptions.length === 0) {
      setSelectedDivisionGameId('');
      return;
    }

    const preferred = divisionOptions[0]?.id || '';
    setSelectedDivisionGameId((previous) => {
      if (previous && divisionOptions.some((division) => division.id === previous)) {
        return previous;
      }
      return preferred;
    });
  }, [divisionOptions]);

  useEffect(() => {
    const autoSeedMissingDefaults = async () => {
      if (!user || !currentGame || loadingTopics || topicError || autoSeedChecked) return;
      const hasGeneral = topics.some(
        (topic) => topic.title.trim().toLowerCase() === 'algemeen'
      );
      setAutoSeedChecked(true);
      if (hasGeneral) return;

      const targetIds = currentGame.gameIds?.length ? currentGame.gameIds : [currentGame.id];
      const res = await fetch('/api/forum/topics/seed-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          gameIds: targetIds,
        }),
      });

      if (!res.ok) return;

      const refreshIds = currentGame.gameIds?.length ? currentGame.gameIds.join(',') : gameId;
      const refresh = await fetch(`/api/forum/topics?gameIds=${encodeURIComponent(refreshIds)}&sort=${sort}`);
      if (refresh.ok) {
        const data = await refresh.json();
        setTopics(data.topics || []);
      }
    };

    autoSeedMissingDefaults();
  }, [user, currentGame, loadingTopics, topicError, autoSeedChecked, topics, gameId, sort]);

  const handleCreateTopic = async () => {
    if (!user || !gameId || !title.trim() || !contentPlain) return;
    const targetGameId = selectedDivisionGameId || currentGame?.gameIds?.[0] || currentGame?.id || gameId;

    setSaving(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const res = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: targetGameId,
          title: title.trim(),
          content: content.trim(),
          userId: user.uid,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data?.error || 'Topic plaatsen mislukt.');
        return;
      }

      setTitle('');
      setContent('');
      setSort('active');
      setCreateSuccess('Topic geplaatst.');

      const refreshIds = currentGame?.gameIds?.length ? currentGame.gameIds.join(',') : gameId;
      const refresh = await fetch(`/api/forum/topics?gameIds=${encodeURIComponent(refreshIds)}&sort=active`);
      if (refresh.ok) {
        const data = await refresh.json();
        setTopics(data.topics || []);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefaultTopics = async () => {
    if (!user || !currentGame) return;

    setSeedingDefaults(true);
    setSeedMessage(null);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const targetIds = currentGame.gameIds?.length ? currentGame.gameIds : [currentGame.id];
      const res = await fetch('/api/forum/topics/seed-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          gameIds: targetIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSeedMessage(data?.error || 'Standaardtopics aanmaken mislukt.');
        return;
      }

      const data = await res.json();
      setSeedMessage(`Standaardtopics: ${data.created} aangemaakt, ${data.skipped} overgeslagen.`);

      const refreshIds = currentGame.gameIds?.length ? currentGame.gameIds.join(',') : gameId;
      const refresh = await fetch(`/api/forum/topics?gameIds=${encodeURIComponent(refreshIds)}&sort=${sort}`);
      if (refresh.ok) {
        const refreshData = await refresh.json();
        setTopics(refreshData.topics || []);
      }
    } finally {
      setSeedingDefaults(false);
    }
  };

  const topicsByDivision = useMemo(() => {
    const filteredTopics = topics.filter((topic) => !topic.isMainTopic);

    const groups = new Map<string, { key: string; label: string; level: number; topics: ForumTopic[] }>();
    filteredTopics.forEach((topic) => {
      const label = topic.gameDivision || 'Geen divisie';
      const key = label;
      const level = topic.gameDivisionLevel ?? Number.MAX_SAFE_INTEGER;
      const existing = groups.get(key);
      if (existing) {
        existing.topics.push(topic);
        existing.level = Math.min(existing.level, level);
        return;
      }
      groups.set(key, { key, label, level, topics: [topic] });
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.label.localeCompare(b.label, 'nl');
    });
  }, [topics]);

  const mainTopics = useMemo(() => {
    const byTitle = new Map<string, ForumTopic>();

    for (const topic of topics) {
      if (!topic.isMainTopic) continue;
      const key = topic.title.trim().toLowerCase();

      const existing = byTitle.get(key);
      if (!existing) {
        byTitle.set(key, topic);
        continue;
      }

      const existingDate = existing.lastReplyAt || existing.createdAt || '';
      const topicDate = topic.lastReplyAt || topic.createdAt || '';
      const shouldReplace =
        (topic.pinned ?? false) && !(existing.pinned ?? false)
          ? true
          : topicDate > existingDate;
      if (shouldReplace) {
        byTitle.set(key, topic);
      }
    }

    return Array.from(byTitle.values()).sort((a, b) =>
      (b.lastReplyAt || b.createdAt || '').localeCompare(a.lastReplyAt || a.createdAt || '')
    );
  }, [topics]);

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
                  <h1 className="text-2xl font-bold text-gray-900">
                    {currentGame?.name || 'Spel-forum'}
                  </h1>
                </div>
                <p className="text-sm text-gray-600">
                  Maak losse topics voor dit spel, zoals team-presentaties, blessures of tactiek.
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Preview
              </span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {loadingGames && <div className="text-sm text-gray-500 mb-4">Spel laden...</div>}
            {gameError && <div className="text-sm text-red-600 mb-4">{gameError}</div>}
            {!loadingGames && !currentGame && !gameError && (
              <div className="text-sm text-red-600 mb-4">Dit spel bestaat niet of is niet zichtbaar.</div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Sortering</label>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Actief</option>
                  <option value="new">Nieuwste</option>
                </select>
              </div>
              <div className="text-sm text-gray-500">
                {loadingTopics ? 'Laden...' : `${topics.length} topics`}
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSeedDefaultTopics}
                disabled={seedingDefaults || !currentGame || !user}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  seedingDefaults || !currentGame || !user
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/80'
                }`}
              >
                {seedingDefaults ? 'Bezig...' : 'Maak standaardtopics'}
              </button>
              {seedMessage && <span className="text-sm text-gray-600">{seedMessage}</span>}
            </div>

            <div className="border border-gray-200 rounded-2xl p-4 mb-8 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Nieuw topic in dit spel</h2>
              <div className="space-y-3">
                {divisionOptions.length > 1 && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Divisie</label>
                    <select
                      value={selectedDivisionGameId}
                      onChange={(event) => setSelectedDivisionGameId(event.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {divisionOptions.map((division) => (
                        <option key={division.id} value={division.id}>
                          {division.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
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
                  disabled={saving || !title.trim() || !contentPlain || !currentGame}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    saving || !title.trim() || !contentPlain || !currentGame
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary/80'
                  }`}
                >
                  {saving ? 'Opslaan...' : 'Plaats topic'}
                </button>
                {createError && <div className="text-sm text-red-600">{createError}</div>}
                {createSuccess && <div className="text-sm text-green-600">{createSuccess}</div>}
              </div>
            </div>

            <div className="space-y-6">
              {loadingTopics && <div className="text-sm text-gray-500">Laden...</div>}
              {topicError && <div className="text-sm text-red-600">{topicError}</div>}
              {!loadingTopics && !topicError && topics.length === 0 && (
                <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400">
                  Nog geen topics in dit spel.
                </div>
              )}

              {!loadingTopics && !topicError && mainTopics.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">
                    Hoofd
                  </h3>
                  {mainTopics.map((topic) => (
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
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                              {topic.pinned && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Vastgezet</span>
                              )}
                              {topic.status === 'locked' && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Gesloten</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              Door {topic.createdByName || 'Onbekend'} • Laatste activiteit:{' '}
                              {topic.lastReplyAt ? new Date(topic.lastReplyAt).toLocaleString('nl-NL') : '—'}
                            </p>
                            <p className="text-sm text-gray-600 mt-2">
                              {topic.lastReplyPreview || topic.body.replace(/<[^>]*>/g, '').slice(0, 140) || '—'}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {topic.replyCount} reacties
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {!loadingTopics && !topicError && topicsByDivision.map((group) => (
                <div key={group.key} className="space-y-3">
                  {hasDivisionSplit && (
                    <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">
                      {group.label}
                    </h3>
                  )}
                  {group.topics.map((topic) => (
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
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                              {topic.pinned && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Vastgezet</span>
                              )}
                              {topic.status === 'locked' && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Gesloten</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              Door {topic.createdByName || 'Onbekend'} • Laatste activiteit:{' '}
                              {topic.lastReplyAt ? new Date(topic.lastReplyAt).toLocaleString('nl-NL') : '—'}
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
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                          {topic.replyCount} reacties
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminOrImpersonatedGate>
  );
}
