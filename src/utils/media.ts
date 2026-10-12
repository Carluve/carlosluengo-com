import type { RehypePlugin, RemarkPlugin } from '@astrojs/markdown-remark';
import dimensionTable from '../data/media-dimensions.json';

/** Public R2 URL. `PUBLIC_MEDIA_BASE_URL` replaces it at build time (later, media.carlosluengo.com). */
export const DEFAULT_MEDIA_BASE_URL = 'https://pub-27745be1d92d4677b679da82c54861cb.r2.dev';

const MEDIA_HOSTS = new Set(['pub-27745be1d92d4677b679da82c54861cb.r2.dev', 'media.carlosluengo.com']);

export type MediaSize = { width: number; height: number };

const dimensions = dimensionTable as Record<string, MediaSize>;

type Node = {
  type: string;
  tagName?: string;
  url?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

export function mediaBaseUrl(): string {
  const fromNode = typeof process === 'undefined' ? undefined : process.env.PUBLIC_MEDIA_BASE_URL;
  const configured = import.meta.env.PUBLIC_MEDIA_BASE_URL || fromNode;
  return (configured || DEFAULT_MEDIA_BASE_URL).replace(/\/+$/, '');
}

/** Swap a known media host for the configured base. Other URLs stay as they are. */
export function resolveMediaUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

  const base = new URL(mediaBaseUrl());
  if (url.origin === base.origin) return value;
  if (!MEDIA_HOSTS.has(url.hostname)) return value;
  return `${base.origin}${url.pathname}${url.search}${url.hash}`;
}

export function mediaUrl(key: string): string {
  const clean = key.replace(/^\/+/, '');
  return resolveMediaUrl(`${DEFAULT_MEDIA_BASE_URL}/${clean}`);
}

export function mediaSize(key: string): MediaSize {
  const size = dimensions[key.replace(/^\/+/, '')];
  if (!size) throw new Error(`Missing media dimensions for ${key}`);
  return size;
}

export function dimensionsForUrl(value: string): MediaSize | undefined {
  try {
    const key = decodeURIComponent(new URL(value).pathname.replace(/^\/+/, ''));
    return dimensions[key];
  } catch {
    return undefined;
  }
}

function rewriteNodeUrl(node: Node): void {
  if (typeof node.url === 'string') node.url = resolveMediaUrl(node.url);
}

function rewriteHtmlValue(value: string): string {
  return value.replace(/https?:\/\/[^\s"'<>]+/g, (match) => resolveMediaUrl(match));
}

function walk(node: Node | undefined, visit: (node: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, visit);
  }
}

/** Rewrite markdown image, link, and raw HTML media URLs to `PUBLIC_MEDIA_BASE_URL`. */
export const mediaUrlRemarkPlugin: RemarkPlugin = () => {
  return (tree, file) => {
    const frontmatter = (file?.data as { astro?: { frontmatter?: { image?: unknown } } } | undefined)?.astro
      ?.frontmatter;
    if (frontmatter && typeof frontmatter.image === 'string') {
      frontmatter.image = resolveMediaUrl(frontmatter.image);
    }

    walk(tree as Node, (node) => {
      if (node.type === 'image' || node.type === 'link' || node.type === 'definition') rewriteNodeUrl(node);
      if ((node.type === 'html' || node.type === 'raw') && typeof node.value === 'string') {
        node.value = rewriteHtmlValue(node.value);
      }
    });
  };
};

/** Plain <img> for remote media: lazy, async, and intrinsic width/height when known. */
export const mediaImgRehypePlugin: RehypePlugin = () => {
  return (tree) => {
    walk(tree as Node, (node) => {
      if (node.type === 'raw' && typeof node.value === 'string') {
        node.value = rewriteHtmlValue(node.value);
        return;
      }
      if (node.type !== 'element' || !node.properties) return;

      for (const attr of ['src', 'poster', 'href', 'data']) {
        const current = node.properties[attr];
        if (typeof current === 'string') node.properties[attr] = resolveMediaUrl(current);
      }

      if (node.tagName !== 'img') return;
      const src = node.properties.src;
      if (node.properties.loading == null) node.properties.loading = 'lazy';
      if (node.properties.decoding == null) node.properties.decoding = 'async';
      if (typeof src !== 'string') return;
      const size = dimensionsForUrl(src);
      if (!size) return;
      if (node.properties.width == null) node.properties.width = size.width;
      if (node.properties.height == null) node.properties.height = size.height;
    });
  };
};
