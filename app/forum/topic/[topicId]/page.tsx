'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AdminOrImpersonatedGate } from '@/components/AdminOrImpersonatedGate';
import { useAuth } from '@/hooks/useAuth';
import type { ForumReply, ForumTopic } from '@/lib/types/forum';
import { RichTextEditor } from '@/components/forum/RichTextEditor';
import { AvatarBadge } from '@/components/forum/AvatarBadge';

export default function ForumTopicPage() {
  const params = useParams();
  const topicId = String(params?.topicId || '');
  const router = useRouter();
  const { user, impersonationStatus } = useAuth();

  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<ForumReply | null>(null);
  const contentPlain = content.replace(/<[^>]+>/g, '').trim();
  const hasContent = Boolean(contentPlain) || /<img[\s>]/i.test(content);
  const [saving, setSaving] = useState(false);
  const [mutatingTopic, setMutatingTopic] = useState(false);
  const [deletingTopic, setDeletingTopic] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const isLocked = topic?.status === 'locked';
  const hasAdminPrivileges = isAdmin || impersonationStatus.isImpersonating;
  const actingAdminUserId = impersonationStatus.realAdmin?.uid || user?.uid || '';
  const isOwner = Boolean(user && topic && user.uid === topic.createdBy);
  const canEditTopic = Boolean(user && topic && (isOwner || hasAdminPrivileges));
  const editContentPlain = editContent.replace(/<[^>]+>/g, '').trim();
  const canSaveEdit = Boolean(editTitle.trim()) && (Boolean(editContentPlain) || /<img[\s>]/i.test(editContent));

  const loadTopic = useCallback(async () => {
    if (!topicId) return;

    setLoading(true);
    const res = await fetch(`/api/forum/topics/${topicId}`);
    if (!res.ok) {
      setTopic(null);
      setReplies([]);
      setLoading(false);
      return;
    }

    const data = await res.json();
    setTopic(data.topic || null);
    setReplies(data.replies || []);
    setLoading(false);
  }, [topicId]);

  useEffect(() => {
    loadTopic();
  }, [loadTopic]);

  useEffect(() => {
    const loadAdmin = async () => {
      if (!user) return;

      if (impersonationStatus.isImpersonating && impersonationStatus.realAdmin?.uid) {
        setIsAdmin(true);
        return;
      }

      const res = await fetch(`/api/getUser?userId=${user.uid}`);
      if (!res.ok) {
        setIsAdmin(false);
        return;
      }

      const data = await res.json();
      setIsAdmin(data.userType === 'admin');
    };

    loadAdmin();
  }, [user, impersonationStatus.isImpersonating, impersonationStatus.realAdmin?.uid]);

  const handleReply = async () => {
    if (!user || !hasContent || !topic || isLocked) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/forum/topics/${topic.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          userId: user.uid,
          parentReplyId: replyTo?.id ?? null,
        }),
      });

      if (res.ok) {
        setContent('');
        setReplyTo(null);
        await loadTopic();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTopicUpdate = async (changes: { pinned?: boolean; status?: 'open' | 'locked' }) => {
    if (!user || !topic || !hasAdminPrivileges) return;

    setMutatingTopic(true);
    try {
      const res = await fetch(`/api/forum/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: actingAdminUserId,
          ...changes,
        }),
      });

      if (res.ok) {
        await loadTopic();
      }
    } finally {
      setMutatingTopic(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!user || !topic || !hasAdminPrivileges || deletingTopic) return;

    const confirmed = window.confirm(
      'Weet je zeker dat je dit topic wilt verwijderen? Alle reacties in dit topic worden ook verwijderd.'
    );
    if (!confirmed) return;

    setDeletingTopic(true);
    try {
      const res = await fetch(`/api/forum/topics/${topic.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actingAdminUserId }),
      });

      if (res.ok) {
        router.push(topic.gameId ? `/forum/game/${topic.gameId}` : '/forum');
      }
    } finally {
      setDeletingTopic(false);
    }
  };

  const handleStartEditTopic = () => {
    if (!topic) return;
    setEditTitle(topic.title || '');
    setEditContent(topic.body || '');
    setEditError(null);
    setEditingTopic(true);
  };

  const handleCancelEditTopic = () => {
    setEditingTopic(false);
    setEditError(null);
    if (topic) {
      setEditTitle(topic.title || '');
      setEditContent(topic.body || '');
    }
  };

  const handleSaveTopicEdit = async () => {
    if (!user || !topic || !canEditTopic || !canSaveEdit || mutatingTopic) return;

    setMutatingTopic(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/forum/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: hasAdminPrivileges ? actingAdminUserId : user.uid,
          title: editTitle.trim(),
          content: editContent.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setEditError(errorData?.error || 'Topic bewerken mislukt.');
        return;
      }

      await loadTopic();
      setEditingTopic(false);
    } finally {
      setMutatingTopic(false);
    }
  };

  const replyTree = useMemo(() => {
    const map = new Map<string | null, ForumReply[]>();
    replies.forEach((reply) => {
      const key = reply.parentReplyId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(reply);
    });
    map.forEach((list) => list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
    return map;
  }, [replies]);

  const renderReplies = (parentId: string | null, depth: number = 0) => {
    const list = replyTree.get(parentId) || [];
    return list.map((reply) => (
      <div key={reply.id} className={`border border-gray-200 rounded-lg p-4 bg-gray-50 ${depth > 0 ? 'ml-6 border-l-4 border-l-primary/40' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AvatarBadge name={reply.createdByName} avatarUrl={reply.createdByAvatarUrl} size={28} />
            <p className="text-xs text-gray-500">
              {reply.createdByName || 'Onbekend'} • {new Date(reply.createdAt).toLocaleString('nl-NL')}
            </p>
          </div>
          {!isLocked && (
            <button
              type="button"
              onClick={() => setReplyTo(reply)}
              className="text-xs text-primary hover:underline"
            >
              Reageer
            </button>
          )}
        </div>
        <div className="text-gray-800 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: reply.body }} />
        {renderReplies(reply.id, depth + 1)}
      </div>
    ));
  };

  return (
    <AdminOrImpersonatedGate>
      <div className="flex flex-col min-h-screen p-4 md:p-8 mt-[36px] bg-gray-50">
        <div className="mx-auto container max-w-5xl">
          <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
            <Link
              href={topic?.gameId ? `/forum/game/${topic.gameId}` : '/forum'}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              ← Terug naar forum
            </Link>
          </div>

          {loading && <div className="text-sm text-gray-500">Laden...</div>}

          {!loading && !topic && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-600">
              Topic niet gevonden.
            </div>
          )}

          {!loading && topic && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-sky-50 via-white to-emerald-50 border border-gray-200 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AvatarBadge name={topic.createdByName} avatarUrl={topic.createdByAvatarUrl} size={44} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
                        {topic.pinned && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Vastgezet</span>
                        )}
                        {isLocked && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Gesloten</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Door {topic.createdByName || 'Onbekend'} • Laatste activiteit:{' '}
                        {topic.lastReplyAt ? new Date(topic.lastReplyAt).toLocaleString('nl-NL') : '—'}
                      </p>
                      {topic.gameName && (
                        <p className="text-xs text-gray-500 mt-1">
                          Spel: {topic.gameName}
                          {topic.gameDivision ? ` • ${topic.gameDivision}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Preview
                  </span>
                </div>
                {!editingTopic ? (
                  <div className="mt-4 text-gray-800 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: topic.body }} />
                ) : (
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Titel"
                      disabled={mutatingTopic}
                    />
                    <RichTextEditor
                      value={editContent}
                      onChange={setEditContent}
                      placeholder="Bewerk je topic..."
                    />
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={mutatingTopic || !canSaveEdit}
                        onClick={handleSaveTopicEdit}
                        className={`px-3 py-1 text-xs rounded-md border ${
                          mutatingTopic || !canSaveEdit
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-primary text-white border-primary hover:bg-primary/80'
                        }`}
                      >
                        {mutatingTopic ? 'Opslaan...' : 'Sla wijzigingen op'}
                      </button>
                      <button
                        type="button"
                        disabled={mutatingTopic}
                        onClick={handleCancelEditTopic}
                        className={`px-3 py-1 text-xs rounded-md border ${
                          mutatingTopic
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}

                {canEditTopic && !hasAdminPrivileges && isLocked && !editingTopic && (
                  <div className="mt-3 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                    Dit topic is gesloten en kan nu niet meer bewerkt worden.
                  </div>
                )}

                {canEditTopic && (!isLocked || hasAdminPrivileges) && !editingTopic && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleStartEditTopic}
                      className="px-3 py-1 text-xs rounded-md border bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    >
                      Bewerk topic
                    </button>
                  </div>
                )}

                {hasAdminPrivileges && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={mutatingTopic}
                      onClick={() => handleTopicUpdate({ pinned: !topic.pinned })}
                      className={`px-3 py-1 text-xs rounded-md border ${
                        mutatingTopic
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {topic.pinned ? 'Losmaken' : 'Vastzetten'}
                    </button>
                    <button
                      type="button"
                      disabled={mutatingTopic}
                      onClick={() => handleTopicUpdate({ status: isLocked ? 'open' : 'locked' })}
                      className={`px-3 py-1 text-xs rounded-md border ${
                        mutatingTopic
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {isLocked ? 'Heropen topic' : 'Sluit topic'}
                    </button>
                    <button
                      type="button"
                      disabled={mutatingTopic || deletingTopic}
                      onClick={handleDeleteTopic}
                      className={`px-3 py-1 text-xs rounded-md border ${
                        mutatingTopic || deletingTopic
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-red-50 text-red-700 border-red-200 hover:border-red-300'
                      }`}
                    >
                      {deletingTopic ? 'Verwijderen...' : 'Verwijder topic'}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Reacties</h2>
                <div className="space-y-4">
                  {replies.length === 0 && (
                    <div className="text-sm text-gray-400">Nog geen reacties.</div>
                  )}
                  {renderReplies(null)}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Plaats reactie</h2>
                {isLocked && (
                  <div className="mb-3 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                    Dit topic is gesloten. Nieuwe reacties zijn uitgeschakeld.
                  </div>
                )}
                {replyTo && !isLocked && (
                  <div className="mb-3 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span>Reageren op: {replyTo.body.replace(/<[^>]*>/g, '').slice(0, 80)}...</span>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-blue-700 hover:underline"
                    >
                      Annuleren
                    </button>
                  </div>
                )}
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder={isLocked ? 'Topic is gesloten' : 'Schrijf je reactie...'}
                />
                <button
                  onClick={handleReply}
                  disabled={saving || !hasContent || isLocked}
                  className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
                    saving || !hasContent || isLocked
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary/80'
                  }`}
                >
                  {saving ? 'Opslaan...' : 'Plaats reactie'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminOrImpersonatedGate>
  );
}
