# Carlos Luengo — site setup

Personal site scaffolded from [AstroWind](https://github.com/arthelokyo/astrowind) for **Cloudflare Pages**. Spanish-first content.

## Requirements

- **Node.js ≥ 22.12** (AstroWind engines field; this box used Node **22.23.3** via nvm)
- npm (ships with Node)

```bash
# If you use nvm:
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm use 22   # or: nvm install 22
```

## Local development

```bash
npm install
npm run dev
# → http://localhost:4321
```

Useful scripts:

| Command                  | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `npm run dev`            | Dev server                                                 |
| `npm run build`          | Checks media and redirects, then static build → `dist/`    |
| `npm run preview`        | Preview `dist/` locally                                    |
| `npm run check`          | Astro, ESLint, Prettier, redirects and media checks        |
| `npm run media:sync`     | Optimise new files in `media/` and upload them to R2       |
| `npm run media:pull`     | Download the originals from R2 into `media/` (fresh clone) |
| `npm run media:check`    | Fail if a `media:` reference is missing from the manifest  |
| `npm run deploy:preview` | Build and upload a preview version with wrangler           |
| `npm run deploy`         | Build and deploy to production with wrangler               |

Run `npx wrangler login` once. `wrangler.jsonc` pins the `carluve @enterprise` account, which holds the zone, the Worker and the R2 bucket.

## Deploy

The site is a Worker with static assets (`wrangler.jsonc`, `assets.directory: ./dist`). Workers Builds runs `npm run build` on every push; each branch gets a preview URL such as `https://<branch>-carlosluengo-com.carluve.workers.dev`.

The media check needs only `src/data/media.json`, so the build never needs R2 credentials.

## Media on R2

Images, video and PDFs for posts are **not** in git. They live in the R2 bucket `carlosluengo-media`, served at **https://media.carlosluengo.com**.

| What               | Where                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| Originals (local)  | `media/` (git-ignored), e.g. `media/blog/<post-slug>/cover.png`             |
| Originals (backup) | R2 `originals/<path>` (not public)                                          |
| Published variants | R2 `<path-without-ext>-<hash>-<width>.{avif,webp}` and `-og.jpg` (1200×626) |
| Manifest (tracked) | `src/data/media.json`: dimensions and variant keys per file                 |

To add media to a post:

1. Put the file in `media/blog/<post-slug>/`.
2. Run `npm run media:sync`. Raster images get AVIF and WebP at 480, 960 and 1600 px plus a social-card JPG. SVG, video and PDF are uploaded as they are. Every published key carries a content hash and is served with `Cache-Control: immutable`.
3. Refer to it as `media:blog/<post-slug>/<file>`: in front matter (`image: "media:blog/…"`), in Markdown (`![alt](media:blog/…)`), or in raw HTML (`<video src="media:blog/…">`, `<a href="media:files/…">`).
4. Commit the post and `src/data/media.json`.

`src/utils/frontmatter.ts` (`mediaRehypePlugin`) turns Markdown images into a responsive `<picture>`. `src/components/common/Image.astro` does the same for covers, and `src/utils/images.ts` uses the `-og.jpg` cut for Open Graph.

To change an image, replace the file and sync again. The new hash produces new keys, so stale caches are never served.

**Do not** point DNS for carlosluengo.com here until you intentionally cut over.

## Site map

- `/` — Inicio
- `/about` — Sobre mí
- `/blog` — Blog
- `/academia` — Investigación y docencia
- `/developer` — Experimentación técnica
- `/contact` — Contacto (LinkedIn, GitHub y Google Scholar)
- `/privacy` — Política de privacidad
- `/terms` — Aviso legal

Config: `src/config.yaml`, menus: `src/navigation.ts`.

## Next product steps (optional)

- Add an author photograph and a dedicated Open Graph image
- Expand Academia only when a new preprint or DOI exists
- Do not point DNS for carlosluengo.com here until the intentional cutover
