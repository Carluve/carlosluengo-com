/**
 * One source of truth about Carlos for structured data (JSON-LD), llms.txt and
 * the Markdown versions of the pages. Facts mirror the About and Academia pages.
 */
import type { Lang } from '~/i18n/ui';

export const SITE_URL = 'https://carlosluengo.com';
export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const person = {
  name: 'Carlos Luengo Vera',
  alternateName: ['Carlos Luengo', 'carluve'],
  jobTitle: 'Sr. Enterprise Account Executive',
  employer: { name: 'Cloudflare', url: 'https://www.cloudflare.com' },
  university: { name: 'Universidad de Alcalá', url: 'https://www.uah.es' },
  orcid: 'https://orcid.org/0009-0008-2591-1210',
  sameAs: [
    'https://www.linkedin.com/in/carlosluengo',
    'https://x.com/carluve',
    'https://github.com/Carluve',
    'https://scholar.google.es/citations?user=ikUrqYkAAAAJ',
    'https://orcid.org/0009-0008-2591-1210',
  ],
  knowsAbout: [
    'Generative AI',
    'Large language models',
    'AI adoption in organisations',
    'Management',
    'Cloud infrastructure',
    'Cloudflare Workers',
    'Edge computing',
    'Zero Trust',
    'Medical education and LLMs',
  ],
  summary: {
    es: 'Carlos Luengo Vera es doctorando en Inteligencia Artificial y Management en la Universidad de Alcalá, profesor en programas de posgrado y ejecutivos, y Sr. Enterprise Account Executive en Cloudflare, donde acompaña a empresas digitales nativas, startups e ISVs. Su investigación estudia el impacto económico y organizativo de los modelos de lenguaje. Antes trabajó en Microsoft, Insight, Telefónica, Lenovo y Amazon Web Services.',
    en: 'Carlos Luengo Vera is a PhD candidate in Artificial Intelligence and Management at Universidad de Alcalá, a lecturer in postgraduate and executive programmes, and a Sr. Enterprise Account Executive at Cloudflare, working with digital natives, startups and ISVs. His research studies the economic and organisational impact of large language models. He previously worked at Microsoft, Insight, Telefónica, Lenovo and Amazon Web Services.',
  } satisfies Record<Lang, string>,
};

export interface Publication {
  title: string;
  authors: string;
  date: string;
  venue: string;
  kind: 'preprint' | 'article' | 'conference' | 'book' | 'review';
  url?: string;
  doi?: string;
  note?: string;
}

export const publications: Publication[] = [
  {
    title:
      'Evaluating Large Language Models on the Spanish Medical Intern Resident (MIR) Examination 2024/2025: A Comparative Analysis of Clinical Reasoning and Knowledge Application',
    authors:
      'Carlos Luengo Vera, Ignacio Ferro Picón, M. Teresa del Val Nuñez, José Andrés Gómez Gandía, Antonio de Lucas Ancillo, Víctor Ramos Arroyo, Carlos Milán Figueredo',
    date: '2025-03-16',
    venue: 'arXiv',
    kind: 'preprint',
    url: 'https://arxiv.org/abs/2503.00025',
    doi: '10.48550/arXiv.2503.00025',
    note: 'Comparative analysis of 22 generative AI models in clinical reasoning across the MIR 2024/2025 exams.',
  },
  {
    title:
      'Generative AI and the Algorithmic Workplace: A Bibliometric and Conceptual Analysis of Its Impact on Organisational Decision-Making and Work Design',
    authors: 'Carlos Luengo Vera, Alnoor Bhimani, José Andrés Gómez Gandía, Antonio de Lucas',
    date: '2025-12-26',
    venue: 'Journal of Open Innovation: Technology, Market, and Complexity (Elsevier), 100710',
    kind: 'article',
  },
  {
    title: 'Geopolitical crises and the transformation of work models: a bibliometric analysis (2000-2025)',
    authors: 'Carlos Luengo Vera, José Andrés Gómez Gandía, Antonio Javier De Lucas López, Ma. Teresa de Val Núñez',
    date: '2025-11-10',
    venue: 'International Journal of Environment, Workplace and Employment, Vol. 9, No. 3, pp. 270-297',
    kind: 'article',
    url: 'https://www.inderscienceonline.com/doi/abs/10.1504/IJEWE.2025.149704',
    doi: '10.1504/IJEWE.2025.149704',
  },
  {
    title: 'Optimising AI in Medical Education: Cost-Benefit Analysis of Large Language Models in the MIR Examination',
    authors: 'Carlos Luengo Vera, Antonio J. de Lucas López, Víctor Ramos Arroyo, M. Teresa de Val Núñez',
    date: '2025-05-08',
    venue: '8th International Scientific Conference on Business and Economics (ISCBE), Tetovo, North Macedonia',
    kind: 'conference',
    url: 'https://link.springer.com/book/9783032042170',
    note: 'Chapter in Economic Resilience and Sustainability, Vol. 1 (Springer Proceedings in Business and Economics, 2025).',
  },
  {
    title:
      'The Synergy between Green Marketing, Innovation, and Sustainability-Enhancing Green Brand Equity and Corporate Social Responsibility',
    authors: 'José Andrés Gómez Gandía, Carlos Luengo Vera, Antonio Javier De Lucas López',
    date: '2025-09-11',
    venue: 'JOINETECH (International Journal of Economic and Technological Studies), Vol. 1, Issue 01, pp. 76-89',
    kind: 'article',
  },
  {
    title: 'Impact of Generative AI on Workplace Productivity and Employee Well-being',
    authors: 'Carlos Luengo Vera, Antonio J. de Lucas López, Arturo Orea Rocha, María Teresa del Val Núñez',
    date: '2024-11-22',
    venue: '8th International Academic and Professional Congress on Happiness, Málaga',
    kind: 'conference',
    note: 'Best presentation award. Manuscript under review.',
  },
];

/** schema.org Person, referenced by @id from every page. */
export const personSchema = (image?: string) => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: person.name,
  alternateName: person.alternateName,
  url: SITE_URL,
  ...(image ? { image } : {}),
  jobTitle: person.jobTitle,
  worksFor: { '@type': 'Organization', name: person.employer.name, url: person.employer.url },
  affiliation: { '@type': 'CollegeOrUniversity', name: person.university.name, url: person.university.url },
  knowsAbout: person.knowsAbout,
  identifier: { '@type': 'PropertyValue', propertyID: 'ORCID', value: person.orcid },
  sameAs: person.sameAs,
  description: person.summary.en,
});

export const publicationSchema = (p: Publication) => ({
  '@type': p.kind === 'book' ? 'Book' : 'ScholarlyArticle',
  headline: p.title,
  name: p.title,
  datePublished: p.date,
  author: p.authors
    .split(', ')
    .map((name) => (name === person.name ? { '@id': PERSON_ID } : { '@type': 'Person', name })),
  isPartOf: p.venue,
  ...(p.url ? { url: p.url } : {}),
  ...(p.doi ? { sameAs: `https://doi.org/${p.doi}` } : {}),
});
