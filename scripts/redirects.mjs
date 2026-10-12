#!/usr/bin/env node
/**
 * Normalise and validate public/_redirects for Workers static assets.
 *
 * Cloudflare parses each source with the URL parser (fragments are dropped,
 * spaces and accents are percent-encoded). `wrangler versions upload` then
 * rejects a repeated parsed path with code 100324. This script also treats
 * letter case as the same path, keeps the first rule, and checks the file
 * against the Workers _redirects limits.
 *
 * A trailing slash is a different path for Cloudflare: `/old` does not match a
 * request for `/old/`, so old URLs are listed in both forms.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_STATIC_REDIRECTS = 2000;
export const MAX_DYNAMIC_REDIRECTS = 100;
export const MAX_LINE_LENGTH = 1000;
export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const PERMITTED_STATUS_CODES = new Set([200, 301, 302, 303, 307, 308]);

const SPLAT_REGEX = /\*/;
const PLACEHOLDER_REGEX = /:[A-Za-z]\w*/;
const INDEX_TARGET_REGEX = /\/index(\.html)?$/;

const DEFAULT_PATH = 'public/_redirects';

/**
 * Path Cloudflare stores after URL parsing. Fragments are not part of the path.
 * A raw `#` or `?` is shielded first so a character that belongs to the path
 * (as in "FOCA Visual C#") is not discarded.
 */
export function cloudflarePathname(token, { shieldReserved = true } = {}) {
  let path = token;
  if (shieldReserved) {
    path = path.replaceAll('#', '%23').replaceAll('?', '%3F');
  }
  if (!path.startsWith('/')) path = `/${path}`;
  return new URL(`//${path}`, 'relative://').pathname;
}

/** Comparison key: encoding, accents and case fold together; a trailing slash does not. */
export function redirectKey(token) {
  const pathname = cloudflarePathname(token, { shieldReserved: true });
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  decoded = decoded.normalize('NFC');
  if (decoded.length > 1) decoded = decoded.replace(/\/{2,}$/, '/');
  return decoded.toLowerCase();
}

export function canonicalSource(token) {
  const pathname = cloudflarePathname(token, { shieldReserved: true });
  if (pathname.length > 1) return pathname.replace(/\/{2,}$/, '/');
  return pathname;
}

function isDynamic(pathname) {
  return SPLAT_REGEX.test(pathname) || PLACEHOLDER_REGEX.test(pathname);
}

function validateDestination(destination) {
  if (destination.startsWith('/')) return null;
  if (/^https:\/\/[^/\s]+/i.test(destination)) return null;
  return 'Destination must be a relative path or an https URL.';
}

function parseRule(line) {
  const stripped = line.replace(/\s+#.*$/, '').trim();
  const tokens = stripped.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 3) {
    return {
      error: `Expected exactly 2 or 3 whitespace-separated tokens. Got ${tokens.length}.`,
    };
  }

  const [source, destination, statusToken] = tokens;
  if (!source.startsWith('/')) {
    return { error: 'Source URLs should begin with a forward slash.' };
  }

  let status = 302;
  if (statusToken !== undefined) {
    if (!/^[0-9]+$/.test(statusToken) || !PERMITTED_STATUS_CODES.has(Number(statusToken))) {
      return {
        error: `Valid status codes are 200, 301, 302 (default), 303, 307, or 308. Got ${statusToken}.`,
      };
    }
    status = Number(statusToken);
  }

  const destinationError = validateDestination(destination);
  if (destinationError) return { error: destinationError };

  return { source, destination, status };
}

/**
 * @param {string} input
 * @param {{ maxStatic?: number, maxDynamic?: number, maxLineLength?: number }} [options]
 */
