/**
 * Upload media/ to the Cloudflare R2 bucket `carlosluengo-media`.
 *
 *   node scripts/upload-media.mjs            # every file
 *   node scripts/upload-media.mjs --changed  # git diff (see MEDIA_DIFF_BASE)
 *   node scripts/upload-media.mjs --dry-run  # print objects, do not upload
 *
 * Requires CLOUDFLARE_API_TOKEN (R2 Edit) and CLOUDFLARE_ACCOUNT_ID.
 * Objects are stored with their path under media/ as the key, for example
 * media/blog/<slug>/file.webp → blog/<slug>/file.webp.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUCKET = 'carlosluengo-media';
const CACHE_CONTROL = 'public,max-age=31536000,immutable';
const ZERO_SHA = /^0+$/;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaRoot = path.join(root, 'media');

const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

const flags = new Set(process.argv.slice(2));
const changedOnly = flags.has('--changed');
const dryRun = flags.has('--dry-run');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function relativeKey(file) {
  return path.relative(mediaRoot, file).split(path.sep).join('/');
}

function isUploadable(key) {
  if (!key || key.startsWith('.') || key.split('/').some((part) => part.startsWith('.'))) return false;
  return !key.endsWith('.json');
}

/** @returns {string[] | null} null means upload every file (new branch or missing base). */
function changedKeys() {
  const base = process.env.MEDIA_DIFF_BASE;
  const head = process.env.MEDIA_DIFF_HEAD || 'HEAD';
  if (base && ZERO_SHA.test(base)) return null;
  const range = base ? [base, head] : ['HEAD~1', 'HEAD'];
  try {
    const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', ...range, '--', 'media'], {
      cwd: root,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('media/'))
      .map((line) => line.slice('media/'.length));
  } catch (error) {
    if (!base) {
      console.log('Could not diff HEAD~1; uploading every file in media/.');
      return null;
    }
    throw error;
  }
}

async function filesToUpload() {
  if (!changedOnly) {
    return (await walk(mediaRoot)).map(relativeKey).filter(isUploadable);
  }

  const changed = changedKeys();
  if (changed === null) return (await walk(mediaRoot)).map(relativeKey).filter(isUploadable);

  const keys = [];
  for (const key of changed) {
    if (!isUploadable(key)) continue;
    try {
      const info = await stat(path.join(mediaRoot, key));
      if (info.isFile()) keys.push(key);
    } catch {
      console.log(`skip removed media/${key}`);
    }
  }
  return keys;
}

function contentType(key) {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? null;
}

const keys = (await filesToUpload()).sort();

if (!dryRun && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
  console.error('Set CLOUDFLARE_API_TOKEN (R2 Edit) and CLOUDFLARE_ACCOUNT_ID before uploading.');
  process.exit(1);
}

if (keys.length === 0) {
  console.log('No media objects to upload.');
  process.exit(0);
}

for (const key of keys) {
  const type = contentType(key);
  if (!type) {
    console.error(`No Content-Type mapping for media/${key}`);
    process.exit(1);
  }

  const objectPath = `${BUCKET}/${key}`;
  if (dryRun) {
    console.log(`put ${objectPath} ${type}`);
    continue;
  }

  const result = spawnSync(
    'npx',
    [
      '--yes',
      'wrangler@4',
      'r2',
      'object',
      'put',
      objectPath,
      '--remote',
      '--force',
      `--file=${path.join(mediaRoot, key)}`,
      `--content-type=${type}`,
      `--cache-control=${CACHE_CONTROL}`,
    ],
    { cwd: root, stdio: 'inherit', env: process.env }
  );

  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(
  dryRun ? `Would upload ${keys.length} objects to ${BUCKET}.` : `Uploaded ${keys.length} objects to ${BUCKET}.`
);
