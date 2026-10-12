import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MAX_DYNAMIC_REDIRECTS,
  MAX_STATIC_REDIRECTS,
  analyzeRedirects,
  canonicalSource,
  checkRedirects,
  cloudflarePathname,
  redirectKey,
} from './redirects.mjs';

test('fragment and trailing slash collapse to one encoded path', () => {
  const input = [
    '/Proyectos/GitHub/FOCA%20Visual%20C# /blog/foca-visual-c 301',
    '/Proyectos/GitHub/FOCA%20Visual%20C#/ /blog/foca-visual-c 301',
    '',
  ].join('\n');

  const result = analyzeRedirects(input);
  assert.equal(result.kept.length, 1);
  assert.equal(result.kept[0].canonical, '/Proyectos/GitHub/FOCA%20Visual%20C%23');
  assert.equal(result.removed.length, 1);
  assert.equal(cloudflarePathname(result.kept[0].canonical, { shieldReserved: false }), result.kept[0].canonical);

  const checked = checkRedirects(result.text);
  assert.deepEqual(checked, []);
});

test('encoded and unencoded spaces and accents share one key', () => {
  const encoded = redirectKey('/Blog/2025/IA%20ag%C3%A9ntica');
  const decoded = redirectKey('/Blog/2025/IA agéntica');
  const lowerHex = redirectKey('/Blog/2025/IA%20ag%c3%a9ntica/');
  const composed = redirectKey('/blog/2025/ia age\u0301ntica');
  assert.equal(encoded, decoded);
  assert.equal(encoded, lowerHex);
  assert.equal(encoded, composed);
  assert.equal(canonicalSource('/Blog/2025/IA agéntica/'), '/Blog/2025/IA%20ag%C3%A9ntica');
});

test('case and trailing slash collapse, keeping the first rule', () => {
  const input = ['/Blog/Post /blog/post 301', '/blog/post/ /blog/post 301', ''].join('\n');
  const result = analyzeRedirects(input);
  assert.equal(result.text, '/Blog/Post /blog/post 301\n');
  assert.equal(checkRedirects(input).length, 1);
  assert.match(checkRedirects(input)[0].message, /Duplicate rule for path \/Blog\/Post/);
});

test('a repeated path with a different target is a conflict', () => {
  const input = ['/old /blog/a 301', '/old/ /blog/b 302', ''].join('\n');
  const result = analyzeRedirects(input);
  assert.equal(result.fatal.length, 1);
  assert.match(result.fatal[0].message, /line 1 points to \/blog\/a 301/);
  assert.equal(result.text.includes('/blog/b'), false);
});

test('status codes, limits, order, and proxy rules are enforced', () => {
  assert.deepEqual(
    [...checkRedirects('/a /b 404\n')].map((error) => error.message),
    ['Line 1: Valid status codes are 200, 301, 302 (default), 303, 307, or 308. Got 404.']
  );
  assert.equal(checkRedirects('/a /b\n')[0], undefined);
  assert.match(checkRedirects('/a https://example.com 200\n')[0].message, /Proxy \(200\)/);
  assert.match(checkRedirects('/ /index.html 200\n')[0].message, /Infinite loop/);
  assert.match(
    checkRedirects('/blog/* /blog/:splat 301\n/later /x 301\n')[0].message,
    /Static redirects must appear before/
  );

  const tooManyStatic = Array.from({ length: 3 }, (_, index) => `/s${index} /d 301`).join('\n');
  assert.match(
    checkRedirects(`${tooManyStatic}\n`, { maxStatic: 2 })[0].message,
    /Maximum number of static redirects is 2/
  );

  const tooManyDynamic = Array.from({ length: 3 }, (_, index) => `/d${index}/* /x/:splat 301`).join('\n');
  assert.match(
    checkRedirects(`${tooManyDynamic}\n`, { maxDynamic: 2 })[0].message,
    /Maximum number of dynamic redirects is 2/
  );
  assert.match(checkRedirects(`${'x'.repeat(20)} /b 301\n`, { maxLineLength: 10 })[0].message, /maximum length/i);

  assert.equal(MAX_STATIC_REDIRECTS, 2000);
  assert.equal(MAX_DYNAMIC_REDIRECTS, 100);
});

test('plus signs stay literal and comments are preserved', () => {
  const input = [
    '# header',
    '/Proyectos/Arkanoid%20C++%20a%20TypeScript /blog/arkanoid-c-a-typescript 301',
    '/Proyectos/Arkanoid%20C++%20a%20TypeScript/ /blog/arkanoid-c-a-typescript 301',
    '',
  ].join('\n');
  const result = analyzeRedirects(input);
  assert.equal(result.text, '# header\n/Proyectos/Arkanoid%20C++%20a%20TypeScript /blog/arkanoid-c-a-typescript 301\n');
  assert.deepEqual(checkRedirects(result.text), []);
});

test('the published redirects file has one rule per normalised path', () => {
  const input = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  assert.deepEqual(checkRedirects(input), []);
  const generated = analyzeRedirects(input);
  assert.equal(generated.removed.length, 0);
  assert.equal(generated.fatal.length, 0);
  assert.equal(generated.kept.length > 0, true);
  assert.equal(generated.staticCount <= MAX_STATIC_REDIRECTS, true);
  assert.equal(generated.dynamicCount <= MAX_DYNAMIC_REDIRECTS, true);
  assert.deepEqual(checkRedirects(generated.text), []);

  const uploaded = new Set();
  for (const rule of generated.kept) {
    const path = cloudflarePathname(rule.canonical, { shieldReserved: false });
    assert.equal(uploaded.has(path), false, path);
    uploaded.add(path);
  }
  assert.equal(uploaded.has('/Proyectos/GitHub/FOCA%20Visual%20C%23'), true);
  assert.equal(uploaded.has('/Proyectos/GitHub/FOCA%20Visual%20C'), false);
});
