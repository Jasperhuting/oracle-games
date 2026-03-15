/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { NewsItem } from '@/lib/types/news';

function formatNewsDate(value: string | null) {
  if (!value) return 'Concept';

  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm transition-transform hover:-translate-y-0.5">
      {item.heroImageUrl && (
        <Link href={`/news/${item.slug}`} className="block h-52 bg-gray-100">
          <img src={item.heroImageUrl} alt={item.heroImageAlt || item.title} className="h-full w-full object-cover" />
        </Link>
      )}
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.24em] text-gray-500">
          <span>{item.category || 'Nieuws'}</span>
          <span className="h-1 w-1 rounded-full bg-gray-300" />
          <span>{formatNewsDate(item.publishedAt)}</span>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-950">
            <Link href={`/news/${item.slug}`} className="hover:text-primary">
              {item.title}
            </Link>
          </h2>
          {item.summary && (
            <div
              className="page-content text-base leading-7 text-gray-700"
              dangerouslySetInnerHTML={{ __html: item.summary }}
            />
          )}
        </div>

        <Link href={`/news/${item.slug}`} className="inline-flex items-center text-sm font-semibold text-primary hover:text-primary-hover">
          Lees bericht
        </Link>
      </div>
    </article>
  );
}
