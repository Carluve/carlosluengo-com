import { defaultLang, ui, type Lang, type UiKey } from './ui';

/** Pages that exist in both languages: Spanish path -> English path. */
export const translatedPaths = ['/', '/about', '/academia', '/developer', '/contact', '/privacy', '/terms', '/blog'];

const strip = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

export const langFromPath = (pathname: string): Lang =>
  pathname === '/en' || pathname.startsWith('/en/') ? 'en' : defaultLang;

/**
 * Language of the page being rendered. A page can force it through
 * `Astro.locals.lang` (blog posts use their own language); otherwise the URL decides.
 */
export const getLang = (astro: { url: URL; locals?: unknown }): Lang =>
  ((astro.locals as { lang?: Lang } | undefined)?.lang as Lang | undefined) ?? langFromPath(astro.url.pathname);

export const useTranslations = (lang: Lang) => (key: UiKey) => ui[lang][key] ?? ui[defaultLang][key];

/** Path of `path` (a Spanish path such as /about) in `lang`. */
export const localizePath = (path: string, lang: Lang) => {
  if (lang === defaultLang) return path;
  if (/^(https?:|mailto:|#)/.test(path)) return path;
  const clean = strip(path);
  const base = clean.split(/[?#]/)[0];
  const isTranslated =
    translatedPaths.includes(base) ||
    base.startsWith('/category/') ||
    base.startsWith('/tag/') ||
    /^\/blog\/\d+$/.test(base);
  if (!isTranslated) return path;
  return clean === '/' ? '/en' : `/en${clean}`;
};

/** The same page in the other language, or that language's home when there is no translation. */
export const alternatePath = (pathname: string): { lang: Lang; href: string; translated: boolean } => {
  const current = langFromPath(pathname);
  const clean = strip(pathname);
  if (current === 'en') {
    const es = clean === '/en' ? '/' : clean.replace(/^\/en/, '');
    return { lang: 'es', href: es, translated: true };
  }
  const en = localizePath(clean, 'en');
  return en === clean ? { lang: 'en', href: '/en', translated: false } : { lang: 'en', href: en, translated: true };
};

export const dateLocale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'es-ES');

/** Blog categories are stored in Spanish; this is their label and description in each language. */
const categories: Record<string, Record<Lang, { label: string; description: string }>> = {
  ia: {
    es: {
      label: 'IA',
      description:
        'Inteligencia artificial aplicada: modelos de lenguaje, asistentes de código y adopción de IA en empresas y universidades.',
    },
    en: {
      label: 'AI',
      description:
        'Applied artificial intelligence: language models, coding assistants and AI adoption in companies and universities.',
    },
  },
  cloudflare: {
    es: {
      label: 'Cloudflare',
      description: 'Cloudflare en la práctica: Workers, Zero Trust, R2 y casos reales de despliegue en el borde.',
    },
    en: {
      label: 'Cloudflare',
      description: 'Cloudflare in practice: Workers, Zero Trust, R2 and real deployments at the edge.',
    },
  },
  proyectos: {
    es: {
      label: 'Proyectos',
      description: 'Proyectos propios explicados paso a paso: juegos educativos, herramientas y demos sobre Workers.',
    },
    en: {
      label: 'Projects',
      description: 'My own projects, step by step: educational games, tools and demos on Workers.',
    },
  },
  academia: {
    es: {
      label: 'Academia',
      description: 'Investigación y vida académica: evaluación de LLMs, publicación científica y acceso abierto.',
    },
    en: { label: 'Research', description: 'Research and academic life: evaluating LLMs, publishing and open access.' },
  },
  herramientas: {
    es: {
      label: 'Herramientas',
      description: 'Herramientas que uso y pruebo: navegadores con IA, editores y utilidades para el día a día.',
    },
    en: { label: 'Tools', description: 'Tools I use and test: AI browsers, editors and everyday utilities.' },
  },
  charlas: {
    es: { label: 'Charlas', description: 'Charlas y comunicaciones en congresos y jornadas sobre IA y educación.' },
    en: { label: 'Talks', description: 'Talks and conference presentations on AI and education.' },
  },
};

export const categoryLabel = (slug: string, fallback: string, lang: Lang) => categories[slug]?.[lang].label ?? fallback;
export const categoryDescription = (slug: string, fallback: string, lang: Lang) =>
  categories[slug]?.[lang].description ?? fallback;
