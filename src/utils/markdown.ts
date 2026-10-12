/**
 * Markdown versions of the site for search and answer engines (GEO):
 * /llms.txt, /llms-full.txt and a .md twin of every page and post.
 */
import { getCollection } from 'astro:content';
import { career } from '~/data/career';
import { person, publications, SITE_URL } from '~/data/identity';
import { projects } from '~/data/projects';
import type { Lang } from '~/i18n/ui';
import { categoryLabel } from '~/i18n/utils';
import { fetchPosts } from '~/utils/blog';
import { resolveMediaUrl } from '~/utils/media';
import type { Post } from '~/types';

export const PAGES = ['index', 'about', 'academia', 'developer', 'contact'] as const;
export type PageKey = (typeof PAGES)[number];

const pagePath = (page: PageKey, lang: Lang) => {
  const base = page === 'index' ? '' : `/${page}`;
  return lang === 'en' ? `/en${base}` : base || '/';
};
const abs = (path: string) => (path === '/' ? SITE_URL : `${SITE_URL}${path}`);
export const mdPathFor = (page: PageKey, lang: Lang) =>
  page === 'index' ? (lang === 'en' ? '/en/index.md' : '/index.md') : `${pagePath(page, lang)}.md`;

const postUrl = (post: Post) => `/blog/${post.slug}`;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const resolveMedia = (text: string) => text.replace(/media:[\w./@~+-]*\w/g, (ref) => resolveMediaUrl(ref));

const frontMatter = (fields: Record<string, string | undefined>) =>
  [
    '---',
    ...Object.entries(fields)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
    '---',
    '',
  ].join('\n');

const t = (lang: Lang, es: string, en: string) => (lang === 'en' ? en : es);

/** Markdown of one post, with its metadata and absolute image URLs. */
export const postMarkdown = async (post: Post) => {
  const entries = await getCollection('post');
  const entry = entries.find((e) => e.id === post.id);
  const body = resolveMedia(entry?.body ?? '').trim();
  return (
    frontMatter({
      title: post.title,
      description: post.excerpt,
      author: person.name,
      date: isoDate(post.publishDate),
      updated: post.updateDate ? isoDate(post.updateDate) : undefined,
      lang: post.lang ?? 'es',
      category: post.category ? categoryLabel(post.category.slug, post.category.title, 'en') : undefined,
      tags: post.tags?.map((tag) => tag.title).join(', '),
      canonical: abs(postUrl(post)),
      image:
        typeof post.image === 'string' && post.image.startsWith('media:')
          ? resolveMediaUrl(post.image, { og: true })
          : undefined,
    }) +
    `# ${post.title}\n\n` +
    (post.excerpt ? `> ${post.excerpt}\n\n` : '') +
    `${body}\n\n---\n\n${t(post.lang ?? 'es', 'Autor', 'Author')}: ${person.name} — ${abs('/about')}\n`
  );
};

const careerSection = (lang: Lang) =>
  `## ${t(lang, 'Trayectoria', 'Career')}\n\n` +
  career
    .map((c) => `- **${c.name}**${c.current ? t(lang, ' (actualidad)', ' (current)') : ''}: ${c.role[lang]}`)
    .join('\n') +
  '\n';

const publicationsSection = (lang: Lang) =>
  `## ${t(lang, 'Publicaciones', 'Publications')}\n\n` +
  publications
    .map(
      (p) =>
        `- ${p.authors} (${p.date.slice(0, 4)}). **${p.title}**. ${p.venue}.` +
        (p.doi ? ` DOI: ${p.doi}.` : '') +
        (p.url ? ` ${p.url}` : '') +
        (p.note ? ` ${p.note}` : '')
    )
    .join('\n') +
  `\n\n${t(lang, 'Listado completo', 'Full list')}: ${person.sameAs.find((u) => u.includes('scholar'))}\n`;

const projectsSection = (lang: Lang) =>
  `## ${t(lang, 'Proyectos', 'Projects')}\n\n` +
  projects
    .map((p) => {
      const title = lang === 'en' ? (p.titleEn ?? p.title) : p.title;
      const desc = lang === 'en' ? (p.descriptionEn ?? p.description) : p.description;
      const links = [
        p.demo && `[${t(lang, 'Demo', 'Demo')}](${p.demo})`,
        p.repo && `[${t(lang, 'Código', 'Code')}](${p.repo})`,
        p.post && `[${t(lang, 'Artículo', 'Article')}](${abs(p.post)})`,
      ]
        .filter(Boolean)
        .join(' · ');
      const based = p.basedOn ? ` ${t(lang, 'Basado en', 'Based on')} ${p.basedOn.name}.` : '';
      return `- **${title}**${p.year ? ` (${p.year})` : ''}: ${desc}${based}${links ? ` ${links}` : ''}`;
    })
    .join('\n') +
  '\n';

