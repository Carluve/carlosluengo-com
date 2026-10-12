/**
 * Organisations in Carlos's career, newest first, with their official logos
 * (src/assets/logos; sources in src/assets/logos/SOURCES.md). Roles repeat the
 * wording of the About page; no dates are published on the site.
 */
import type { ImageMetadata } from 'astro';
import cloudflare from '~/assets/logos/cloudflare.svg';
import aws from '~/assets/logos/aws.svg';
import lenovo from '~/assets/logos/lenovo.svg';
import telefonica from '~/assets/logos/telefonica.svg';
import insight from '~/assets/logos/insight.svg';
import microsoft from '~/assets/logos/microsoft.svg';
import uah from '~/assets/logos/uah.png';

export interface CareerEntry {
  slug: string;
  name: string;
  logo: ImageMetadata;
  /** Width / height of the logo artwork, used to give every logo the same optical area. */
  aspect: number;
  /** Optical correction for logos with fine detail (small type, a crest). */
  scale?: number;
  kind: 'industry' | 'academia';
  current?: boolean;
  url: string;
  role: { es: string; en: string };
}

export const career: CareerEntry[] = [
  {
    slug: 'cloudflare',
    name: 'Cloudflare',
    logo: cloudflare,
    aspect: 3.03,
    scale: 1.25,
    kind: 'industry',
    current: true,
    url: 'https://www.cloudflare.com',
    role: {
      es: 'Sr. Enterprise Account Executive. Cuentas de empresas digitales nativas, startups e ISVs.',
      en: 'Sr. Enterprise Account Executive for digital natives, startups and ISVs.',
    },
  },
  {
    slug: 'uah',
    name: 'Universidad de Alcalá',
    logo: uah,
    aspect: 3.78,
    scale: 1.45,
    kind: 'academia',
    current: true,
    url: 'https://www.uah.es',
    role: {
      es: 'Doctorando en Inteligencia Artificial y Management.',
      en: 'PhD candidate in Artificial Intelligence and Management.',
    },
  },
  {
    slug: 'aws',
    name: 'Amazon Web Services',
    logo: aws,
    aspect: 1.67,
    kind: 'industry',
    url: 'https://aws.amazon.com',
    role: {
      es: 'Dirección de cuentas y soluciones cloud para clientes de empresa y del canal de partners.',
      en: 'Account management and cloud solutions for enterprise customers and the partner channel.',
    },
  },
  {
    slug: 'lenovo',
    name: 'Lenovo',
    logo: lenovo,
    aspect: 4.76,
    kind: 'industry',
    url: 'https://www.lenovo.com',
    role: {
      es: 'Funciones comerciales y de ecosistema en infraestructura y dispositivos.',
      en: 'Sales and ecosystem roles in infrastructure and devices.',
    },
  },
  {
    slug: 'telefonica',
    name: 'Telefónica',
    logo: telefonica,
    aspect: 4.17,
    kind: 'industry',
    url: 'https://www.telefonica.com',
    role: {
      es: 'Relación con clientes en telecomunicaciones y servicios cloud.',
      en: 'Customer relationships in telecoms and cloud services.',
    },
  },
  {
    slug: 'insight',
    name: 'Insight',
    logo: insight,
    aspect: 2.43,
    kind: 'industry',
    url: 'https://www.insight.com',
    role: { es: 'Soluciones tecnológicas para empresas.', en: 'Technology solutions for businesses.' },
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    logo: microsoft,
    aspect: 4.69,
    kind: 'industry',
    url: 'https://www.microsoft.com',
    role: {
      es: 'Inicios de la carrera, en evangelismo técnico del ecosistema Microsoft.',
      en: 'Early career in technical evangelism for the Microsoft ecosystem.',
    },
  },
];

/** Height in px that gives a logo of this aspect the same visual area as a 3:1 logo `base` px tall. */
export const opticalHeight = (aspect: number, base = 30, scale = 1) => Math.round(base * scale * Math.sqrt(3 / aspect));
