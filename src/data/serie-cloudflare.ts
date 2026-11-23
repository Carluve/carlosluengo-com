/**
 * Serie Cloudflare: the 50 planned parts, in reading order.
 *
 * A part with a `slug` is published at /blog/<slug>; `slug: null` means it is
 * still to come. To publish a new part, add its post (tagged 'serie cloudflare')
 * and fill in the slug here: the series page, the in-post navigation and the
 * summary card on the blog all read from this list.
 */

export const SERIE_TAG = 'serie-cloudflare';
export const SERIE_PATH = '/serie-cloudflare';
export const SERIE_TOTAL = 50;

export type SerieBlock = 'seguridad' | 'zero-trust' | 'desarrollo' | 'ia' | 'otros';

export interface SeriePart {
  part: number;
  title: string;
  block: SerieBlock;
  slug: string | null;
}

export const serieBlocks: Array<{ id: SerieBlock; title: string; titleEn: string }> = [
  { id: 'seguridad', title: 'Seguridad y rendimiento', titleEn: 'Security and performance' },
  { id: 'zero-trust', title: 'Zero Trust y SASE', titleEn: 'Zero Trust and SASE' },
  { id: 'desarrollo', title: 'Plataforma para desarrolladores', titleEn: 'Developer platform' },
  { id: 'ia', title: 'IA', titleEn: 'AI' },
  { id: 'otros', title: 'Otros', titleEn: 'Other' },
];

