import { Timestamp } from 'firebase-admin/firestore';
import { NewsHeaderLayout, NewsItem, NewsStatus, NewsUpsertInput } from '@/lib/types/news';
import { slugifyNewsTitle } from '@/lib/news-utils';

const DEFAULT_HEADER_LAYOUT: NewsHeaderLayout = 'full';
const DEFAULT_STATUS: NewsStatus = 'draft';

const stringOrEmpty = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const numberOrZero = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export function serializeFirestoreDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
}

export function serializeNewsItem(id: string, data: Record<string, unknown> | undefined): NewsItem {
  const title = stringOrEmpty(data?.title);
  const summary = stringOrEmpty(data?.summary);

  return {
    id,
    slug: stringOrEmpty(data?.slug),
    title,
    summary,
    content: stringOrEmpty(data?.content),
    viewCount: numberOrZero(data?.viewCount),
    category: stringOrEmpty(data?.category),
    status: data?.status === 'published' ? 'published' : 'draft',
    headerLayout: data?.headerLayout === 'image-left' || data?.headerLayout === 'image-right' ? data.headerLayout : DEFAULT_HEADER_LAYOUT,
    heroEyebrow: stringOrEmpty(data?.heroEyebrow),
    heroTitle: stringOrEmpty(data?.heroTitle) || title,
    heroText: stringOrEmpty(data?.heroText) || summary,
    heroImageUrl: stringOrEmpty(data?.heroImageUrl),
    heroImageAlt: stringOrEmpty(data?.heroImageAlt),
    heroPrimaryLinkLabel: stringOrEmpty(data?.heroPrimaryLinkLabel),
    heroPrimaryLinkUrl: stringOrEmpty(data?.heroPrimaryLinkUrl),
    createdAt: serializeFirestoreDate(data?.createdAt),
    updatedAt: serializeFirestoreDate(data?.updatedAt),
    publishedAt: serializeFirestoreDate(data?.publishedAt),
    createdBy: stringOrEmpty(data?.createdBy) || null,
    updatedBy: stringOrEmpty(data?.updatedBy) || null,
  };
}

export function normalizeNewsInput(input: NewsUpsertInput) {
  const title = stringOrEmpty(input.title);
  const slug = slugifyNewsTitle(stringOrEmpty(input.slug) || title);
  const status: NewsStatus = input.status === 'published' ? 'published' : DEFAULT_STATUS;
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;

  if (!title) {
    throw new Error('Titel is verplicht');
  }

  if (!slug) {
    throw new Error('Slug is verplicht');
  }

  if (publishedAt && Number.isNaN(publishedAt.getTime())) {
    throw new Error('Ongeldige publicatiedatum');
  }

  return {
    slug,
    title,
    summary: stringOrEmpty(input.summary),
    content: typeof input.content === 'string' ? input.content : '',
    category: stringOrEmpty(input.category),
    status,
    headerLayout: input.headerLayout === 'image-left' || input.headerLayout === 'image-right' ? input.headerLayout : DEFAULT_HEADER_LAYOUT,
    heroEyebrow: stringOrEmpty(input.heroEyebrow),
    heroTitle: stringOrEmpty(input.heroTitle) || title,
    heroText: stringOrEmpty(input.heroText) || stringOrEmpty(input.summary),
    heroImageUrl: stringOrEmpty(input.heroImageUrl),
    heroImageAlt: stringOrEmpty(input.heroImageAlt),
    heroPrimaryLinkLabel: stringOrEmpty(input.heroPrimaryLinkLabel),
    heroPrimaryLinkUrl: stringOrEmpty(input.heroPrimaryLinkUrl),
    publishedAt: status === 'published' ? Timestamp.fromDate(publishedAt ?? new Date()) : null,
  };
}

export function sortNewsItems(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const left = new Date(a.publishedAt || a.updatedAt || a.createdAt || 0).getTime();
    const right = new Date(b.publishedAt || b.updatedAt || b.createdAt || 0).getTime();
    return right - left;
  });
}
