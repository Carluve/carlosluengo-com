import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

export const orcidUrl = 'https://orcid.org/0009-0008-2591-1210';
export const xUrl = 'https://x.com/carluve';

export const headerData = {
  links: [
    { text: 'Inicio', href: getPermalink('/') },
    { text: 'Sobre mí', href: getPermalink('/about') },
    { text: 'Blog', href: getBlogPermalink() },
    { text: 'Academia', href: getPermalink('/academia') },
    { text: 'Desarrollo', href: getPermalink('/developer') },
    { text: 'Contacto', href: getPermalink('/contact') },
  ],
  actions: [
    {
      text: 'LinkedIn',
      href: 'https://www.linkedin.com/in/carlosluengo',
      target: '_blank',
    },
  ],
};

export const footerData = {
  links: [
    {
      title: 'Sitio',
      links: [
        { text: 'Inicio', href: getPermalink('/') },
        { text: 'Sobre mí', href: getPermalink('/about') },
        { text: 'Blog', href: getBlogPermalink() },
        { text: 'Contacto', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Ámbitos',
      links: [
        { text: 'Academia', href: getPermalink('/academia') },
        { text: 'Desarrollo', href: getPermalink('/developer') },
        { text: 'Industria', href: getPermalink('/about') },
      ],
    },
    {
      title: 'Perfiles',
      links: [
        { text: 'LinkedIn', href: 'https://www.linkedin.com/in/carlosluengo' },
        { text: 'X', href: xUrl },
        { text: 'GitHub', href: 'https://github.com/Carluve' },
        {
          text: 'Google Scholar',
          href: 'https://scholar.google.es/citations?user=ikUrqYkAAAAJ',
        },
        { text: 'ORCID', href: orcidUrl },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Privacidad', href: getPermalink('/privacy') },
    { text: 'Aviso legal', href: getPermalink('/terms') },
  ],
  socialLinks: [
    { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
    {
      ariaLabel: 'LinkedIn',
      icon: 'tabler:brand-linkedin',
      href: 'https://www.linkedin.com/in/carlosluengo',
    },
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: xUrl },
    { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: 'https://github.com/Carluve' },
    { ariaLabel: 'ORCID iD', icon: 'orcid', href: orcidUrl },
  ],
  footNote: `
    © ${new Date().getFullYear()} <a class="text-link hover:underline" href="https://carlosluengo.com">Carlos Luengo Vera</a>
  `,
};
