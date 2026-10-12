#!/usr/bin/env node
// Media pipeline for media.carlosluengo.com (R2 bucket `carlosluengo-media`).
//
// Originals live in `media/` (git-ignored) and in R2 under `originals/`.
// Posts reference them as `media:<path>`, e.g. `media:blog/finanzsim/cover.png`.
// `src/data/media.json` (tracked) maps each path to the published variants.
//
//   node scripts/media.mjs sync     optimise new or changed files in media/, upload, update the manifest
//   node scripts/media.mjs pull     download missing originals from R2 into media/
//   node scripts/media.mjs check    fail if a `media:` reference in src/ is not in the manifest
//
// Uploads go through wrangler, so `npx wrangler login` once is enough.

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const BUCKET = 'carlosluengo-media';
export const ACCOUNT_ID = '39f8ea10b94ad38470fc3c20c260efdc';
const ROOT = new URL('..', import.meta.url).pathname;
const MEDIA_DIR = join(ROOT, 'media');
const MANIFEST = join(ROOT, 'src/data/media.json');
const IMMUTABLE = 'public, max-age=31536000, immutable';

const WIDTHS = [480, 960, 1600];
const OG = { width: 1200, height: 626 };
const RASTER = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tif', '.tiff']);
const TYPES = {
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.bib': 'text/plain; charset=utf-8',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

const toPosix = (p) => p.split(sep).join('/');
const typeOf = (p) => TYPES[extname(p).toLowerCase()] ?? 'application/octet-stream';
const stem = (p) => p.slice(0, p.length - extname(p).length);

export const loadManifest = async () => {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    return {};
  }
};

const saveManifest = async (manifest) => {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
};

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const wrangler = (args) =>
  run('npx', ['wrangler', ...args], {
    cwd: ROOT,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? ACCOUNT_ID },
    maxBuffer: 16 * 1024 * 1024,
  });

const put = async (key, file, cacheControl = IMMUTABLE) => {
  for (let attempt = 1; ; attempt++) {
    try {
      await wrangler([
        'r2',
        'object',
        'put',
        `${BUCKET}/${key}`,
        '--file',
        file,
        '--content-type',
        typeOf(key),
        '--cache-control',
        cacheControl,
        '--remote',
      ]);
      return;
    } catch (error) {
      if (attempt >= 3) throw new Error(`upload failed for ${key}: ${error.stderr || error.message}`, { cause: error });
    }
  }
};

const pool = async (items, size, fn) => {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) await fn(queue.shift());
    })
  );
};

/** Build every published file for one original. Returns the manifest entry and the files to upload. */
const build = async (path, file, hash, work) => {
  const ext = extname(path).toLowerCase();
  const base = `${stem(path)}-${hash}`;

  if (!RASTER.has(ext)) {
    const entry = { type: ext === '.svg' ? 'svg' : 'file', hash, src: `${base}${ext}`, contentType: typeOf(path) };
    if (ext === '.svg') {
      const svg = await readFile(file, 'utf8');
      const box = svg.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
      if (box) Object.assign(entry, { width: Math.round(+box[1]), height: Math.round(+box[2]) });
    }
    return { entry, uploads: [[entry.src, file]] };
  }

  const { default: sharp } = await import('sharp');
  const image = sharp(file, { animated: false }).rotate();
  const { width, height } = await image.metadata();
  const widths = [...new Set([...WIDTHS.filter((w) => w < width), Math.min(width, WIDTHS.at(-1))])];
  const uploads = [];
  const sources = { avif: [], webp: [] };

  for (const w of widths) {
    for (const [format, options] of [
      ['avif', { quality: 55, effort: 4 }],
      ['webp', { quality: 80 }],
    ]) {
      const key = `${base}-${w}.${format}`;
      const out = join(work, key);
      await mkdir(dirname(out), { recursive: true });
      await image.clone().resize({ width: w, withoutEnlargement: true }).toFormat(format, options).toFile(out);
      uploads.push([key, out]);
      sources[format].push([w, key]);
    }
  }

  const og = `${base}-og.jpg`;
  const ogOut = join(work, og);
  await image
    .clone()
    .resize({ ...OG, fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(ogOut);
  uploads.push([og, ogOut]);

  return { entry: { type: 'image', hash, width, height, sources, og }, uploads };
};

const sync = async () => {
  const manifest = await loadManifest();
  const work = join(tmpdir(), `media-${process.pid}`);
  const pending = [];

  for await (const file of walk(MEDIA_DIR)) {
    const path = toPosix(relative(MEDIA_DIR, file));
    const hash = createHash('sha256')
      .update(await readFile(file))
      .digest('hex')
      .slice(0, 10);
    if (manifest[path]?.hash === hash) continue;
    pending.push({ path, file, hash });
  }

  console.log(`media: ${pending.length} new or changed file(s)`);
  let done = 0;
  await pool(pending, 4, async ({ path, file, hash }) => {
    const { entry, uploads } = await build(path, file, hash, work);
    uploads.push([`originals/${path}`, file]);
    await pool(uploads, 4, ([key, src]) =>
      put(key, src, key.startsWith('originals/') ? 'private, max-age=0' : IMMUTABLE)
    );
    manifest[path] = entry;
    console.log(`  [${++done}/${pending.length}] ${path} → ${uploads.length} object(s)`);
    // Save as we go so an interrupted run resumes where it stopped.
    await saveManifest(manifest);
  });

  await rm(work, { recursive: true, force: true });
  await saveManifest(manifest);
};

const pull = async () => {
  const manifest = await loadManifest();
  const missing = [];
  for (const path of Object.keys(manifest)) {
    try {
      await stat(join(MEDIA_DIR, path));
    } catch {
      missing.push(path);
    }
  }
  console.log(`media: downloading ${missing.length} original(s)`);
  await pool(missing, 6, async (path) => {
    const out = join(MEDIA_DIR, path);
    await mkdir(dirname(out), { recursive: true });
    await wrangler(['r2', 'object', 'get', `${BUCKET}/originals/${path}`, '--file', out, '--remote']);
  });
};

// A reference inside a quoted string, a Markdown link target or an attribute.
export const MEDIA_REF = /(?<=["'(=])media:([\w./@~+-]*\w)/g;

const check = async () => {
  const manifest = await loadManifest();
  const problems = [];
  for await (const file of walk(join(ROOT, 'src'))) {
    if (!/\.(md|mdx|astro|ts|yaml)$/.test(file)) continue;
    const text = await readFile(file, 'utf8');
    for (const [, path] of text.matchAll(MEDIA_REF)) {
      if (!manifest[path])
        problems.push(`${toPosix(relative(ROOT, file))}: media:${path} is not in src/data/media.json`);
    }
  }
  if (problems.length) {
    console.error(problems.join('\n') + '\nAdd the file under media/ and run `npm run media:sync`.');
    process.exit(1);
  }
  console.log(`media: ${Object.keys(manifest).length} manifest entries, all references resolve`);
};

const commands = { sync, pull, check };
const command = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!commands[command]) {
    console.error('usage: node scripts/media.mjs <sync|pull|check>');
    process.exit(2);
  }
  await commands[command]();
}
