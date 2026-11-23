---
publishDate: 2026-07-07T09:00:00Z
draft: false
image: 'media:blog/cloudflare-static-assets-guia/portada.png'
title: 'Sitios estáticos en Workers: static assets, SPA y migración desde Pages'
excerpt: 'Serie Cloudflare, parte 27. Cómo publicar una web estática o una SPA en Workers con static assets: la carpeta de assets, el wrangler.jsonc, las páginas 404 y el modo SPA, html_handling, run_worker_first para tu API, _headers y _redirects, frameworks, cómo migrar desde Pages y qué es gratis.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'workers'
  - 'static assets'
  - 'pages'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 27 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En la [parte 14](/blog/cloudflare-workers-guia) los static assets aparecieron de pasada. Hoy les toca a ellos: son la forma recomendada de publicar una web estática, una SPA o una aplicación completa en Cloudflare. Este blog funciona así.

## Qué es

Los **static assets** son los ficheros (HTML, CSS, JavaScript, imágenes, fuentes) que subes junto a un Worker. Cloudflare los guarda, los cachea en su red y los sirve sin ejecutar tu código.

Las piezas:

- **`assets.directory`**: la carpeta que Wrangler sube en cada despliegue (`dist`, `build`, `public`…).
- **El Worker (`main`)**: opcional. Sin él, sitio estático puro; con él, API, autenticación o SSR.
- **El binding `ASSETS`**: opcional. Tu código pide un fichero con `env.ASSETS.fetch()`.
- **Opciones de enrutado**: `not_found_handling`, `html_handling` y `run_worker_first`.
- **`_headers` y `_redirects`**: ficheros de texto en la carpeta de assets con cabeceras y redirecciones.

Cada versión del Worker lleva su propio **manifiesto de assets**. Cloudflare recomienda Workers en lugar de Pages para proyectos nuevos: Pages sigue funcionando, pero las novedades llegan a Workers.

## Casos de uso

- **Un blog o una documentación generada** con Astro, Hugo o Docusaurus. Solo assets, sin código.
- **Una SPA con su API.** React o Vue en el navegador y un Worker que responde a `/api/*`, en el mismo dominio y sin CORS.
- **Middleware delante de los ficheros.** Comprobar una sesión, elegir idioma o reescribir HTML.
- **Salir de Pages** para tener Durable Objects, Cron Triggers o despliegues graduales.

## Arquitectura

![Recorrido de una petición en un Worker con static assets: si la ruta está en run_worker_first se ejecuta el Worker; si no, se busca el fichero en el manifiesto y se sirve gratis aplicando _redirects y _headers; si no existe, decide not_found_handling. Debajo, tabla con los valores none, single-page-application y 404-page](media:blog/cloudflare-static-assets-guia/00-arquitectura.png)

Para cada petición, en el centro de datos más cercano:

1. Si la ruta coincide con **`run_worker_first`**, se ejecuta tu Worker. Esa petición se cobra.
2. Si no, Cloudflare busca la ruta en el **manifiesto** de la versión. Si el fichero existe, lo sirve directamente, aplicando antes `_redirects` y después `_headers`. **No se cobra.**
3. Si el fichero no existe, decide **`not_found_handling`**. Con un Worker en `main`, las peticiones que no son de navegación llegan a tu código.

Las *peticiones de navegación* llevan `Sec-Fetch-Mode: navigate`. Con una fecha de compatibilidad del 1 de abril de 2025 o posterior y `not_found_handling` configurado, no ejecutan el Worker: reciben el HTML de la SPA o la página 404.

La caché es automática, con [Tiered Cache](/blog/cloudflare-cdn-cache-guia) dentro de la red.

## Implementación paso a paso

El ejemplo: una SPA en `./dist` con una API en `/api/*`.

### 1. Crea el proyecto

En la terminal, C3 crea el proyecto con su `wrangler.jsonc`:

```bash
npm create cloudflare@latest -- mi-spa --framework=react
```

Si ya tienes la web compilada y no usas framework, también puedes usar el panel: **Workers & Pages › Create application**.

Con **Upload your static files** pones un nombre y arrastras la carpeta. Para un proyecto que vas a mantener, mejor Wrangler o el repositorio.

