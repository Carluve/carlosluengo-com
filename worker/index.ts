/**
 * Language negotiation for the home page.
 *
 * Runs only for `/` (see `run_worker_first` in wrangler.jsonc); every other
 * request is served straight from the static assets. A visitor who already
 * chose a language through the ES/EN switch has a `lang` cookie, which always
 * wins. Otherwise a browser that prefers English over Spanish is sent to /en.
 * Crawlers usually send no Accept-Language and get the Spanish home.
 */

import { HOME_LINK, cookieLang, preferredLang } from './lang.ts';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

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
            Link: HOME_LINK,
          },
        });
      }
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.append('Vary', 'Accept-Language, Cookie');
      headers.set('Link', HOME_LINK);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return env.ASSETS.fetch(request);
  },
};
