/**
 * Public projects shown on /developer. Only entries whose demo or repository
 * is reachable are listed. `basedOn` credits the original author of a fork.
 * `slug` doubles as the anchor that the old /blog/<slug> pages redirect to.
 */
export interface Project {
  slug: string;
  title: string;
  description: string;
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
    description:
      'Port del MMO en HTML5 de Mozilla a Cloudflare Workers: Durable Objects con SQLite, WebSockets con hibernación y el bucle de juego en Alarms.',
    year: 2026,
    tags: ['Workers', 'Durable Objects', 'WebSockets'],
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
    year: 2026,
    tags: ['EmDash', 'Zero Trust'],
    image: 'media:blog/catalogo-de-demos/emdash-blog.png',
    demo: 'https://emdash-blog.carluve.workers.dev',
    post: '/blog/emdash-y-zero-trust/',
    basedOn: { name: 'emdash-cms/emdash', url: 'https://github.com/emdash-cms/emdash' },
  },
  {
    slug: 'timercf',
    title: 'TimerCF',
    description: 'Cuenta atrás para eventos y clases, desplegada en Workers, con una variante para el aula.',
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
    year: 2026,
    tags: ['Cloudflare', 'Comunidad'],
    repo: 'https://github.com/Carluve/vibe-coding-spanish',
  },
  {
    slug: 'dns-discovery',
    title: 'DNS Discovery',
    description: 'Herramienta de exploración DNS publicada en Workers.',
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
    year: 2024,
    tags: ['TypeScript', 'Juegos'],
    demo: 'https://duckmarines-worker.carluve.workers.dev',
    repo: 'https://github.com/Carluve/duckmarines_ts',
    basedOn: { name: 'SimonLarsen/duckmarines', url: 'https://github.com/SimonLarsen/duckmarines' },
  },
  {
    slug: '1-2-3-math',
    title: '1-2-3 Math',
    description: 'Juego web para que los más pequeños practiquen sumas y restas con retos cortos y cronometrados.',
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
    year: 2025,
    tags: ['Educación', 'Juegos'],
    image: 'media:blog/catalogo-de-demos/memory-animales.png',
    demo: 'https://memory-animales.carluve.workers.dev',
  },
  {
    slug: 'provincias-capitales',
    title: 'Provincias y capitales',
    description: 'Juego educativo para practicar las provincias y capitales de España.',
    year: 2024,
    tags: ['Educación', 'Juegos'],
    image: 'media:blog/catalogo-de-demos/provincias-capitales.png',
    demo: 'https://provincias-capitales.carluve.workers.dev',
  },
  {
    slug: 'form-event',
    title: 'Form Event',
    description: 'Formulario de inscripción para eventos, sin servidor, sobre Workers.',
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
    year: 2025,
    tags: ['Vibe coding', 'Web'],
    repo: 'https://github.com/Carluve/vibe-coding-example',
  },
  {
    slug: 'curso-aws-partyrock',
    title: 'Taller de PartyRock',
    description:
      'Curso para crear aplicaciones de IA generativa sin código con Amazon Bedrock y PartyRock, pensado para organizaciones sin ánimo de lucro.',
    tags: ['IA generativa', 'Formación'],
    pdf: 'media:files/npo-partyrock-workshop.pdf',
  },
  {
    slug: 'carlosluengo-com',
    title: 'carlosluengo.com',
    description: 'Este sitio: Astro y Tailwind sobre Cloudflare Workers, con las imágenes optimizadas en R2.',
    year: 2026,
    tags: ['Astro', 'Workers', 'R2'],
    repo: 'https://github.com/Carluve/carlosluengo-com',
  },
  {
    slug: 'focairemover',
    title: 'FocAIRemover',
    description:
      'Prototipo de investigación en Workers que detecta y retira marcas de procedencia de IA verificables, como Unicode invisible y metadatos.',
    year: 2026,
    tags: ['Workers', 'TypeScript', 'Investigación'],
    repo: 'https://github.com/Carluve/FocAIRemover',
  },
];