const postsSection = async (lang: Lang, limit?: number) => {
  const posts = (await fetchPosts()).slice(0, limit);
  return (
    `## ${t(lang, 'Blog', 'Blog')}\n\n` +
    posts
      .map((p) => `- [${p.title}](${abs(postUrl(p))}.md) (${isoDate(p.publishDate)}): ${p.excerpt ?? ''}`)
      .join('\n') +
    '\n'
  );
};

const contactSection = (lang: Lang) =>
  `## ${t(lang, 'Contacto y perfiles', 'Contact and profiles')}\n\n` +
  person.sameAs.map((u) => `- ${u}`).join('\n') +
  '\n';

/** Markdown of one of the main pages. */
export const pageMarkdown = async (page: PageKey, lang: Lang) => {
  const titles: Record<PageKey, [string, string]> = {
    index: [
      'Carlos Luengo Vera — Investigación, docencia e industria',
      'Carlos Luengo Vera — Research, teaching and industry',
    ],
    about: ['Sobre Carlos Luengo Vera', 'About Carlos Luengo Vera'],
    academia: ['Investigación y docencia', 'Research and teaching'],
    developer: ['Proyectos y desarrollo', 'Projects and development'],
    contact: ['Contacto', 'Contact'],
  };
  const title = t(lang, ...titles[page]);
  const head =
    frontMatter({ title, author: person.name, lang, canonical: abs(pagePath(page, lang)) }) +
    `# ${title}\n\n${person.summary[lang]}\n\n`;
  switch (page) {
    case 'index':
      return (
        head +
        careerSection(lang) +
        '\n' +
        publicationsSection(lang) +
        '\n' +
        (await postsSection(lang, 8)) +
        '\n' +
        contactSection(lang)
      );
    case 'about':
      return head + careerSection(lang) + '\n' + contactSection(lang);
    case 'academia':
      return head + publicationsSection(lang);
    case 'developer':
      return head + projectsSection(lang);
    case 'contact':
      return head + contactSection(lang);
  }
};

/** /llms.txt, following https://llmstxt.org */
export const llmsTxt = async () => {
  const posts = await fetchPosts();
  const page = (key: PageKey, label: string, note: string) => `- [${label}](${abs(mdPathFor(key, 'en'))}): ${note}`;
  return `# Carlos Luengo Vera

> ${person.summary.en}

The site is bilingual: Spanish at ${SITE_URL} and English at ${SITE_URL}/en. Every page and post has a Markdown twin (add \`.md\` to the URL). The whole site in one file: ${SITE_URL}/llms-full.txt

## About

${page('index', 'Home', 'who he is, career, publications and latest posts')}
${page('about', 'About', 'career at Cloudflare, AWS, Lenovo, Telefónica, Insight and Microsoft; PhD at Universidad de Alcalá')}
${page('academia', 'Research', 'publications, including the MIR 2024/2025 LLM evaluation (arXiv:2503.00025)')}
${page('developer', 'Projects', 'demos and open-source projects on Cloudflare Workers')}
${page('contact', 'Contact', 'LinkedIn, X, GitHub, Google Scholar and ORCID')}

## Blog

${posts.map((p) => `- [${p.title}](${abs(postUrl(p))}.md): ${p.excerpt ?? ''}`).join('\n')}

## Optional

- [Español](${SITE_URL}/index.md): the same information in Spanish
- [Google Scholar](https://scholar.google.es/citations?user=ikUrqYkAAAAJ)
- [ORCID](${person.orcid})
`;
};

/** /llms-full.txt: everything in one file. */
export const llmsFullTxt = async () => {
  const posts = await fetchPosts();
  const bodies = await Promise.all(posts.map((p) => postMarkdown(p)));
  return [
    `# Carlos Luengo Vera — ${SITE_URL}\n\n${person.summary.en}\n\n${person.summary.es}\n`,
    careerSection('en'),
    publicationsSection('en'),
    projectsSection('en'),
    contactSection('en'),
    `# Blog posts\n`,
    ...bodies,
  ].join('\n');
};
