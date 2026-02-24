'use client'

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminOrImpersonatedGate } from "@/components/AdminOrImpersonatedGate";
import type { ForumCategory } from "@/lib/types/forum";
import { useAuth } from "@/hooks/useAuth";

export default function ForumPage() {
    const { user } = useAuth();
    const [categories, setCategories] = useState<ForumCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [seeding, setSeeding] = useState(false);
    const [backfillLoading, setBackfillLoading] = useState(false);
    const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/forum/categories');
            if (!res.ok) {
                setError('Kon forumcategorieën niet laden.');
                setLoading(false);
                return;
            }
            const data = await res.json();
            setCategories(data.categories || []);
            setLoading(false);
        };

        load();
    }, []);

    const handleSeed = async () => {
        setSeeding(true);
        setError(null);
        try {
            const res = await fetch('/api/forum/seed', { method: 'POST' });
            if (!res.ok) {
                setError('Seeden van categorieën mislukt.');
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

    const handleBackfill = async () => {
        if (!user) return;
        setBackfillLoading(true);
        setBackfillMessage(null);
        try {
            const res = await fetch('/api/forum/backfill-game-topics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminUserId: user.uid }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setBackfillMessage(data?.error || 'Backfill mislukt.');
                return;
            }
            const data = await res.json();
            setBackfillMessage(`Aangemaakt: ${data.created}, overgeslagen: ${data.skipped}`);
        } finally {
            setBackfillLoading(false);
        }
    };

    return (
        <AdminOrImpersonatedGate>
            <div className="flex flex-col min-h-screen p-4 md:p-8 mt-[36px] bg-gray-50">
                <div className="mx-auto container max-w-5xl">
                    {/* Header */}
                    <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
                        <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900 underline">
                            ← Terug naar account
                        </Link>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 via-white to-sky-50 border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold">💬</div>
                                    <h1 className="text-2xl font-bold text-gray-900">Forum</h1>
                                </div>
                                <p className="text-sm text-gray-600">
                                    Een warme plek om strategieën te delen en samen te praten over de spellen.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    Preview
                                </span>
                            </div>
                        </div>
                    </div>

                        {loading && (
                            <div className="text-sm text-gray-500">Categorieën laden...</div>
                        )}
                        {error && (
                            <div className="text-sm text-red-600 mb-4">{error}</div>
                        )}

                        {!loading && categories.length === 0 && (
                            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                                <div className="text-sm text-gray-600 mb-3">
                                    Nog geen categorieën gevonden. Seed eerst de standaardcategorieën.
                                </div>
                                <button
                                    onClick={handleSeed}
                                    disabled={seeding}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                        seeding ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/80'
                                    }`}
                                >
                                    {seeding ? 'Bezig...' : 'Seed categorieën'}
                                </button>
                            </div>
                        )}

                        {!loading && categories.length > 0 && (
                            <div className="mb-6 flex flex-wrap items-center gap-3">
                                <button
                                    onClick={handleBackfill}
                                    disabled={backfillLoading || !user}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                        backfillLoading || !user
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            : 'bg-primary text-white hover:bg-primary/80'
                                    }`}
                                >
                                    {backfillLoading ? 'Bezig...' : 'Maak topics voor alle spellen'}
                                </button>
                                {backfillMessage && (
                                    <span className="text-sm text-gray-600">{backfillMessage}</span>
                                )}
                            </div>
                        )}
                        {!loading && categories.length > 0 && (
                            <div className="grid grid-cols-1 gap-4">
                                {categories.map((category) => (
                                    <Link
                                        key={category.id}
                                        href={`/forum/${category.slug}`}
                                        className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-primary hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h2 className="font-semibold text-gray-900">{category.name}</h2>
                                            <span className="text-xs text-gray-400">Categorie</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Bekijk topics en discussies.
                                        </p>
                                        <div className="mt-4 text-xs text-primary underline">
                                            Open categorie →
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                </div>
            </div>
        </AdminOrImpersonatedGate>
    );
}