export const seriePartes: Array<SeriePart> = [
  // Published
  { part: 1, title: 'DNS y DNSSEC', block: 'seguridad', slug: 'cloudflare-dns-dnssec-guia' },
  {
    part: 2,
    title: 'El plan Free: qué incluye y dónde están los límites',
    block: 'seguridad',
    slug: 'cloudflare-plan-free-que-incluye',
  },
  {
    part: 3,
    title: 'SSL/TLS: certificados de borde, Origin CA y modos de cifrado',
    block: 'seguridad',
    slug: 'cloudflare-ssl-tls-guia',
  },
  {
    part: 4,
    title: 'CDN y caché: Cache Rules, Tiered Cache y purgas',
    block: 'seguridad',
    slug: 'cloudflare-cdn-cache-guia',
  },
  {
    part: 5,
    title: 'WAF: reglas gestionadas y reglas personalizadas',
    block: 'seguridad',
    slug: 'cloudflare-waf-guia',
  },
  {
    part: 6,
    title: 'Turnstile: del widget a la verificación en el servidor',
    block: 'seguridad',
    slug: 'cloudflare-turnstile-guia',
  },
  {
    part: 7,
    title: 'Protección DDoS: qué está protegido de serie y cómo ajustarlo',
    block: 'seguridad',
    slug: 'cloudflare-ddos-guia',
  },
  {
    part: 8,
    title: 'Bots: Bot Fight Mode, Super Bot Fight Mode y bots verificados',
    block: 'seguridad',
    slug: 'cloudflare-bots-guia',
  },
  {
    part: 9,
    title: 'Rate limiting: limitar peticiones sin bloquear a tus usuarios',
    block: 'seguridad',
    slug: 'cloudflare-rate-limiting-guia',
  },
  { part: 10, title: 'Access: proteger una aplicación sin VPN', block: 'zero-trust', slug: 'cloudflare-access-guia' },
  {
    part: 11,
    title: 'Tunnel: publicar un servicio sin abrir puertos',
    block: 'zero-trust',
    slug: 'cloudflare-tunnel-guia',
  },
  { part: 12, title: 'Gateway: filtrado DNS y HTTP', block: 'zero-trust', slug: 'cloudflare-gateway-guia' },
  {
    part: 13,
    title: 'WARP: el cliente de Zero Trust y la postura del dispositivo',
    block: 'zero-trust',
    slug: 'cloudflare-warp-guia',
  },
  { part: 14, title: 'Workers: de hola mundo a producción', block: 'desarrollo', slug: 'cloudflare-workers-guia' },
  {
    part: 15,
    title: 'R2: almacenamiento de objetos sin costes de salida',
    block: 'desarrollo',
    slug: 'cloudflare-r2-guia',
  },
  { part: 16, title: 'Workers KV: clave-valor en el borde', block: 'desarrollo', slug: 'cloudflare-kv-guia' },
  { part: 17, title: 'D1: la base de datos SQL sin servidor', block: 'desarrollo', slug: 'cloudflare-d1-guia' },
  {
    part: 18,
    title: 'Durable Objects: estado y coordinación en el borde',
    block: 'desarrollo',
    slug: 'cloudflare-durable-objects-guia',
  },
  {
    part: 19,
    title: 'Queues: mensajes y tareas en segundo plano',
    block: 'desarrollo',
    slug: 'cloudflare-queues-guia',
  },
  {
    part: 20,
    title: 'Workflows: procesos duraderos paso a paso',
    block: 'desarrollo',
    slug: 'cloudflare-workflows-guia',
  },

  // Coming soon: the developer block first (part 20 promises Hyperdrive), then the rest of the plan
  { part: 21, title: 'Hyperdrive: tu base de datos de siempre, más rápida', block: 'desarrollo', slug: 'cloudflare-hyperdrive-guia' },
  { part: 22, title: 'Containers y Sandboxes: contenedores junto a tus Workers', block: 'desarrollo', slug: 'cloudflare-containers-guia' },
  { part: 23, title: 'Browser Run: navegadores sin interfaz en el borde', block: 'desarrollo', slug: 'cloudflare-browser-run-guia' },
  { part: 24, title: 'Email Routing y Email Service: recibir y enviar correo', block: 'desarrollo', slug: 'cloudflare-email-guia' },
  { part: 25, title: 'Stream y Realtime: vídeo y comunicación en tiempo real', block: 'desarrollo', slug: 'cloudflare-stream-realtime-guia' },
  { part: 26, title: 'Observabilidad: logs, trazas y Logpush', block: 'desarrollo', slug: 'cloudflare-observabilidad-guia' },
  { part: 27, title: 'Sitios estáticos en Workers (static assets)', block: 'desarrollo', slug: 'cloudflare-static-assets-guia' },
  { part: 28, title: 'Detección de credenciales filtradas', block: 'seguridad', slug: 'cloudflare-credenciales-filtradas-guia' },
  { part: 29, title: 'API Shield: descubrimiento, validación de esquemas y mTLS', block: 'seguridad', slug: 'cloudflare-api-shield-guia' },
  { part: 30, title: 'Seguridad del lado del cliente y PCI DSS 4.0', block: 'seguridad', slug: 'cloudflare-seguridad-cliente-guia' },
  { part: 31, title: 'Load Balancing: conmutación por error entre orígenes', block: 'seguridad', slug: 'cloudflare-load-balancing-guia' },
  { part: 32, title: 'Argo Smart Routing', block: 'seguridad', slug: 'cloudflare-argo-guia' },
  { part: 33, title: 'Images: transformación y optimización de imágenes', block: 'seguridad', slug: 'cloudflare-images-guia' },
  { part: 34, title: 'Waiting Room: sala de espera para picos de tráfico', block: 'seguridad', slug: 'cloudflare-waiting-room-guia' },
  { part: 35, title: 'Rules: redirecciones, Transform Rules y Snippets', block: 'seguridad', slug: 'cloudflare-rules-guia' },
  { part: 36, title: 'Security Center y Brand Protection', block: 'seguridad', slug: 'cloudflare-security-center-guia' },
  { part: 37, title: 'AI Crawl Control y pago por rastreo', block: 'seguridad', slug: 'cloudflare-ai-crawl-control-guia' },
  { part: 38, title: 'Browser Isolation: navegación aislada', block: 'zero-trust', slug: 'cloudflare-browser-isolation-guia' },
  { part: 39, title: 'CASB: postura de seguridad de las aplicaciones SaaS', block: 'zero-trust', slug: 'cloudflare-casb-guia' },
  { part: 40, title: 'DLP: protección de datos', block: 'zero-trust', slug: 'cloudflare-dlp-guia' },
  { part: 41, title: 'Email Security y DMARC Management', block: 'zero-trust', slug: 'cloudflare-email-security-guia' },
  { part: 42, title: 'Cloudflare WAN y Network Firewall', block: 'zero-trust', slug: 'cloudflare-wan-guia' },
  { part: 43, title: 'Workers AI: modelos en las GPU de Cloudflare', block: 'ia', slug: 'cloudflare-workers-ai-guia' },
  { part: 44, title: 'Clef y Clairic: los modelos propios de Cloudflare', block: 'ia', slug: 'cloudflare-clef-clairic-guia' },
  { part: 45, title: 'AI Gateway: control y caché de las llamadas a modelos', block: 'ia', slug: 'cloudflare-ai-gateway-guia' },
  { part: 46, title: 'Vectorize y AI Search', block: 'ia', slug: 'cloudflare-vectorize-ai-search-guia' },
  { part: 47, title: 'Agents SDK: agentes con estado', block: 'ia', slug: 'cloudflare-agents-sdk-guia' },
  { part: 48, title: 'Basin: Pipelines, Catalog y SQL', block: 'ia', slug: 'cloudflare-basin-guia' },
  { part: 49, title: 'Registrar: dominios a precio de coste', block: 'otros', slug: 'cloudflare-registrar-guia' },
  { part: 50, title: 'Zaraz y Web Analytics', block: 'otros', slug: 'cloudflare-zaraz-web-analytics-guia' },
];

