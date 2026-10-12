import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { preferredLang } from './index.ts';

const assets = { fetch: async () => new Response('home', { status: 200 }) };
const get = (headers = {}, path = '/') =>
  worker.fetch(new Request(`https://carlosluengo.com${path}`, { headers }), { ASSETS: assets });

test('Accept-Language ranking picks the first of es/en', () => {
  assert.equal(preferredLang('en-US,en;q=0.9,es;q=0.8'), 'en');
  assert.equal(preferredLang('es-ES,es;q=0.9,en;q=0.8'), 'es');
  assert.equal(preferredLang('fr-FR,fr;q=0.9,en;q=0.8,es;q=0.7'), 'en');
  assert.equal(preferredLang('de-DE,de;q=0.9'), undefined);
  assert.equal(preferredLang('es;q=0.5,en;q=0.9'), 'en');
  assert.equal(preferredLang(null), undefined);
});

test('English browsers are sent to /en, others get the Spanish home', async () => {
  const en = await get({ 'Accept-Language': 'en-GB,en;q=0.9' });
  assert.equal(en.status, 302);
  assert.equal(en.headers.get('Location'), '/en');
  const es = await get({ 'Accept-Language': 'es-ES,es;q=0.9' });
  assert.equal(es.status, 200);
  const none = await get();
  assert.equal(none.status, 200);
});

test('the lang cookie wins over the browser', async () => {
  const chosenEs = await get({ 'Accept-Language': 'en-US', Cookie: 'theme=dark; lang=es' });
  assert.equal(chosenEs.status, 200);
  const chosenEn = await get({ 'Accept-Language': 'es-ES', Cookie: 'lang=en' });
  assert.equal(chosenEn.headers.get('Location'), '/en');
});

test('other paths are untouched', async () => {
  const blog = await get({ 'Accept-Language': 'en-US' }, '/blog');
  assert.equal(blog.status, 200);
});
