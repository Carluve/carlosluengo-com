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
  /** Date of first publication (online first where there is one), YYYY-MM-DD. */
  date: string;
  /** Year of the issue or volume, used to group the list. */
  year: number;
  venue: string;
  kind: 'preprint' | 'article' | 'conference' | 'chapter' | 'book' | 'review';
  url?: string;
  doi?: string;
  note?: string;
  noteEs?: string;
  /** Part of the doctoral thesis by compendium (Universidad de Alcalá). */
  thesis?: boolean;
}

/** Source: ORCID 0009-0008-2591-1210 and Crossref, checked 2026-11-22. Newest first. */
export const publications: Publication[] = [
  {
    title:
      'From firm-centric to societal: the conceptual evolution of innovation and knowledge management research (2003–2025)',
    authors: 'María Teresa de Val Núñez, Carlos Luengo Vera, José Andrés Gómez Gandía',
    date: '2026-11-17',
    year: 2026,
    venue: 'European Journal of Innovation Management (Emerald), pp. 1–28',
    kind: 'article',
    doi: '10.1108/EJIM-06-2026-0869',
    note: 'Online first.',
    noteEs: 'Publicado en línea (online first).',
  },
  {
    title:
      'Artificial intelligence as a catalyst for the circular economy: a mixed-methods analysis of sustainable production ecosystems (2023–2024)',
    authors: 'Antonio Javier de Lucas López, Carlos Luengo Vera, Ángel Javier Álvarez Miguel',
    date: '2026-03-17',
    year: 2026,
    venue: 'International Entrepreneurship and Management Journal (Springer), Vol. 22, No. 2, article 59',
    kind: 'article',
    doi: '10.1007/s11365-026-01176-y',
    thesis: true,
  },
  {
    title:
      'Generative AI and the Algorithmic Workplace: A Bibliometric and Conceptual Analysis of Its Impact on Organisational Decision-Making and Work Design',
    authors: 'Carlos Luengo Vera, Alnoor Bhimani, José Andrés Gómez Gandía, Antonio de Lucas',
    date: '2025-12-26',
    year: 2026,
    venue: 'Journal of Open Innovation: Technology, Market, and Complexity (Elsevier), Vol. 12, No. 1, 100710',
    kind: 'article',
    doi: '10.1016/j.joitmc.2025.100710',
    thesis: true,
  },
  {
    title:
      'Innovation and circular economy within the sustainable development goals: A bibliometric and conceptual analysis',
    authors: 'Carlos Luengo Vera, José Andrés Gómez Gandía, Antonio de Lucas Ancillo, María Teresa del Val Núñez',
    date: '2025-12-01',
    year: 2025,
    venue: 'Global Economics Research (Elsevier), Vol. 1, No. 2, 100011',
    kind: 'article',
    doi: '10.1016/j.ecores.2025.100011',
  },
  {
    title: 'Optimizing AI in Medical Education: Cost-Benefit Analysis of Large Language Models in the MIR Examination',
    authors: 'Carlos Luengo Vera, Antonio Javier De Lucas López, Víctor Ramos Arroyo, M. Teresa de Val Núñez',
    date: '2025-11-15',
    year: 2025,
    venue:
      'Economic Resilience and Sustainability, Vol. 1 (Springer Proceedings in Business and Economics), chapter 28, pp. 451–473',
    kind: 'chapter',
    doi: '10.1007/978-3-032-04218-7_28',
    note: 'Presented at the 8th International Scientific Conference on Business and Economics (ISCBE), Tetovo, May 2025.',
    noteEs:
      'Presentado en la 8.ª International Scientific Conference on Business and Economics (ISCBE), Tetovo, mayo de 2025.',
    thesis: true,
  },
  {
    title: 'Geopolitical crises and the transformation of work models: a bibliometric analysis (2000-2025)',
    authors: 'Carlos Luengo Vera, José Andrés Gómez Gandía, Antonio Javier De Lucas López, Ma. Teresa de Val Núñez',
    date: '2025-11-10',
    year: 2025,
    venue: 'International Journal of Environment, Workplace and Employment (Inderscience), Vol. 9, No. 3, pp. 270-297',
    kind: 'article',
    doi: '10.1504/IJEWE.2025.149704',
  },
  {
    title:
      'The Synergy between Green Marketing, Innovation, and Sustainability-Enhancing Green Brand Equity and Corporate Social Responsibility',
    authors: 'José Andrés Gómez Gandía, Carlos Luengo Vera, Antonio Javier De Lucas López',
    date: '2025-09-11',
    year: 2025,
    venue: 'JOINETECH (International Journal of Economic and Technological Studies), Vol. 1, Issue 01, pp. 76-89',
    kind: 'article',
    doi: '10.65479/joinetech.19',
  },
  {
    title:
      'Evaluating Large Language Models on the Spanish Medical Intern Resident (MIR) Examination 2024/2025: A Comparative Analysis of Clinical Reasoning and Knowledge Application',
    authors:
      'Carlos Luengo Vera, Ignacio Ferro Picón, M. Teresa del Val Nuñez, José Andrés Gómez Gandía, Antonio de Lucas Ancillo, Víctor Ramos Arroyo, Carlos Milán Figueredo',
    date: '2025-03-16',
    year: 2025,
    venue: 'arXiv',
    kind: 'preprint',
    url: 'https://arxiv.org/abs/2503.00025',
    doi: '10.48550/arXiv.2503.00025',
    note: 'Comparative analysis of 22 generative AI models in clinical reasoning across the MIR 2024/2025 exams.',
    noteEs: 'Comparativa de 22 modelos de IA generativa en razonamiento clínico en el examen MIR 2024/2025.',
  },
  {
    title: 'Impact of Generative AI on Workplace Productivity and Employee Well-being',
    authors: 'Carlos Luengo Vera, Antonio J. de Lucas López, Arturo Orea Rocha, María Teresa del Val Núñez',
    date: '2024-11-22',
    year: 2024,
    venue: '8th International Academic and Professional Congress on Happiness, Málaga',
    kind: 'conference',
    note: 'Best presentation award. Manuscript under review.',
    noteEs: 'Premio a la mejor comunicación. Manuscrito en revisión.',
  },
];

/** Link for a publication: its DOI when it has one, otherwise its URL. */
export const publicationHref = (p: Publication) => (p.doi ? `https://doi.org/${p.doi}` : p.url);

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
  '@type': p.kind === 'book' ? 'Book' : p.kind === 'chapter' ? 'Chapter' : 'ScholarlyArticle',
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
