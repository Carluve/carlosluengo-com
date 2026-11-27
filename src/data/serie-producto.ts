/**
 * Serie Producto: product management in 10 parts, one a week.
 * Same rules as src/data/serie-cloudflare.ts: `slug: null` means "coming soon".
 */

export const serieProducto = {
  id: 'producto',
  name: 'Serie Producto',
  tag: 'serie-producto',
  path: '/serie-producto',
  total: 10,
  icon: 'tabler:bulb',
  blocks: [
    { id: 'fundamentos', title: 'Fundamentos', titleEn: 'Foundations' },
    { id: 'descubrir', title: 'Descubrir y decidir', titleEn: 'Discover and decide' },
    { id: 'construir', title: 'Construir y lanzar', titleEn: 'Build and launch' },
  ],
  partes: [
    {
      part: 1,
      title: 'Qué hace de verdad un product manager',
      block: 'fundamentos',
      slug: 'producto-que-hace-un-product-manager',
    },
    {
      part: 2,
      title: 'Claridad extrema: escribir para que nadie tenga que adivinar',
      block: 'fundamentos',
      slug: 'producto-claridad-extrema',
    },
    {
      part: 3,
      title: 'El documento de referencia único',
      block: 'fundamentos',
      slug: 'producto-documento-de-referencia-unico',
    },
    {
      part: 4,
      title: 'Del problema a la apuesta: cómo priorizar',
      block: 'descubrir',
      slug: 'producto-como-priorizar',
    },
    {
      part: 5,
      title: 'Métricas que importan: activación, retención y métrica norte',
      block: 'descubrir',
      slug: 'producto-metricas-que-importan',
    },
    { part: 6, title: 'Hablar con usuarios sin sesgarles', block: 'descubrir', slug: 'producto-hablar-con-usuarios' },
    { part: 7, title: 'Escribir una spec o PRD que se lea', block: 'construir', slug: 'producto-escribir-una-spec' },
    {
      part: 8,
      title: 'Ser diferente: estrategia y posicionamiento',
      block: 'descubrir',
      slug: 'producto-estrategia-y-posicionamiento',
    },
    { part: 9, title: 'Lanzar: del beta al go-to-market', block: 'construir', slug: 'producto-lanzar' },
    {
      part: 10,
      title: 'Tus primeros 90 días: el memo de entrada',
      block: 'construir',
      slug: 'producto-primeros-90-dias',
    },
  ] as Array<{ part: number; title: string; block: string; slug: string | null }>,
  text: {
    es: {
      card: 'Gestión de producto para aprender paso a paso: en cada post, la idea, una metodología, qué hacen las grandes empresas, una plantilla y tips. Una parte nueva cada semana.',
      intro:
        'Diez posts para aprender gestión de producto. Cada uno con la misma estructura: la idea en dos minutos, una metodología paso a paso con diagramas, qué hacen otras empresas (con fuentes), una plantilla para copiar, tips y errores típicos.',
      meta: 'Los 10 capítulos de la Serie Producto: gestión de producto con metodología, ejemplos de grandes empresas, plantillas y tips.',
    },
    en: {
      card: 'Learn product management step by step: each post has the idea, a method, what big companies do, a template and tips. In Spanish, a new part every week.',
      intro:
        'Ten posts to learn product management, all with the same structure: the idea in two minutes, a step-by-step method with diagrams, what other companies do (with sources), a template to copy, tips and common mistakes. The posts are in Spanish.',
      meta: 'All 10 parts of the Serie Producto (in Spanish): product management with a method, examples from big companies, templates and tips.',
    },
  },
};
