import type { APIRoute } from 'astro';
import { fetchPosts } from '~/utils/blog';
import { getPermalink } from '~/utils/permalinks';
import { categoryLabel, localizePath, useTranslations } from '~/i18n/utils';
import type { Lang } from '~/i18n/ui';

export const prerender = true;

/**
 * Index for the site search (src/components/common/Search.astro): every post
 * and the main pages in both languages. Built once, fetched on the first open.
 */
const pageDescriptions: Record<Lang, Record<string, string>> = {
  es: {
    '/': 'Investigación, docencia e industria: IA, Cloudflare y universidad.',
    '/about': 'Trayectoria en Cloudflare, Microsoft y AWS, doctorado y docencia.',
    '/academia': 'Publicaciones, preprints e investigación doctoral sobre IA y management.',
    '/developer': 'Demos en Cloudflare Workers con el código en GitHub.',
    '/contact': 'Colaboraciones, charlas y docencia.',
  },
  en: {
    '/': 'Research, teaching and industry: AI, Cloudflare and academia.',
    '/about': 'Career at Cloudflare, Microsoft and AWS, PhD and teaching.',
    '/academia': 'Publications, preprints and doctoral research on AI and management.',
    '/developer': 'Demos on Cloudflare Workers with the code on GitHub.',
    '/contact': 'Collaborations, talks and teaching.',
  },
};

const navKeys = {
  '/': 'nav.home',
  '/about': 'nav.about',
  '/academia': 'nav.academia',
  '/developer': 'nav.developer',
  '/contact': 'nav.contact',
} as const;

export const GET: APIRoute = async () => {
  const posts = await fetchPosts();

  const pages = (['es', 'en'] as const).flatMap((lang) => {
    const t = useTranslations(lang);
    return Object.entries(navKeys).map(([path, key]) => ({
      type: 'page',
      lang,
      title: t(key),
      excerpt: pageDescriptions[lang][path],
      url: localizePath(getPermalink(path), lang),
    }));
  });

  const entries = posts.map((post) => ({
    type: 'post',
    lang: post.lang ?? 'es',
    title: post.title,
    excerpt: post.excerpt ?? '',
    url: getPermalink(post.permalink, 'post'),
    date: post.publishDate.toISOString().slice(0, 10),
    category: post.category
      ? {
          es: categoryLabel(post.category.slug, post.category.title, 'es'),
          en: categoryLabel(post.category.slug, post.category.title, 'en'),
        }
      : undefined,
    tags: (post.tags ?? []).map((tag) => tag.title),
    headings: (post.headings ?? []).filter((h) => h.depth <= 3).map((h) => h.text),
  }));

  return new Response(JSON.stringify({ pages, posts: entries }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
