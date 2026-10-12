#!/usr/bin/env node
// After `astro build`: give /en its own 404.html. Cloudflare's 404-page handling
// serves the nearest 404.html up the path, so /en/missing gets the English page.
import { copyFileSync, existsSync } from 'node:fs';

const dist = process.argv[2] ?? 'dist';
const source = `${dist}/en/404/index.html`;
if (!existsSync(source)) {
  console.error(`postbuild: ${source} not found`);
  process.exit(1);
}
copyFileSync(source, `${dist}/en/404.html`);
console.log('postbuild: dist/en/404.html written');
