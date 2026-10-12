import { getPermalink, getAsset } from './utils/permalinks';
import { localizePath, useTranslations } from './i18n/utils';
import type { Lang } from './i18n/ui';

export const orcidUrl = 'https://orcid.org/0009-0008-2591-1210';
export const xUrl = 'https://x.com/carluve';
const linkedInUrl = 'https://www.linkedin.com/in/carlosluengo';
const githubUrl = 'https://github.com/Carluve';
const scholarUrl = 'https://scholar.google.es/citations?user=ikUrqYkAAAAJ';

/** Internal link in the given language. */
const link = (path: string, lang: Lang) => localizePath(getPermalink(path), lang);

export const getHeaderData = (lang: Lang = 'es') => {
  const t = useTranslations(lang);
  return {
    links: [
      { text: t('nav.home'), href: link('/', lang) },
      { text: t('nav.about'), href: link('/about', lang) },
      { text: t('nav.blog'), href: link('/blog', lang) },
      { text: t('nav.academia'), href: link('/academia', lang) },
      { text: t('nav.developer'), href: link('/developer', lang) },
      { text: t('nav.contact'), href: link('/contact', lang) },
    ],
    actions: [{ text: 'LinkedIn', href: linkedInUrl, target: '_blank' }],
  };
};

export const getFooterData = (lang: Lang = 'es') => {
  const t = useTranslations(lang);
  return {
    links: [
      {
        title: t('footer.site'),
        links: [
          { text: t('nav.home'), href: link('/', lang) },
          { text: t('nav.about'), href: link('/about', lang) },
          { text: t('nav.blog'), href: link('/blog', lang) },
          { text: t('nav.contact'), href: link('/contact', lang) },
        ],
      },
      {
        title: t('footer.areas'),
        links: [
          { text: t('nav.academia'), href: link('/academia', lang) },
          { text: t('nav.developer'), href: link('/developer', lang) },
        ],
      },
      {
        title: t('footer.profiles'),
        links: [
          { text: 'LinkedIn', href: linkedInUrl },
          { text: 'X', href: xUrl },
          { text: 'GitHub', href: githubUrl },
          { text: 'Google Scholar', href: scholarUrl },
          { text: 'ORCID', href: orcidUrl },
        ],
      },
    ],
    secondaryLinks: [
      { text: t('footer.privacy'), href: link('/privacy', lang) },
      { text: t('footer.terms'), href: link('/terms', lang) },
    ],
    socialLinks: [
      { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
      { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: linkedInUrl },
      { ariaLabel: 'X', icon: 'tabler:brand-x', href: xUrl },
      { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: githubUrl },
      { ariaLabel: 'ORCID iD', icon: 'orcid', href: orcidUrl },
    ],
    footNote: `
    © ${new Date().getFullYear()} <a class="text-link hover:underline" href="https://carlosluengo.com">Carlos Luengo Vera</a>
  `,
  };
};

export const headerData = getHeaderData('es');
export const footerData = getFooterData('es');