### 2. Configura los assets

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "mi-spa",
  "main": "./src/index.ts",
  "compatibility_date": "2026-11-23",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  }
}
```

**`not_found_handling`** decide qué pasa cuando no hay fichero:

- **`none`** (por defecto): 404 sin cuerpo, o tu Worker si hay `main`.
- **`single-page-application`**: devuelve `/index.html` con un 200. El enrutado lo hace tu SPA en el navegador.
- **`404-page`**: devuelve el `404.html` más cercano con un 404. Lo normal en webs generadas.

**`html_handling`** controla la barra final de las URL de HTML. Por defecto es `auto-trailing-slash`: `/contacto.html` se sirve en `/contacto` y `/blog/index.html` en `/blog/`. Las variantes redirigen con un 307. Las otras opciones son `force-trailing-slash`, `drop-trailing-slash` y `none`. Este blog usa `drop-trailing-slash`, porque Astro genera las URL sin barra final.

Dos detalles más:

- **`.assetsignore`** en la carpeta de assets, con formato de `.gitignore`, evita subir ficheros que no deben ser públicos.
- **`assets.base_path`** (desde el 11 de noviembre de 2026, Wrangler 4.148.0 o posterior) sirve los assets bajo un prefijo, como `/blog/`, sin mover los ficheros.

### 3. Añade la API con `run_worker_first`

`run_worker_first` acepta `true` (el Worker va siempre primero) o una lista de rutas con `*` y exclusiones con `!`. Las exclusiones mandan y el orden no importa. Admite hasta 100 entradas.

En una SPA, la lista tiene otra ventaja: desactiva la detección por `Sec-Fetch-Mode`. Sin ella, si abres `/api/saludo` en el navegador, recibes el `index.html` en lugar del JSON.

```ts
// src/index.ts
interface Env {
  ASSETS: Fetcher;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/saludo" && request.method === "GET") {
      const nombre = url.searchParams.get("nombre")?.trim();
      if (!nombre || nombre.length > 50) {
        return json({ error: "Falta 'nombre' (máximo 50 caracteres)" }, 400);
      }
      return json({ saludo: `Hola, ${nombre}` });
    }

    if (url.pathname === "/api/contacto" && request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "El cuerpo no es JSON válido" }, 400);
      }
      const email =
        typeof body === "object" && body !== null && "email" in body
          ? (body as { email: unknown }).email
          : undefined;
      if (typeof email !== "string" || email.length > 254 || !email.includes("@")) {
        return json({ error: "Falta un 'email' válido" }, 400);
      }
      // Guárdalo en D1 o mándalo a una cola; aquí solo se acepta.
      return json({ ok: true }, 202);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "No encontrado" }, 404);
    }

    // Cualquier otra ruta: el fichero, o index.html por el modo SPA.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

El binding `ASSETS` solo es válido si hay `main`. En un sitio sin código, quítalo.

### 4. Cabeceras y redirecciones

Los dos ficheros van en la carpeta de assets (en un framework, normalmente en `public/`). No se publican: Cloudflare los lee y los aplica.

`_headers`:

```txt
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

https://:version.:subdomain.workers.dev/*
  X-Robots-Tag: noindex
```

Por defecto, cada asset sale con `Cache-Control: public, max-age=0, must-revalidate` y un `ETag`: el navegador pregunta siempre si ha cambiado. La primera regla deja un año los ficheros con *hash*; la última evita que se indexen tus URL de `workers.dev`.

Cuidado con dos cosas. Si dos reglas ponen la misma cabecera, los valores se **unen con una coma**, y con `Cache-Control` eso da directivas contradictorias. Para cambiar el valor de una ruta concreta, quita la cabecera con `! Cache-Control` y vuelve a ponerla, en una regla **posterior**. Y `_headers` **no se aplica a las respuestas de tu Worker**: esas cabeceras las pones en el código.

`_redirects`:

```txt
/inicio / 301
/blog/:anio/:slug /blog/:slug 301
/docs/* https://docs.example.com/:splat 302
/ayuda /soporte 200
```

Formato: origen, destino y código (302 por defecto), con comodines y marcadores. Con `200` sirve otra ruta del sitio sin cambiar la URL. No hay redirecciones por país, cookie ni dominio.

### 5. Despliega y pon tu dominio

```bash
npx wrangler deploy
```

Wrangler sube solo los ficheros nuevos o cambiados. Después, en **Settings › Domains & Routes › Add** del Worker eliges **Custom Domain** y escribes el nombre. El dominio tiene que estar en Cloudflare. A diferencia de Pages, Workers no admite dominios con DNS fuera de Cloudflare.

### 6. Si vienes de Pages

- **`pages_build_output_dir`** pasa a ser **`assets.directory`**.
- **El modo SPA o 404 ya no se adivina.** Pages lo deducía de si había `404.html`. En Workers lo declaras en `not_found_handling`.
- **Pages ejecutaba las Functions antes que los assets; Workers, al revés.** Si tu middleware comprobaba sesiones o registraba peticiones, añade `run_worker_first`.
- **Una carpeta `functions/`** se compila a un Worker con `npx wrangler pages functions build --outdir=./dist/worker/`. Un `_worker.js` en modo avanzado se saca de la carpeta de assets (o se mete en `.assetsignore`) y se apunta desde `main`.
- **El binding `ASSETS` hay que declararlo**, y puedes cambiarle el nombre.
- **`wrangler pages dev` y `wrangler pages deploy`** pasan a `wrangler dev` (puerto 8787, no 8788) y `wrangler deploy`. `_headers` y `_redirects` funcionan igual.
- Cuando todo el tráfico esté en el Worker, borra el proyecto: `npx wrangler pages project delete`.

