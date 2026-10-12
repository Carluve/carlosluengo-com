/**
 * Language negotiation for the home page.
 *
 * Runs only for `/` (see `run_worker_first` in wrangler.jsonc); every other
 * request is served straight from the static assets. A visitor who already
 * chose a language through the ES/EN switch has a `lang` cookie, which always
 * wins. Otherwise a browser that prefers English over Spanish is sent to /en.
 * Crawlers usually send no Accept-Language and get the Spanish home.
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

type Lang = 'es' | 'en';

/** The first of `es` / `en` in the visitor's ranked Accept-Language list. */
export const preferredLang = (header: string | null): Lang | undefined => {
  if (!header) return undefined;
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1);
      return { base: tag.split('-')[0], q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return ranked.find((entry) => entry.base === 'es' || entry.base === 'en')?.base as Lang | undefined;
};

const cookieLang = (header: string | null): Lang | undefined => {
  const match = header?.match(/(?:^|;\s*)lang=(es|en)\b/);
  return match?.[1] as Lang | undefined;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
      const chosen = cookieLang(request.headers.get('Cookie'));
      const lang = chosen ?? preferredLang(request.headers.get('Accept-Language'));
      if (lang === 'en') {
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/en${url.search}`,
            'Cache-Control': 'private, no-store',
            Vary: 'Accept-Language, Cookie',
          },
        });
      }
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.append('Vary', 'Accept-Language, Cookie');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return env.ASSETS.fetch(request);
  },
};
