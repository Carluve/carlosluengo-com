import type { APIRoute } from 'astro';
import { llmsFullTxt } from '~/utils/markdown';

export const prerender = true;

export const GET: APIRoute = async () =>
  new Response(await llmsFullTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
