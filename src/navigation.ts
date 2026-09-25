import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

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
        { text: 'GitHub', href: 'https://github.com/Carluve' },
        {
          text: 'Google Scholar',
          href: 'https://scholar.google.es/citations?user=ikUrqYkAAAAJ',
        },
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
    { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: 'https://github.com/Carluve' },
  ],
  footNote: `
    © ${new Date().getFullYear()} <a class="text-blue-600 underline dark:text-muted" href="https://carlosluengo.com">Carlos Luengo Vera</a> · Investigación · Docencia · Industria
  `,
};
