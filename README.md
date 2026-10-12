# Carlos Luengo

Sitio personal de Carlos Luengo Vera: investigación, docencia e industria.

El HTML se publica como sitio estático (Astro) en Cloudflare Workers. El dominio `carlosluengo.com` sigue en el alojamiento anterior hasta el corte de DNS; este repositorio no lo modifica.

Las imágenes, vídeos y PDF de las páginas viven en Cloudflare R2 (bucket `carlosluengo-media`) y no entran en `dist/`. La URL pública por defecto es `https://pub-27745be1d92d4677b679da82c54861cb.r2.dev`. Más adelante será `https://media.carlosluengo.com`.

## Desarrollo

Requiere Node.js 22.

```bash
npm install
npm run dev
npm run build
```

`npm run build` genera `dist/`. Falla si `_redirects` tiene reglas duplicadas o si algún archivo de `dist/` supera 20 MiB.

## Medios (R2)

Los archivos están en `media/` con la misma ruta que la URL (`media/blog/<slug>/archivo.webp`). Antes de subirlos, las imágenes de mapa de bits se convierten a WebP (ancho máximo 1600, calidad 80). El vídeo de Comet está en MP4 y WebM. Favicons, el logotipo, la imagen Open Graph por defecto y las fuentes siguen en el build.

`PUBLIC_MEDIA_BASE_URL` cambia el host en el build. Si no está definida, se usa `https://pub-27745be1d92d4677b679da82c54861cb.r2.dev` (`DEFAULT_MEDIA_BASE_URL` en `src/utils/media.ts`, la misma base que `media.baseUrl` en `src/config.yaml`).

Subida completa, con las credenciales en el entorno:

```bash
export CLOUDFLARE_API_TOKEN=...   # token con permiso R2 Edit en la cuenta
export CLOUDFLARE_ACCOUNT_ID=39f8ea10b94ad38470fc3c20c260efdc
npm run upload:media
```

`node scripts/upload-media.mjs --dry-run` lista los objetos sin subirlos. Cada objeto se publica con `npx wrangler r2 object put`, `Content-Type` según la extensión y `Cache-Control: public,max-age=31536000,immutable`.

El workflow `.github/workflows/sync-media.yml` hace lo mismo en cada push que toque `media/**`. Necesita estos secretos del repositorio:

- `CLOUDFLARE_API_TOKEN` — token de API con permiso **R2 Edit** en la cuenta `39f8ea10b94ad38470fc3c20c260efdc`
- `CLOUDFLARE_ACCOUNT_ID` — `39f8ea10b94ad38470fc3c20c260efdc`

`PUBLIC_MEDIA_BASE_URL` no es un secreto. Solo hace falta en el build de Workers si el host debe ser otro (por ejemplo `https://media.carlosluengo.com`) antes de cambiar la base del código.

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
