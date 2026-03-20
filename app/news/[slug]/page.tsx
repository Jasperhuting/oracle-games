import { notFound } from 'next/navigation';
import Link from 'next/link';
import { adminDb } from '@/lib/firebase/server';
import { serializeNewsItem, sortNewsItems } from '@/lib/news';
import { NewsArticleClientMeta } from '@/components/news/NewsArticleClientMeta';
import { NewsHero } from '@/components/news/NewsHero';

export const dynamic = 'force-dynamic';

function formatPublishedAt(value: string | null) {
  if (!value) return 'Concept';

  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default async function NewsDetailPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const snapshot = await adminDb.collection('newsItems').get();
  const items = sortNewsItems(
    snapshot.docs
      .map((doc) => serializeNewsItem(doc.id, doc.data()))
      .filter((item) => item.status === 'published')
  );

  const item = items.find((entry) => entry.slug === slug);
  if (!item) {
    notFound();
  }

  const relatedItems = items.filter((entry) => entry.id !== item.id).slice(0, 3);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6f4_35%,#ffffff_100%)] pb-20 mt-9">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/news" className="text-sm font-semibold text-primary hover:text-primary-hover">
            Terug naar nieuws
          </Link>
        </div>

        <div className="space-y-8">
          <NewsHero item={item} compact />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
            <article className="rounded-[28px] border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="mb-8 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                <span>{item.category || 'Nieuws'}</span>
                <span className="h-1 w-1 rounded-full bg-gray-300" />
                <span>{formatPublishedAt(item.publishedAt)}</span>
                <span className="h-1 w-1 rounded-full bg-gray-300" />
                <NewsArticleClientMeta newsId={item.id} content={item.content} initialViewCount={item.viewCount} />
              </div>

              <div className="page-content text-gray-800" dangerouslySetInnerHTML={{ __html: item.content }} />
            </article>

            <aside className="space-y-4">
              <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">Meer nieuws</h2>
                <div className="mt-4 space-y-4">
                  {relatedItems.length === 0 && <p className="text-sm text-gray-600">Nog geen andere berichten.</p>}
                  {relatedItems.map((relatedItem) => (
                    <Link key={relatedItem.id} href={`/news/${relatedItem.slug}`} className="block rounded-xl border border-gray-200 p-4 hover:border-primary/40 hover:bg-gray-50">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                        {relatedItem.category || 'Nieuws'}
                      </div>
                      <div className="mt-2 text-base font-semibold text-gray-900">{relatedItem.title}</div>
                      {relatedItem.summary && (
                        <div
                          className="page-content mt-2 text-sm text-gray-600"
                          dangerouslySetInnerHTML={{ __html: relatedItem.summary }}
                        />
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