export function analyzeRedirects(input, options = {}) {
  const maxStatic = options.maxStatic ?? MAX_STATIC_REDIRECTS;
  const maxDynamic = options.maxDynamic ?? MAX_DYNAMIC_REDIRECTS;
  const maxLineLength = options.maxLineLength ?? MAX_LINE_LENGTH;

  const errors = [];
  const kept = [];
  const removed = [];
  const seenKeys = new Map();
  const seenUploadedPaths = new Map();
  const outputLines = [];
  let staticCount = 0;
  let dynamicCount = 0;
  let seenDynamic = false;

  const endsWithNewline = input.endsWith('\n') || input.length === 0;
  const lines = input.split('\n');
  if (endsWithNewline && lines[lines.length - 1] === '') lines.pop();

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const lineNumber = index + 1;
    const trimmed = raw.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      outputLines.push(raw);
      continue;
    }

    if (raw.length > maxLineLength) {
      errors.push({
        lineNumber,
        message: `Line ${lineNumber} exceeds the maximum length of ${maxLineLength}.`,
      });
      continue;
    }

    const parsed = parseRule(trimmed);
    if (parsed.error) {
      errors.push({ lineNumber, message: `Line ${lineNumber}: ${parsed.error}` });
      continue;
    }

    let key;
    let canonical;
    let uploadedPath;
    try {
      key = redirectKey(parsed.source);
      canonical = canonicalSource(parsed.source);
      uploadedPath = cloudflarePathname(parsed.source, { shieldReserved: false });
    } catch {
      errors.push({ lineNumber, message: `Line ${lineNumber}: Could not parse source ${parsed.source}.` });
      continue;
    }

    if (parsed.status === 200 && !parsed.destination.startsWith('/')) {
      errors.push({
        lineNumber,
        message: `Line ${lineNumber}: Proxy (200) redirects can only point to relative paths.`,
      });
      continue;
    }

    const relativeTarget = parsed.destination.startsWith('/');
    const wildcardToIndex = canonical.endsWith('/*') && INDEX_TARGET_REGEX.test(parsed.destination);
    const rootToIndex = (canonical === '/' || canonical.endsWith('/')) && INDEX_TARGET_REGEX.test(parsed.destination);
    if (relativeTarget && (wildcardToIndex || rootToIndex)) {
      errors.push({
        lineNumber,
        message: `Line ${lineNumber}: Infinite loop detected in this rule.`,
      });
      continue;
    }

    const previous = seenKeys.get(key);
    if (previous) {
      const sameTarget = previous.destination === parsed.destination && previous.status === parsed.status;
      if (sameTarget) {
        removed.push({
          lineNumber,
          source: parsed.source,
          canonical: previous.canonical,
          firstLine: previous.lineNumber,
        });
        errors.push({
          lineNumber,
          kind: 'duplicate',
          message: `Line ${lineNumber}: Duplicate rule for path ${previous.canonical}.`,
        });
      } else {
        errors.push({
          lineNumber,
          kind: 'conflict',
          message: `Line ${lineNumber}: Duplicate rule for path ${previous.canonical} points to ${parsed.destination} ${parsed.status}, but line ${previous.lineNumber} points to ${previous.destination} ${previous.status}.`,
        });
      }
      continue;
    }

    const uploadedPrevious = seenUploadedPaths.get(uploadedPath);
    if (uploadedPrevious && uploadedPrevious.key !== key) {
      const sameTarget =
        uploadedPrevious.destination === parsed.destination && uploadedPrevious.status === parsed.status;
      if (sameTarget) {
        removed.push({
          lineNumber,
          source: parsed.source,
          canonical: uploadedPrevious.canonical,
          firstLine: uploadedPrevious.lineNumber,
        });
        errors.push({
          lineNumber,
          kind: 'duplicate',
          message: `Line ${lineNumber}: Duplicate rule for path ${uploadedPath}.`,
        });
      } else {
        errors.push({
          lineNumber,
          kind: 'conflict',
          message: `Line ${lineNumber}: Duplicate rule for path ${uploadedPath} points to ${parsed.destination} ${parsed.status}, but line ${uploadedPrevious.lineNumber} points to ${uploadedPrevious.destination} ${uploadedPrevious.status}.`,
        });
      }
      continue;
    }

    const dynamic = isDynamic(canonical);
    if (!dynamic && seenDynamic) {
      errors.push({
        lineNumber,
        message: `Line ${lineNumber}: Static redirects must appear before dynamic redirects.`,
      });
      continue;
    }

    if (dynamic) {
      if (dynamicCount + 1 > maxDynamic) {
        errors.push({
          lineNumber,
          message: `Line ${lineNumber}: Maximum number of dynamic redirects is ${maxDynamic}.`,
        });
        continue;
      }
      dynamicCount += 1;
      seenDynamic = true;
    } else if (staticCount + 1 > maxStatic) {
      errors.push({
        lineNumber,
        message: `Line ${lineNumber}: Maximum number of static redirects is ${maxStatic}.`,
      });
      continue;
    } else {
      staticCount += 1;
    }

    seenKeys.set(key, {
      lineNumber,
      destination: parsed.destination,
      status: parsed.status,
      canonical,
      key,
    });
    const uploadedRecord = {
      lineNumber,
      key,
      canonical,
      destination: parsed.destination,
      status: parsed.status,
    };
    seenUploadedPaths.set(uploadedPath, uploadedRecord);
    seenUploadedPaths.set(canonical, uploadedRecord);

    const rule = {
      lineNumber,
      source: parsed.source,
      canonical,
      destination: parsed.destination,
      status: parsed.status,
      dynamic,
    };
    kept.push(rule);
    outputLines.push(`${canonical} ${parsed.destination} ${parsed.status}`);
  }

  let text = outputLines.join('\n');
  if (endsWithNewline) text += '\n';

  const fatal = errors.filter((error) => error.kind !== 'duplicate');
  return {
    text,
    kept,
    removed,
    errors,
    fatal,
    staticCount,
    dynamicCount,
  };
}

