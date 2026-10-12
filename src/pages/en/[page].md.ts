import type { APIRoute, GetStaticPaths } from 'astro';
import { PAGES, pageMarkdown, type PageKey } from '~/utils/markdown';

export const prerender = true;

export const getStaticPaths = (() => PAGES.map((page) => ({ params: { page } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) =>
  new Response(await pageMarkdown(params.page as PageKey, 'en'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
