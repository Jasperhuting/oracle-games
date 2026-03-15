/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { NewsItem } from '@/lib/types/news';

interface NewsHeroProps {
  item: NewsItem;
  compact?: boolean;
  titleHref?: string;
  titleMeta?: string;
  readMoreHref?: string;
}

const hasImage = (item: NewsItem) => item.heroImageUrl.trim().length > 0;

function HeroCopy({ item, compact = false, titleHref, titleMeta, readMoreHref }: NewsHeroProps) {
  const title = item.heroTitle || item.title;

  return (
    <div className={`flex flex-col justify-center ${compact ? 'gap-4' : 'gap-5'}`}>
      {(item.heroEyebrow || item.category) && (
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">
          {item.heroEyebrow || item.category}
        </div>
      )}
      <div className="space-y-3">
        <h1 className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl lg:text-[2.8rem]'} font-bold leading-tight text-gray-950`}>
          {titleHref ? (
            <Link href={titleHref} className="transition-colors hover:text-primary">
              {title}
            </Link>
          ) : (
            title
          )}
        </h1>
        {titleMeta && (
          <div className="text-sm text-gray-500">
            {titleMeta}
          </div>
        )}
        {(item.heroText || item.summary) && (
          <div
            className={`page-content ${compact ? 'text-base sm:text-lg' : 'text-base sm:text-lg'} max-w-3xl text-gray-700`}
            dangerouslySetInnerHTML={{ __html: item.heroText || item.summary }}
          />
        )}
      </div>
      {item.heroPrimaryLinkLabel && item.heroPrimaryLinkUrl && (
        <div>
          <Link
            href={item.heroPrimaryLinkUrl}
            target={item.heroPrimaryLinkUrl.startsWith('http') ? '_blank' : undefined}
            rel={item.heroPrimaryLinkUrl.startsWith('http') ? 'noreferrer' : undefined}
            className="inline-flex items-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {item.heroPrimaryLinkLabel}
          </Link>
        </div>
      )}
      {readMoreHref && (
        <div>
          <Link
            href={readMoreHref}
            className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary-light"
          >
            Lees meer
          </Link>
        </div>
      )}
    </div>
  );
}

export function NewsHero({ item, compact = false, titleHref, titleMeta, readMoreHref }: NewsHeroProps) {
  if (item.headerLayout === 'image-left' || item.headerLayout === 'image-right') {
    const imageFirst = item.headerLayout === 'image-left';

    return (
      <section className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-0 md:grid-cols-2">
          {imageFirst && hasImage(item) && (
            <div className="min-h-[280px] bg-gray-100">
              <img src={item.heroImageUrl} alt={item.heroImageAlt || item.title} className="h-full w-full object-cover" />
            </div>
          )}
          <div className={`${compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12'} bg-white`}>
            <HeroCopy item={item} compact={compact} titleHref={titleHref} titleMeta={titleMeta} readMoreHref={readMoreHref} />
          </div>
          {!imageFirst && hasImage(item) && (
            <div className="min-h-[280px] bg-gray-100">
              <img src={item.heroImageUrl} alt={item.heroImageAlt || item.title} className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] bg-slate-950">
      {hasImage(item) && (
        <>
          <img
            src={item.heroImageUrl}
            alt={item.heroImageAlt || item.title}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/85 to-slate-950/55" />
        </>
      )}
      {!hasImage(item) && <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(2,85,77,0.45),_transparent_45%),linear-gradient(135deg,#0f172a,#111827_58%,#1f2937)]" />}
      <div className={`relative ${compact ? 'px-6 py-10 sm:px-8' : 'px-6 py-14 sm:px-10 lg:px-14 lg:py-18'}`}>
        <div className="max-w-4xl text-white">
          <div className={`flex flex-col justify-center ${compact ? 'gap-4' : 'gap-5'}`}>
            {(item.heroEyebrow || item.category) && (
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                {item.heroEyebrow || item.category}
              </div>
            )}
            <div className="space-y-3">
              <h1 className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl lg:text-[2.8rem]'} font-bold leading-tight`}>
                {titleHref ? (
                  <Link href={titleHref} className="transition-colors hover:text-emerald-200">
                    {item.heroTitle || item.title}
                  </Link>
                ) : (
                  item.heroTitle || item.title
                )}
              </h1>
              {titleMeta && (
                <div className="text-sm text-slate-200/80">
                  {titleMeta}
                </div>
              )}
              {(item.heroText || item.summary) && (
                <div
                  className={`page-content ${compact ? 'text-base sm:text-lg' : 'text-base sm:text-lg'} max-w-3xl text-slate-100/90`}
                  dangerouslySetInnerHTML={{ __html: item.heroText || item.summary }}
                />
              )}
            </div>
            {item.heroPrimaryLinkLabel && item.heroPrimaryLinkUrl && (
              <div>
                <Link
                  href={item.heroPrimaryLinkUrl}
                  target={item.heroPrimaryLinkUrl.startsWith('http') ? '_blank' : undefined}
                  rel={item.heroPrimaryLinkUrl.startsWith('http') ? 'noreferrer' : undefined}
                  className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
                >
                  {item.heroPrimaryLinkLabel}
                </Link>
              </div>
            )}
            {readMoreHref && (
              <div>
                <Link
                  href={readMoreHref}
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  Lees meer
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