### Lo mismo, como código

Con el proveedor de Terraform (v5.11.0 o posterior), `cloudflare_workers_script` sube el código y los assets de una vez:

```hcl
resource "cloudflare_workers_script" "mi_spa" {
  account_id  = var.account_id
  script_name = "mi-spa"

  content_file   = "./dist-worker/index.js"
  content_sha256 = filesha256("./dist-worker/index.js")
  main_module    = "index.js"

  assets = {
    directory = "./dist"
    config = {
      not_found_handling = "single-page-application"
      run_worker_first   = ["/api/*"]
    }
  }
}
```

Terraform genera el manifiesto y sube solo lo que cambia. Para separar versiones y despliegues están `cloudflare_worker_version` y `cloudflare_workers_deployment`.

## Cómo comprobarlo

En local, `npx wrangler dev` sirve los assets en `http://localhost:8787`. En producción:

```bash
# Un fichero estático: cabeceras por defecto o las de _headers
curl -sI https://app.example.com/ | grep -iE "cache-control|etag"

# Ruta de la SPA que no existe como fichero: 200 con index.html
curl -s -o /dev/null -w "%{http_code}\n" https://app.example.com/perfil/ajustes

# La API valida la entrada: 400 en los dos casos
curl -s "https://app.example.com/api/saludo"
curl -s -X POST -d 'esto no es json' https://app.example.com/api/contacto
```

Si tras un despliegue falla algún fichero, puede ser **desfase de versiones**: el HTML llegó de la versión nueva y el JavaScript se pidió a la anterior, que no lo tiene. Usa nombres con *hash* y conserva en cada versión los ficheros que piden las páginas anteriores.

## Límites y precios

Las peticiones que sirve un static asset son **gratis e ilimitadas** en los dos planes de Workers, y guardar los ficheros no cuesta nada. Solo se cobran las que ejecutan tu Worker, al precio normal de [Workers](/blog/cloudflare-workers-guia).

| Límite | Workers Free | Workers Paid |
|---|---|---|
| Ficheros por versión | 20.000 | 100.000 |
| Tamaño por fichero | 25 MiB | 25 MiB |
| Reglas en `_headers` | 100 (2.000 caracteres por línea) | 100 |
| `_redirects` | 2.000 estáticas + 100 dinámicas | 2.000 estáticas + 100 dinámicas |
| Entradas en `run_worker_first` | 100 | 100 |

- Los 100.000 ficheros necesitan Wrangler 4.34.0 o posterior.
- En Workers Free, las rutas de `run_worker_first` siempre ejecutan el Worker. Si pasas de las 100.000 peticiones diarias, esas rutas devuelven **429** en lugar de servir el fichero. Las exclusiones con `!` siguen sirviendo assets.
- Las peticiones con cabecera `Range` reciben el fichero entero con un 200, no un 206. Safari necesita el 206 para algunos vídeos: sírvelos desde el Worker.
- Para más de 2.100 redirecciones, usa Bulk Redirects.
- Un Worker admite una sola colección de assets.

## Documentación oficial

- [Static assets](https://developers.cloudflare.com/workers/static-assets/) y [configuración y binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [SPA](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/), [sitios generados y páginas 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) y [html_handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
- [_headers](https://developers.cloudflare.com/workers/static-assets/headers/) y [_redirects](https://developers.cloudflare.com/workers/static-assets/redirects/)
- [Facturación y limitaciones](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) y [límites de la plataforma](https://developers.cloudflare.com/workers/platform/limits/#static-assets)
- [Migrar de Pages a Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [Desfase de versiones y static assets](https://developers.cloudflare.com/workers/versions-and-deployments/version-skew/)
- [Guías de frameworks](https://developers.cloudflare.com/workers/framework-guides/)
- Changelog: [Terraform sube assets](https://developers.cloudflare.com/changelog/post/2025-10-09-assets-terraform/), [100.000 ficheros por versión](https://developers.cloudflare.com/changelog/post/2025-09-02-increased-static-asset-limits/), [run_worker_first con rutas](https://developers.cloudflare.com/changelog/post/2025-06-17-advanced-routing/) y [assets.base_path](https://developers.cloudflare.com/changelog/post/2026-11-11-static-assets-base-path/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** detección de credenciales filtradas, cómo saber si en tu login entran contraseñas robadas.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
