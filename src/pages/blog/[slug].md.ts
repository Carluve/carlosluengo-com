import type { APIRoute, GetStaticPaths } from 'astro';
import { fetchPosts } from '~/utils/blog';
import { postMarkdown } from '~/utils/markdown';
import type { Post } from '~/types';

export const prerender = true;

export const getStaticPaths = (async () =>
  (await fetchPosts()).map((post) => ({ params: { slug: post.slug }, props: { post } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(await postMarkdown((props as { post: Post }).post), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
