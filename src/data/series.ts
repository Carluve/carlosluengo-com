/**
 * All the blog series. Each one has its own index page, a summary card on the
 * blog list and navigation inside its posts; the shared components read from here.
 */
import { serieCloudflare } from './serie-cloudflare';
import { serieProducto } from './serie-producto';

export type Serie = typeof serieCloudflare;
export type SerieParte = Serie['partes'][number];

export const series: Array<Serie> = [serieProducto, serieCloudflare];

export const seriePorId = (id: string): Serie => {
  const s = series.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown series: ${id}`);
  return s;
};

export const publicadas = (serie: Serie) => serie.partes.filter((p) => p.slug);

/** Series and part that a post slug belongs to, if any. */
export const parteDeSlug = (slug: string): { serie: Serie; parte: SerieParte } | undefined => {
  for (const serie of series) {
    const parte = serie.partes.find((p) => p.slug === slug);
    if (parte) return { serie, parte };
  }
  return undefined;
};

/** Series a post (by its tag slugs) belongs to, if any. */
export const serieDePost = (post: { tags?: Array<{ slug: string }> }): Serie | undefined =>
  Array.isArray(post.tags) ? series.find((s) => post.tags!.some((tag) => tag.slug === s.tag)) : undefined;

export const isAnySeriePost = (post: { tags?: Array<{ slug: string }> }): boolean => !!serieDePost(post);