export const seriePublicadas = seriePartes.filter((p) => p.slug);

/** Part that a post slug belongs to, if any. */
export const serieParteDe = (slug: string): SeriePart | undefined => seriePartes.find((p) => p.slug === slug);

/** Part by number. */
export const serieParte = (part: number): SeriePart | undefined => seriePartes.find((p) => p.part === part);

/** True when a post (by its tag slugs) belongs to the series. */
export const isSeriePost = (post: { tags?: Array<{ slug: string }> }): boolean =>
  Array.isArray(post.tags) && post.tags.some((tag) => tag.slug === SERIE_TAG);

/** The series as a whole, for the shared series components (see ~/data/series). */
export const serieCloudflare = {
  id: 'cloudflare',
  name: 'Serie Cloudflare',
  tag: SERIE_TAG,
  path: SERIE_PATH,
  total: SERIE_TOTAL,
  icon: 'tabler:cloud',
  blocks: serieBlocks as Array<{ id: string; title: string; titleEn: string }>,
  partes: seriePartes as Array<{ part: number; title: string; block: string; slug: string | null }>,
  text: {
    es: {
      card: 'Un post por cada servicio de Cloudflare, del DNS a Workers y la IA, siempre con la misma estructura y capturas paso a paso. Sale una parte nueva cada martes.',
      intro:
        'Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial. Sale una parte nueva cada martes.',
      meta: `Los ${SERIE_TOTAL} capítulos de la Serie Cloudflare: un post por servicio, con la misma estructura y capturas paso a paso.`,
    },
    en: {
      card: 'One post per Cloudflare service, from DNS to Workers and AI, always with the same structure and step-by-step screenshots. In Spanish, a new part every Tuesday.',
      intro:
        'One post per Cloudflare service, always with the same structure: what it is, use cases, architecture, step-by-step setup with screenshots, how to check it, limits and the official docs. A new part every Tuesday; the posts are in Spanish.',
      meta: `All ${SERIE_TOTAL} parts of the Serie Cloudflare (in Spanish): one post per service, same structure, step-by-step screenshots.`,
    },
  },
};
