# carlosluengo.com

Personal site of Carlos Luengo: Astro (AstroWind) built as static files and served by Cloudflare Workers
static assets. See [AGENTS.md](./AGENTS.md) for the Astro dev server and docs links.

## How it ships

- **Merge to `main` = deploy** (Workers Builds). Work on a branch and open a PR; never push to `main`.
- `npm run build` runs the real pipeline: media manifest check, redirects, worker tests, `astro build`, postbuild.
  It must pass before a PR is ready. Also run `npx astro check` (0 errors).
- `worker/index.ts` runs only for `/` (ES/EN negotiation). Its entry module may export only the handler: helpers
  live in `worker/lang.ts` (workerd refuses to start otherwise).
- Headers and caching: `public/_headers`. Config: `wrangler.jsonc`.

## Content

- Posts: `src/data/post/*.md` or `.mdx`, frontmatter `publishDate`, `title`, `excerpt`, `category`, `tags`,
  `lang`. Spanish by default.
- **No future dates.** The site does not hide posts dated in the future, so `publishDate` must be today or earlier.
- Images are not committed: they live in R2 (`media.carlosluengo.com`) and posts reference them as
  `media:blog/<slug>/<file>`. Uploading needs `npm run media:sync` with a wrangler login, which CI does not have.
- Series (Serie Cloudflare, Serie Producto) are defined in `src/data/serie-*.ts`.
- Every page and post has a Markdown twin (`/<path>.md`) for agents, built from `src/utils/markdown.ts`.

## Rules

- **Every figure needs a source** (link + date) that you have opened. A search snippet is not a source. If a number
  cannot be verified on the primary page, leave it out or label it clearly.
- Do not run prettier on `src/data/post/**` or the series data: it reformats published posts.
- Keep `prettier-plugin-astro` at 0.14 (1.x reformats ~77 components and changes inline spacing).
- Do not name customers or companies as Cloudflare customers in posts without the author's OK.
- Do not redesign the site: the author prefers the current design. Propose visual changes, don't ship them.
- Never commit secrets, `.wrangler/` or `dist/`.
