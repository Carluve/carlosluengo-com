import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    { text: 'Home', href: getPermalink('/') },
    { text: 'About', href: getPermalink('/about') },
    { text: 'Blog', href: getBlogPermalink() },
    { text: 'Academia', href: getPermalink('/academia') },
    { text: 'Developer', href: getPermalink('/developer') },
    { text: 'Contact', href: getPermalink('/contact') },
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
      title: 'Explorar',
      links: [
        { text: 'Home', href: getPermalink('/') },
        { text: 'About', href: getPermalink('/about') },
        { text: 'Blog', href: getBlogPermalink() },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Pilares',
      links: [
        { text: 'Academia', href: getPermalink('/academia') },
        { text: 'Developer', href: getPermalink('/developer') },
        { text: 'Industria', href: getPermalink('/about') },
      ],
    },
    {
      title: 'Enlaces',
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
    { text: 'Términos', href: getPermalink('/terms') },
  ],
  socialLinks: [
    { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
    {
      ariaLabel: 'LinkedIn',
      icon: 'tabler:brand-linkedin',
      href: 'https://www.linkedin.com/in/carlosluengo',
    },
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/Carluve' },
  ],
  footNote: `
    © ${new Date().getFullYear()} <a class="text-blue-600 underline dark:text-muted" href="https://carlosluengo.com">Carlos Luengo</a> · Industria · Academia · Build
  `,
};
