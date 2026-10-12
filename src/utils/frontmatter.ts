import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';
import type { RehypePlugin, RemarkPlugin } from '@astrojs/markdown-remark';
import { isMediaRef, MEDIA_PREFIX, pictureFor, resolveMediaUrl } from './media';

export const readingTimeRemarkPlugin: RemarkPlugin = () => {
  return function (tree, file) {
    const textOnPage = toString(tree);
    const readingTime = Math.ceil(getReadingTime(textOnPage).minutes);

    if (typeof file?.data?.astro?.frontmatter !== 'undefined') {
      file.data.astro.frontmatter.readingTime = readingTime;
    }
  };
};

export const responsiveTablesRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    if (!tree.children) return;

    for (let i = 0; i < tree.children.length; i++) {
      const child = tree.children[i];

      if (child.type === 'element' && child.tagName === 'table') {
        tree.children[i] = {
          type: 'element',
          tagName: 'div',
          properties: {
            style: 'overflow:auto',
          },
          children: [child],
        };

        i++;
      }
    }
  };
};

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const URL_PROPERTIES = ['src', 'href', 'poster'];

/**
 * Resolve `media:<path>` references (see src/utils/media.ts) in Markdown:
 * images become a responsive <picture> served from R2, and any other `src`,
 * `href` or `poster` (videos, PDFs, links) gets the plain media URL. Raw HTML
 * blocks are rewritten as text.
 */
export const mediaRehypePlugin: RehypePlugin = () => {
  const visit = (node: HastNode, parent?: HastNode, index?: number) => {
    if (node.type === 'raw' && node.value?.includes(MEDIA_PREFIX)) {
      node.value = node.value.replace(/media:[\w./@~+-]*\w/g, (ref) => resolveMediaUrl(ref));
    }

    if (node.type === 'element' && node.properties) {
      const { src } = node.properties;
      if (node.tagName === 'img' && isMediaRef(src) && parent?.children && index !== undefined) {
        const picture = pictureFor(src);
        const img: HastNode = {
          type: 'element',
          tagName: 'img',
          properties: {
            ...node.properties,
            src: picture.src,
            width: picture.width,
            height: picture.height,
            loading: 'lazy',
            decoding: 'async',
            ...(picture.sources.length ? { sizes: '(min-width: 768px) 768px, 100vw' } : {}),
          },
          children: [],
        };
        parent.children[index] = picture.sources.length
          ? {
              type: 'element',
              tagName: 'picture',
              properties: {},
              children: [
                ...picture.sources.map((source): HastNode => ({
                  type: 'element',
                  tagName: 'source',
                  properties: source,
                  children: [],
                })),
                img,
              ],
            }
          : img;
        return;
      }
      for (const key of URL_PROPERTIES) {
        const value = node.properties[key];
        if (isMediaRef(value)) node.properties[key] = resolveMediaUrl(value);
      }
    }

    node.children?.forEach((child, i) => visit(child, node, i));
  };

  return (tree) => visit(tree as unknown as HastNode);
};
