/**
 * Figures for the post «Black Friday 2026: el primer fin de semana de los agentes que compran».
 * Single source for the charts in src/components/posts/bfcm/. Every figure carries its origin.
 *
 * Cloudflare Radar's BFCM page is a live dashboard (rolling "last 7 days vs Oct 1–7",
 * updated hourly): these values were read on 28 Nov 2026 around 10:30–11:00 UTC.
 */

export const RADAR_URL = 'https://radar.cloudflare.com/bfcm/2026';
export const RADAR_READ = '28 de noviembre de 2026, 11:00 UTC';

/** Personal-agent requests as a share of all requests Cloudflare sees (humans and bots). */
export const share = { baseline: 0.02, now: 0.05, change: 170 };

/** Personal-agent requests allowed without a block or challenge (Radar). */
export const allowed = { now: 98.37, blockedOrChallenged: 1.63 };

export type AgentKey = 'muse' | 'gemini' | 'dots' | 'other' | 'claude' | 'instinct';

export const agents: Record<AgentKey, { name: string; owner: string; signed: boolean }> = {
  muse: { name: 'Muse', owner: 'Meta', signed: true },
  gemini: { name: 'Gemini Tasks', owner: 'Google', signed: true },
  dots: { name: 'dots', owner: 'dots', signed: true },
  other: { name: 'Otros', owner: 'Cloudsurf, DuckAssistbot, ZipchatBot', signed: true },
  claude: { name: 'Claude Duet', owner: 'Anthropic', signed: false },
  instinct: { name: 'Instinct', owner: 'Instinct', signed: false },
};

/** Growth, last 7 days vs 1–7 Oct 2026 (%). `null` = Radar cannot measure it (unsigned requests). */
export const growth: { key: AgentKey | 'all'; traffic: number | null; purchases: number | null }[] = [
  { key: 'all', traffic: 189, purchases: 544 },
  { key: 'muse', traffic: 502, purchases: 947 },
  { key: 'gemini', traffic: 437, purchases: 745 },
  { key: 'other', traffic: 95, purchases: 193 },
  { key: 'dots', traffic: 8, purchases: 144 },
  { key: 'claude', traffic: null, purchases: null },
  { key: 'instinct', traffic: null, purchases: null },
];

/** Where personal-agent requests come from (% of the global total). */
export const countries: { name: string; pct: number; rank: number }[] = [
  { name: 'Estados Unidos', pct: 75.4, rank: 1 },
  { name: 'Japón', pct: 5.86, rank: 2 },
  { name: 'Canadá', pct: 4.55, rank: 3 },
  { name: 'Indonesia', pct: 1.2, rank: 4 },
  { name: 'Singapur', pct: 1.09, rank: 5 },
  { name: 'Reino Unido', pct: 1.06, rank: 6 },
  { name: 'India', pct: 1.05, rank: 7 },
  { name: 'México', pct: 0.86, rank: 8 },
  { name: 'España', pct: 0.26, rank: 21 },
];

/** Personal-agent requests from the US, by agent (%). */
export const usByAgent: { key: AgentKey; pct: number }[] = [
  { key: 'muse', pct: 68.9 },
  { key: 'dots', pct: 20.3 },
  { key: 'other', pct: 6.74 },
  { key: 'gemini', pct: 4.12 },
];

/** Share of agentic orders, week ending 22 Nov 2026 — Forter Intelligence, as reported by CNBC. */
export const ORDERS_URL = 'https://www.cnbc.com/2026/11/24/meta-instagram-muse-ad-revenue.html';
export const orders: { name: string; pct: number }[] = [
  { name: 'Muse (Meta)', pct: 51 },
  { name: 'Grok (xAI)', pct: 24 },
  { name: 'ChatGPT (OpenAI)', pct: 22 },
  { name: 'Google e Instinct', pct: 3 },
];

export const timeline: { date: string; label: string; detail: string; href: string; source: string }[] = [
  {
    date: '8 sep',
    label: 'Meta lanza Muse',
    detail: 'En una semana es la app gratuita número 1 de la App Store en EE. UU.',
    href: 'https://www.geekwire.com/2026/amazon-blocks-metas-muse-ai-assistant-in-new-standoff-over-agentic-shopping/',
    source: 'GeekWire',
  },
  {
    date: '20 sep',
    label: 'Amazon bloquea a Muse',
    detail: 'Amazon alega que no se le avisó, que Muse no se identifica al navegar y que parece guardar credenciales.',
    href: 'https://www.geekwire.com/2026/amazon-blocks-metas-muse-ai-assistant-in-new-standoff-over-agentic-shopping/',
    source: 'GeekWire',
  },
  {
    date: 'oct',
    label: 'Walmart abre su Agent Gateway',
    detail: 'Una puerta de entrada pensada para que los agentes compren en Walmart.com.',
    href: 'https://techcrunch.com/2026/11/24/walmart-teams-up-with-meta-to-bring-black-friday-deals-to-ai-agent-muse/',
    source: 'TechCrunch',
  },
  {
    date: '4 nov',
    label: 'Cloudflare: categoría «agentes personales»',
    detail: 'Analítica por agente y políticas Allow, Block on pages with ads o Block.',
    href: 'https://blog.cloudflare.com/personal-agents-visibility-control/',
    source: 'Blog de Cloudflare',
  },
  {
    date: '5 nov',
    label: 'Coalición Trusted Agent Delegation',
    detail: 'Web Bot Auth como método preferido para que los agentes firmen sus peticiones.',
    href: 'https://blog.cloudflare.com/trusted-agent-delegation/',
    source: 'Blog de Cloudflare',
  },
  {
    date: '23 nov',
    label: 'Muse llega al Reino Unido',
    detail: 'Con M&S, ASOS, Currys, Argos, JD Sports y Sainsbury’s, entre otros.',
    href: 'https://about.fb.com/news/2026/11/introducing-muse-in-the-uk-a-personal-ai-agent-you-control/',
    source: 'Meta',
  },
  {
    date: '24 nov',
    label: 'Muse compra en Walmart',
    detail: 'Las ofertas del Black Friday, con perfil de agente, límite de gasto y aprobación de compras.',
    href: 'https://corporate.walmart.com/news/2026/11/black-friday-deals-with-meta-muse',
    source: 'Walmart',
  },
  {
    date: '25 nov',
    label: 'Cloudflare Radar publica el panel BFCM',
    detail: 'Primera medición pública de agentes personales navegando y comprando.',
    href: 'https://radar.cloudflare.com/bfcm/2026',
    source: 'Cloudflare Radar',
  },
  {
    date: '27 nov',
    label: 'Black Friday',
    detail: 'Adobe preveía 12.900 M$ de gasto online en EE. UU. (+9,2 %). La cifra final aún no está publicada.',
    href: 'https://news.adobe.com/news/2026/09/adobe-us-holiday-shopping-season-to-hit-record',
    source: 'Adobe (previsión)',
  },
];
