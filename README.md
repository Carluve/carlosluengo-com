# Carlos Luengo

Sitio personal de Carlos Luengo Vera: investigación, docencia e industria.

Se publica como sitio estático (Astro) en Cloudflare Pages. El dominio `carlosluengo.com` sigue en el alojamiento anterior hasta el corte de DNS; este repositorio no lo modifica.

## Desarrollo

Requiere Node.js 22.

```bash
npm install
npm run dev
npm run build
```

`npm run build` genera `dist/`.

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
