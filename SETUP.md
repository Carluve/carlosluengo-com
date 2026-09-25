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
cd /workspace/carlosluengo-com   # or your clone path
npm install
npm run dev
# → http://localhost:4321
```

Useful scripts:

| Command           | Purpose                 |
| ----------------- | ----------------------- |
| `npm run dev`     | Dev server              |
| `npm run build`   | Static build → `dist/`  |
| `npm run preview` | Preview `dist/` locally |

## Cloudflare Pages build settings

Create a Pages project connected to the GitHub repo (see next section). Suggested settings:

| Setting          | Value            |
| ---------------- | ---------------- |
| Framework preset | Astro (or None)  |
| Build command    | `npm run build`  |
| Build output dir | `dist`           |
| Root directory   | `/` (repo root)  |
| Node.js version  | `22` (or `22.x`) |

The project already sets `output: 'static'` in `astro.config.ts`. Optional: `wrangler.jsonc` names the project `carlosluengo-com` and points assets at `./dist` for Workers static assets / local `wrangler` previews.

**Do not** point DNS or Obsidian Publish here until you intentionally cut over.

## Connect GitHub repo `Carluve/carlosluengo-com`

This scaffold does **not** create the remote. When you are ready:

1. Create an empty repo on GitHub: **`Carluve/carlosluengo-com`** (no README/license if you already have local files).
2. From the project root:

```bash
git init   # if not already a git repo
git add .
git commit -m "Initial AstroWind scaffold for carlosluengo.com"
git branch -M main
git remote add origin git@github.com:Carluve/carlosluengo-com.git
git push -u origin main
```

3. In Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → connect the GitHub repo.
4. Use the build settings above; deploy a preview, then attach the custom domain `carlosluengo.com` when ready.

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
