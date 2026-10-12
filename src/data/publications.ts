export type PublicationStatus = 'Publicado' | 'Preprint' | 'En revisión' | 'Reseña';

export interface PublicationLink {
  label: string;
  href: string;
}

export interface Publication {
  date: string;
  title: string;
  detail: string;
  venue: string;
  status: PublicationStatus;
  links?: PublicationLink[];
}

const paperTitle =
  'Evaluating Large Language Models on the Spanish Medical Intern Resident (MIR) Examination 2024/2025: A Comparative Analysis of Clinical Reasoning and Knowledge Application';

/** Eight records from the publication register. Google Scholar stays a profile link, not a ninth row. */
export const publications: Publication[] = [
  {
    date: '2025-03-16',
    title: paperTitle,
    detail:
      'Carlos Luengo Vera, Ignacio Ferro Picón, M. Teresa del Val Nuñez, José Andrés Gómez Gandía, Antonio de Lucas Ancillo, Víctor Ramos Arroyo y Carlos Milán Figueredo. Comparative analysis of 22 generative AI models in clinical reasoning and performance across the MIR 2024/2025 medical exams. DOI: 10.48550/arXiv.2503.00025.',
    venue: 'arXiv',
    status: 'Preprint',
    links: [
      { label: 'PDF en arXiv', href: 'https://arxiv.org/pdf/2503.00025' },
      { label: 'Resumen en arXiv', href: 'https://arxiv.org/abs/2503.00025' },
    ],
  },
  {
    date: '2025-12-26',
    title:
      'Generative AI and the Algorithmic Workplace: A Bibliometric and Conceptual Analysis of Its Impact on Organisational Decision-Making and Work Design',
    detail:
      'Carlos Luengo Vera, Alnoor Bhimani, José Andrés Gómez Gandía y Antonio de Lucas (2025). Journal of Open Innovation: Technology, Market, and Complexity, 100710. Elsevier.',
    venue: 'Journal of Open Innovation',
    status: 'Publicado',
  },
  {
    date: '2025-11-15',
    title:
      'Economic Resilience and Sustainability—Vol. 1: 8th International Scientific Conference on Business and Economics (ISCBE), Tetovo, North Macedonia, May 2025',
    detail:
      'Ramadani, V., Bexheti, A., Abazi-Alili, H., Theodoraki, C., Rexhepi, G. y Krasniqi, B. A. (Eds.) (2025). Springer Nature Switzerland AG. El volumen incluye el capítulo sobre el análisis coste-beneficio de modelos de lenguaje en el MIR.',
    venue: 'Springer',
    status: 'Publicado',
    links: [{ label: 'Springer', href: 'https://link.springer.com/book/9783032042170' }],
  },
  {
    date: '2025-11-10',
    title: 'Geopolitical crises and the transformation of work models: a bibliometric analysis (2000-2025)',
    detail:
      'Carlos Luengo Vera, José Andrés Gómez Gandía, Antonio Javier De Lucas López y Ma. Teresa de Val Núñez (2025). Vol. 9, No. 3, pp. 270-297.',
    venue: 'IJEWE',
    status: 'Publicado',
    links: [
      {
        label: 'Inderscience',
        href: 'https://www.inderscienceonline.com/doi/abs/10.1504/IJEWE.2025.149704',
      },
    ],
  },
  {
    date: '2025-09-21',
    title: 'Innovation and Circular Economy: New Findings on How Innovation Drives the Circular Economy',
    detail:
      'Reseña del artículo “Innovation and Circular Economy within the Sustainable …” (Elsevier, 2025) sobre cómo la innovación sostiene las prácticas de economía circular. La ficha no incluye un enlace ni una cita bibliográfica completa.',
    venue: 'Reseña',
    status: 'Reseña',
  },
  {
    date: '2025-09-11',
    title:
      'The Synergy between Green Marketing, Innovation, and Sustainability-Enhancing Green Brand Equity and Corporate Social Responsibility',
    detail:
      'José Andrés Gómez Gandía, Carlos Luengo Vera y Antonio Javier De Lucas López (2025). JOINETECH (International Journal of Economic and Technological Studies), Vol. 1, Issue 01, pp. 76-89.',
    venue: 'JOINETECH',
    status: 'Publicado',
    links: [
      {
        label: 'Google Scholar',
        href: 'https://scholar.google.es/citations?view_op=view_citation&hl=en&user=ikUrqYkAAAAJ&citation_for_view=ikUrqYkAAAAJ:IjCSPb-OGe4C',
      },
    ],
  },
  {
    date: '2025-05-08',
    title: 'Optimising AI in Medical Education: Cost-Benefit Analysis of Large Language Models in the MIR Examination',
    detail:
      'Carlos Luengo Vera, Antonio J. de Lucas López, Víctor Ramos Arroyo y M. Teresa de Val Núñez (2025). Comunicación en el 8th ISCBE (Tetovo, 08–09 May 2025). La ficha lo registra como manuscrito en revisión para las actas de Springer.',
    venue: '8th ISCBE',
    status: 'En revisión',
  },
  {
    date: '2024-11-22',
    title: 'Impact of Generative AI on Workplace Productivity and Employee Well-being',
    detail:
      'Carlos Luengo Vera, Antonio J. de Lucas López, Arturo Orea Rocha y María Teresa del Val Núñez (2024). Comunicación en el 8th International Academic and Professional Congress on Happiness (Málaga, 21–22 Nov 2024). La ficha lo registra como manuscrito en revisión.',
    venue: 'Congreso de la Felicidad',
    status: 'En revisión',
  },
];

export const scholarUrl = 'https://scholar.google.es/citations?user=ikUrqYkAAAAJ';
