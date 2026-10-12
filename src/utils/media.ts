import manifest from '../data/media.json';

/**
 * Media served from the R2 bucket `carlosluengo-media` at media.carlosluengo.com.
 *
 * Content refers to a file as `media:<path>` (e.g. `media:blog/finanzsim/cover.png`).
 * `scripts/media.mjs sync` publishes the variants and records them in
 * `src/data/media.json`; this module turns a reference into URLs.
 */
export const MEDIA_ORIGIN = 'https://media.carlosluengo.com';
export const MEDIA_PREFIX = 'media:';

type Variant = [width: number, key: string];

export type MediaImage = {
  type: 'image';
  hash: string;
  width: number;
  height: number;
  sources: { avif: Variant[]; webp: Variant[] };
  og: string;
};

export type MediaFile = {
  type: 'svg' | 'file';
  hash: string;
  src: string;
  contentType: string;
  width?: number;
  height?: number;
};

export type MediaEntry = MediaImage | MediaFile;

const entries = manifest as unknown as Record<string, MediaEntry>;

export const isMediaRef = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(MEDIA_PREFIX);

export const mediaUrl = (key: string) => `${MEDIA_ORIGIN}/${key.split('/').map(encodeURIComponent).join('/')}`;

export const getMedia = (ref: string): MediaEntry => {
  const path = ref.slice(MEDIA_PREFIX.length);
  const entry = entries[path];
  if (!entry) throw new Error(`Unknown media reference "${ref}". Add it under media/ and run \`npm run media:sync\`.`);
  return entry;
};

const srcset = (variants: Variant[]) => variants.map(([w, key]) => `${mediaUrl(key)} ${w}w`).join(', ');

/** Everything needed to render a responsive <picture> (or a plain <img> for SVG). */
export const pictureFor = (ref: string) => {
  const entry = getMedia(ref);
  if (entry.type !== 'image') {
    return { src: mediaUrl(entry.src), width: entry.width, height: entry.height, sources: [] };
  }
  const largest = entry.sources.webp.at(-1)!;
  return {
    src: mediaUrl(largest[1]),
    width: entry.width,
    height: entry.height,
    sources: [
      { type: 'image/avif', srcset: srcset(entry.sources.avif) },
      { type: 'image/webp', srcset: srcset(entry.sources.webp) },
    ],
  };
};

/** A plain URL for links, videos, downloads and Open Graph. */
export const resolveMediaUrl = (ref: string, { og = false } = {}) => {
  const entry = getMedia(ref);
  if (entry.type === 'image') return mediaUrl(og ? entry.og : entry.sources.webp.at(-1)![1]);
  return mediaUrl(entry.src);
};
