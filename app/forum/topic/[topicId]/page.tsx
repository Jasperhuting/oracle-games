'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminOrImpersonatedGate } from '@/components/AdminOrImpersonatedGate';
import { useAuth } from '@/hooks/useAuth';
import type { ForumReply, ForumTopic } from '@/lib/types/forum';
import { RichTextEditor } from '@/components/forum/RichTextEditor';
import { AvatarBadge } from '@/components/forum/AvatarBadge';

export default function ForumTopicPage() {
  const params = useParams();
  const topicId = String(params?.topicId || '');
  const { user } = useAuth();
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<ForumReply | null>(null);
  const contentPlain = content.replace(/<[^>]+>/g, '').trim();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadTopic = async () => {
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
    };

    if (topicId) {
      loadTopic();
    }
  }, [topicId]);

  const handleReply = async () => {
    if (!user || !contentPlain || !topic) return;
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
        const refreshed = await fetch(`/api/forum/topics/${topic.id}`);
        if (refreshed.ok) {
          const data = await refreshed.json();
          setTopic(data.topic || null);
          setReplies(data.replies || []);
        }
      }
    } finally {
      setSaving(false);
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
          <button
            type="button"
            onClick={() => setReplyTo(reply)}
            className="text-xs text-primary hover:underline"
          >
            Reageer
          </button>
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
            <Link href="/forum" className="text-sm text-gray-600 hover:text-gray-900 underline">
              ← Terug naar forum
            </Link>
          </div>

          {loading && (
            <div className="text-sm text-gray-500">Laden...</div>
          )}

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
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{topic.title}</h1>
                    <p className="text-sm text-gray-500">
                      Door {topic.createdByName || 'Onbekend'} • Laatste activiteit: {topic.lastReplyAt ? new Date(topic.lastReplyAt).toLocaleString('nl-NL') : '—'}
                    </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Preview
                  </span>
                </div>
                <div className="mt-4 text-gray-800 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: topic.body }} />
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
                {replyTo && (
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
                  placeholder="Schrijf je reactie..."
                />
                <button
                  onClick={handleReply}
                  disabled={saving || !contentPlain}
                  className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
                    saving || !contentPlain
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
