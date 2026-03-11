export type NewsStatus = 'draft' | 'published';

export type NewsHeaderLayout = 'full' | 'image-left' | 'image-right';

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  status: NewsStatus;
  headerLayout: NewsHeaderLayout;
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  heroImageUrl: string;
  heroImageAlt: string;
  heroPrimaryLinkLabel: string;
  heroPrimaryLinkUrl: string;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface NewsUpsertInput {
  slug?: string;
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  status?: NewsStatus;
  headerLayout?: NewsHeaderLayout;
  heroEyebrow?: string;
  heroTitle?: string;
  heroText?: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  heroPrimaryLinkLabel?: string;
  heroPrimaryLinkUrl?: string;
  publishedAt?: string | null;
}
