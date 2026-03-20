import Link from 'next/link';
import { adminDb } from '@/lib/firebase/server';
import { serializeNewsItem, sortNewsItems } from '@/lib/news';
import { getNewsReadingTimeMinutes } from '@/lib/news-reading-time';
import { NewsHero } from '@/components/news/NewsHero';

export const dynamic = 'force-dynamic';

export default async function NewsOverviewPage() {
  let items: ReturnType<typeof sortNewsItems> = [];

  try {
    const snapshot = await adminDb.collection('newsItems').get();
    items = sortNewsItems(
      snapshot.docs
        .map((doc) => serializeNewsItem(doc.id, doc.data()))
        .filter((item) => item.status === 'published')
    );
  } catch (error) {
    console.error('[NEWS_OVERVIEW] Failed to load news items:', error);
  }

  const formatMeta = (item: (typeof items)[number]) => {
    const parts = [item.category || 'Nieuws'];
    if (item.publishedAt) {
      parts.push(new Intl.DateTimeFormat('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(item.publishedAt)));
    }
    parts.push(`${getNewsReadingTimeMinutes(item.content)} min leestijd`);
    return parts.join(' · ');
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6f4_35%,#ffffff_100%)] pb-20 mt-9">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-3 text-4xl font-bold text-gray-950 sm:text-5xl">Nieuws</h1>
            <p className="mt-3 max-w-2xl text-lg text-gray-700">
              Productupdates, wedstrijdverslagen, uitslagen en andere belangrijke momenten op een plek.
            </p>
          </div>
        </div>

        {items.length > 0 ? (
          <section className="space-y-8">
            {items.map((item) => (
              <article key={item.id} className="space-y-4">
                <NewsHero
                  item={item}
                  compact
                  titleHref={`/news/${item.slug}`}
                  titleMeta={formatMeta(item)}
                  readMoreHref={`/news/${item.slug}`}
                />
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-[28px] border border-dashed border-gray-300 bg-white/80 px-8 py-16 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Nieuws is tijdelijk niet beschikbaar</h2>
            <p className="mt-3 text-gray-600">
              De nieuwspagina kon nu niet geladen worden. Probeer het later opnieuw of controleer de serverlogs.
            </p>
            <div className="mt-6">
              <Link
                href="/home"
                className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Terug naar home
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