export function checkRedirects(input, options) {
  return analyzeRedirects(input, options).errors;
}

export function formatMiB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function findOversizedFiles(root, maxBytes = MAX_ASSET_BYTES) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const size = statSync(full).size;
        if (size > maxBytes) found.push({ path: full, size });
      }
    }
  };
  walk(root);
  return found;
}

/** Fail when dist has a duplicate redirect or any file larger than 20 MiB. */
export function checkDist(root, options = {}) {
  const maxBytes = options.maxAssetBytes ?? MAX_ASSET_BYTES;
  const errors = [];
  const redirectsPath = join(root, '_redirects');
  if (!existsSync(redirectsPath)) {
    errors.push(`Missing ${redirectsPath}.`);
  } else {
    for (const error of checkRedirects(readFileSync(redirectsPath, 'utf8'), options)) {
      errors.push(error.message);
    }
  }
  for (const file of findOversizedFiles(root, maxBytes)) {
    errors.push(`Asset too large: ${file.path} is ${formatMiB(file.size)} MiB (maximum ${formatMiB(maxBytes)} MiB).`);
  }
  return errors;
}

function printErrors(errors) {
  for (const error of errors) {
    console.error(error.message);
  }
}

function run(argv) {
  const [command = 'check', file = DEFAULT_PATH] = argv;
  if (command !== 'check' && command !== 'generate' && command !== 'check-dist') {
    console.error('Usage: node scripts/redirects.mjs <check|generate|check-dist> [file]');
    process.exit(2);
  }

  if (command === 'check-dist') {
    const root = file === DEFAULT_PATH ? 'dist' : file;
    const errors = checkDist(root);
    if (errors.length > 0) {
      for (const message of errors) console.error(message);
      process.exit(1);
    }
    console.log(`dist: no duplicate redirects and no file over ${formatMiB(MAX_ASSET_BYTES)} MiB`);
    return;
  }

  const input = readFileSync(file, 'utf8');
  const result = analyzeRedirects(input);

  if (command === 'generate') {
    if (result.fatal.length > 0) {
      printErrors(result.fatal);
      process.exit(1);
    }
    if (result.text !== input) {
      writeFileSync(file, result.text);
    }
    console.log(
      `redirects: ${result.kept.length} rules (${result.staticCount} static, ${result.dynamicCount} dynamic), removed ${result.removed.length} duplicates`
    );
    return;
  }

  if (result.errors.length > 0) {
    printErrors(result.errors);
    process.exit(1);
  }
  console.log(
    `redirects: ${result.kept.length} rules (${result.staticCount} static, ${result.dynamicCount} dynamic), no duplicates`
  );
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) run(process.argv.slice(2));
