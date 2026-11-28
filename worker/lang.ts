/**
 * Helpers for worker/index.ts. They live in their own module because the
 * Workers runtime only accepts handlers (functions or ExportedHandler objects)
 * as named exports of the entry module: exporting a string such as HOME_LINK
 * from index.ts makes workerd refuse to start the Worker.
 */

export type Lang = 'es' | 'en';

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

/**
 * Agent discovery on the home page (RFC 8288 + RFC 9727 §3): the API catalog,
 * the OpenAPI of the read-only content endpoints, llms.txt and the Markdown
 * twin. /en gets the same from public/_headers.
 */
export const HOME_LINK = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</openapi.json>; rel="service-desc"; type="application/openapi+json"',
  '</llms.txt>; rel="service-doc"; type="text/plain"',
  '</index.md>; rel="describedby"; type="text/markdown"',
].join(', ');

export const cookieLang = (header: string | null): Lang | undefined => {
  const match = header?.match(/(?:^|;\s*)lang=(es|en)\b/);
  return match?.[1] as Lang | undefined;
};
