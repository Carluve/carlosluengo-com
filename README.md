# Carlos Luengo

Sitio personal de Carlos Luengo Vera: investigación, docencia e industria.

El HTML se publica como sitio estático (Astro) en Cloudflare Workers. El dominio `carlosluengo.com` sigue en el alojamiento anterior hasta el corte de DNS; este repositorio no lo modifica.

Las imágenes, vídeos y PDF de los posts viven en Cloudflare R2 (bucket `carlosluengo-media`), se sirven desde `https://media.carlosluengo.com` y no entran en git ni en `dist/`.

## Desarrollo

Requiere Node.js 22.

```bash
npm install
npm run dev
npm run build
```

`npm run build` genera `dist/`. Falla si `_redirects` tiene reglas duplicadas o si algún archivo de `dist/` supera 20 MiB.

## Medios (R2)

Los originales están en `media/` (ignorado por git; `npm run media:pull` los descarga de R2). En los posts se citan como `media:blog/<slug>/archivo.png`.

```bash
npx wrangler login   # una vez
npm run media:sync   # AVIF/WebP a 480, 960 y 1600 px + JPG Open Graph; sube a R2 y actualiza src/data/media.json
```

El build solo lee `src/data/media.json` y falla si una referencia `media:` no está en el manifiesto. Favicons, logotipo, imágenes de la home y fuentes siguen en el build de Astro. Detalles en [SETUP.md](./SETUP.md#media-on-r2).

## Páginas

- `/` — Inicio
- `/about` — Sobre mí
- `/academia` — Investigación y docencia
- `/developer` — Experimentación técnica
- `/blog` — Notas
- `/contact` — Contacto
- `/privacy` — Privacidad
- `/terms` — Aviso legal

La configuración está en `src/config.yaml`. La navegación, en `src/navigation.ts`.

## Tema

La base de presentación es [AstroWind](https://github.com/arthelokyo/astrowind), bajo licencia MIT (`LICENSE.md`). El contenido es propio.
