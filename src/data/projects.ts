/**
 * Public projects shown on /developer. Only entries whose demo or repository
 * is reachable are listed. `basedOn` credits the original author of a fork.
 * `slug` doubles as the anchor that the old /blog/<slug> pages redirect to.
 */
export interface Project {
  slug: string;
  title: string;
  description: string;
  titleEn?: string;
  descriptionEn?: string;
  year?: number;
  tags: string[];
  image?: string;
  demo?: string;
  repo?: string;
  post?: string;
  pdf?: string;
  basedOn?: { name: string; url: string };
  featured?: boolean;
}

export const projects: Project[] = [
  {
    slug: 'browserquest',
    title: 'BrowserQuest en Workers',
    titleEn: 'BrowserQuest on Workers',
    description:
      'Port del MMO en HTML5 de Mozilla a Cloudflare Workers: Durable Objects con SQLite, WebSockets con hibernación y el bucle de juego en Alarms.',
    descriptionEn:
      "Port of Mozilla's HTML5 MMO to Cloudflare Workers: Durable Objects with SQLite, hibernating WebSockets and the game loop on Alarms.",
    year: 2026,
    tags: ['Workers', 'Durable Objects', 'WebSockets'],
    image: 'media:projects/browserquest.png',
    demo: 'https://browserquest.carluve.workers.dev',
    repo: 'https://github.com/Carluve/BrowserQuest',
    basedOn: { name: 'mozilla/BrowserQuest', url: 'https://github.com/mozilla/BrowserQuest' },
    featured: true,
  },
  {
    slug: 'quien-quiere-ser-millonario',
    title: '¿Quién quiere ser millonario?',
    description:
      'Juego de educación financiera inspirado en el concurso, con comodines y un asistente de IA. Workers, D1, KV y RAG.',
    titleEn: 'Who Wants to Be a Millionaire?',
    descriptionEn:
      'Financial literacy game inspired by the TV quiz show, with lifelines and an AI assistant. Workers, D1, KV and RAG.',
    year: 2025,
    tags: ['Workers', 'D1', 'RAG'],
    image: 'media:blog/catalogo-de-demos/millonario.png',
    demo: 'https://millonario.carluve.workers.dev',
    repo: 'https://github.com/Carluve/millonario-cf',
    featured: true,
  },
  {
    slug: 'retroworkers',
    title: 'RetroWorkers',
    description:
      'Juegos clásicos servidos desde Workers, cada uno en su subdominio: Arkanoid, Tetris, Snake y Buscaminas. Arkanoid se migró de C++/SFML a TypeScript en una sola sesión de vibe coding.',
    descriptionEn:
      'Classic games served from Workers, each on its own subdomain: Arkanoid, Tetris, Snake and Minesweeper. Arkanoid was migrated from C++/SFML to TypeScript in a single vibe coding session.',
    year: 2025,
    tags: ['Workers', 'TypeScript', 'Juegos'],
    image: 'media:blog/catalogo-de-demos/retroworkers-home.png',
    demo: 'https://www.retroworkers.com',
    repo: 'https://github.com/Carluve/arkanoidcpp2ts',
    basedOn: { name: 'Kttra/RetroGamesCplus', url: 'https://github.com/Kttra/RetroGamesCplus' },
    featured: true,
  },
  {
    slug: 'emdash',
    title: 'Blog en EmDash',
    description: 'Despliegue del CMS EmDash sobre Workers con acceso protegido por Zero Trust, documentado en el blog.',
    titleEn: 'EmDash blog',
    descriptionEn:
      'Deployment of the EmDash CMS on Workers with access protected by Zero Trust, documented on the blog.',
    year: 2026,
    tags: ['EmDash', 'Zero Trust'],
    image: 'media:projects/emdash.png',
    demo: 'https://emdash-blog.carluve.workers.dev',
    post: '/blog/emdash-y-zero-trust/',
    basedOn: { name: 'emdash-cms/emdash', url: 'https://github.com/emdash-cms/emdash' },
  },
  {
    slug: 'timercf',
    title: 'TimerCF',
    description: 'Cuenta atrás para eventos y clases, desplegada en Workers, con una variante para el aula.',
    descriptionEn: 'Countdown timer for events and classes, deployed on Workers, with a classroom variant.',
    year: 2024,
    tags: ['Workers', 'Eventos'],
    image: 'media:blog/catalogo-de-demos/timercf.png',
    demo: 'https://timercf.carluve.workers.dev',
    post: '/blog/timercf/',
  },
  {
    slug: 'cloudflare-demos-es',
    title: 'Cloudflare Demos ES',
    description: 'Demos y ejemplos en español para explicar casos de uso de Cloudflare.',
    descriptionEn: 'Spanish-language demos and examples that explain Cloudflare use cases.',
    year: 2025,
    tags: ['Cloudflare', 'Demos'],
    image: 'media:blog/catalogo-de-demos/cloudflare-demos-es.png',
    demo: 'https://cloudflare-demos-es.carluve.workers.dev',
  },
  {
    slug: 'cloudflare-en-espanol',
    title: 'Cloudflare en Español',
    description:
      'Índice comunitario de recursos de Cloudflare en español: repositorios oficiales, documentación y guías prácticas.',
    descriptionEn:
      'Community index of Spanish-language Cloudflare resources: official repositories, documentation and hands-on guides.',
    year: 2026,
    tags: ['Cloudflare', 'Comunidad'],
    image: 'media:projects/cloudflare-en-espanol-github.png',
    repo: 'https://github.com/Carluve/vibe-coding-spanish',
  },
  {
    slug: 'dns-discovery',
    title: 'DNS Discovery',
    description: 'Herramienta de exploración DNS publicada en Workers.',
    descriptionEn: 'DNS exploration tool published on Workers.',
    year: 2025,
    tags: ['DNS', 'Workers'],
    image: 'media:blog/catalogo-de-demos/dns-discovery.png',
    demo: 'https://dns-discovery.carluve.workers.dev',
  },
  {
    slug: 'foca',
    title: 'FOCA Web',
    description:
      'Versión web y serverless de FOCA, la herramienta de ElevenPaths para encontrar metadatos e información oculta en documentos.',
    descriptionEn:
      'Web-based, serverless version of FOCA, the ElevenPaths tool for finding metadata and hidden information in documents.',
    year: 2025,
    tags: ['Seguridad', 'Workers'],
    image: 'media:blog/catalogo-de-demos/foca-web.png',
    demo: 'https://foca-web.carluve.workers.dev',
    repo: 'https://github.com/Carluve/FOCA_VC',
    basedOn: { name: 'ElevenPaths/FOCA', url: 'https://github.com/ElevenPaths/FOCA' },
  },
  {
    slug: 'space-shooter',
    title: 'Space Shooter',
    description: 'El clásico de naves, reescrito en TypeScript a partir de la versión en Python con Pygame.',
    descriptionEn: 'The classic space shooter, rewritten in TypeScript from the Python/Pygame version.',
    year: 2025,
    tags: ['TypeScript', 'Juegos'],
    image: 'media:blog/catalogo-de-demos/space-shooter.png',
    demo: 'https://space-shooter.carluve.workers.dev',
    repo: 'https://github.com/Carluve/spaceShooter_ts',
    basedOn: { name: 'tasdikrahman/spaceShooter', url: 'https://github.com/tasdikrahman/spaceShooter' },
  },
  {
    slug: 'duck-marines',
    title: 'Duck Marines',
    description: 'Adaptación a TypeScript de Duck Marines, un remake libre de ChuChu Rocket.',
    descriptionEn: 'TypeScript adaptation of Duck Marines, a free remake of ChuChu Rocket.',
    year: 2024,
    tags: ['TypeScript', 'Juegos'],
    repo: 'https://github.com/Carluve/duckmarines_ts',
    basedOn: { name: 'SimonLarsen/duckmarines', url: 'https://github.com/SimonLarsen/duckmarines' },
  },
  {
    slug: '1-2-3-math',
    title: '1-2-3 Math',
    description: 'Juego web para que los más pequeños practiquen sumas y restas con retos cortos y cronometrados.',
    descriptionEn: 'Web game for young children to practise addition and subtraction with short, timed challenges.',
    year: 2025,
    tags: ['React', 'Educación'],
    image: 'media:blog/123-math/202505_math.png',
    demo: 'https://1-2-3-math.vercel.app',
    post: '/blog/123-math/',
  },
  {
    slug: '1-2-3-logic',
    title: '1-2-3 Logic',
    description: 'Puzles visuales con emojis para trabajar la lógica y el razonamiento en edades tempranas.',
    descriptionEn: 'Visual emoji puzzles to build logic and reasoning skills at an early age.',
    year: 2025,
    tags: ['React', 'Educación'],
    image: 'media:blog/123-logic/202505_logic.png',
    demo: 'https://1-2-3-logic.vercel.app',
    post: '/blog/123-logic/',
  },
  {
    slug: 'memory-animales',
    title: 'Memory de animales',
    description: 'Juego de memoria con animales para practicar en clase.',
    titleEn: 'Animal memory game',
    descriptionEn: 'Animal-themed memory game for practising in class.',
    year: 2025,
    tags: ['Educación', 'Juegos'],
    image: 'media:blog/catalogo-de-demos/memory-animales.png',
    demo: 'https://memory-animales.carluve.workers.dev',
  },
  {
    slug: 'provincias-capitales',
    title: 'Provincias y capitales',
    description: 'Juego educativo para practicar las provincias y capitales de España.',
    titleEn: 'Spanish provinces and capitals',
    descriptionEn: 'Educational game for practising the provinces and capitals of Spain.',
    year: 2024,
    tags: ['Educación', 'Juegos'],
    image: 'media:blog/catalogo-de-demos/provincias-capitales.png',
    demo: 'https://provincias-capitales.carluve.workers.dev',
  },
  {
    slug: 'form-event',
    title: 'Form Event',
    description: 'Formulario de inscripción para eventos, sin servidor, sobre Workers.',
    descriptionEn: 'Serverless event registration form on Workers.',
    year: 2024,
    tags: ['Workers', 'Formularios'],
    image: 'media:blog/catalogo-de-demos/form-event.png',
    demo: 'https://form-event.carluve.workers.dev',
  },
  {
    slug: 'vibe-coding-example',
    title: 'Vibe Coding Example',
    description:
      'Pequeños proyectos web hechos con vibe coding: un tres en raya online, un Snake ochentero y otros ejercicios de interfaz.',
    descriptionEn:
      'Small web projects built with vibe coding: an online noughts and crosses, an eighties-style Snake and other interface exercises.',
    year: 2025,
    tags: ['Vibe coding', 'Web'],
    image: 'media:projects/vibe-coding-example-github.png',
    repo: 'https://github.com/Carluve/vibe-coding-example',
  },
  {
    slug: 'curso-aws-partyrock',
    title: 'Taller de PartyRock',
    description:
      'Curso para crear aplicaciones de IA generativa sin código con Amazon Bedrock y PartyRock, pensado para organizaciones sin ánimo de lucro.',
    titleEn: 'PartyRock workshop',
    descriptionEn:
      'Course on building no-code generative AI applications with Amazon Bedrock and PartyRock, designed for non-profit organisations.',
    year: 2025,
    tags: ['IA generativa', 'Formación'],
    image: 'media:projects/curso-aws-partyrock.png',
    pdf: 'media:files/npo-partyrock-workshop.pdf',
  },
  {
    slug: 'carlosluengo-com',
    title: 'carlosluengo.com',
    description: 'Este sitio: Astro y Tailwind sobre Cloudflare Workers, con las imágenes optimizadas en R2.',
    descriptionEn: 'This site: Astro and Tailwind on Cloudflare Workers, with images optimised in R2.',
    year: 2026,
    tags: ['Astro', 'Workers', 'R2'],
    image: 'media:projects/carlosluengo-com-github.png',
    repo: 'https://github.com/Carluve/carlosluengo-com',
  },
  {
    slug: 'focairemover',
    title: 'FocAIRemover',
    description:
      'Prototipo de investigación en Workers que detecta y retira marcas de procedencia de IA verificables, como Unicode invisible y metadatos.',
    descriptionEn:
      'Research prototype on Workers that detects and removes verifiable AI provenance marks, such as invisible Unicode and metadata.',
    year: 2026,
    tags: ['Workers', 'TypeScript', 'Investigación'],
    image: 'media:projects/focairemover-github.png',
    repo: 'https://github.com/Carluve/FocAIRemover',
    basedOn: { name: 'guillaumemeyer/watermarks-remover', url: 'https://github.com/guillaumemeyer/watermarks-remover' },
  },
];
