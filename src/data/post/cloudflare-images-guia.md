---
publishDate: 2026-08-18T09:00:00Z
draft: false
image: 'media:blog/cloudflare-images-guia/portada.png'
title: 'Cloudflare Images: transformar y optimizar imágenes en el borde'
excerpt: 'Serie Cloudflare, parte 33. Qué es Cloudflare Images, cómo redimensionar y convertir a AVIF o WebP con una URL o desde un Worker, cuándo guardar las imágenes en Images y cuándo en R2, qué hace Polish y cómo se cuentan las transformaciones únicas.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'images'
  - 'rendimiento'
  - 'workers'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 33 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

La [caché](/blog/cloudflare-cdn-cache-guia) acelera lo que ya sirves, pero no lo hace más pequeño. Si muestras a 400 píxeles una foto de 4.000, cada visitante descarga de más. Cloudflare Images lo arregla sin generar cada tamaño a mano.

## Qué es

Cloudflare Images redimensiona, recorta, convierte y comprime imágenes en el borde, en el momento en que se piden, y guarda el resultado en caché. Lo puedes usar de dos maneras:

- **Transformar imágenes remotas.** Las originales siguen en tu servidor o en [R2](/blog/cloudflare-r2-guia); Cloudflare las descarga, las transforma y cachea el resultado. Se pide con una URL (`/cdn-cgi/image/...`) o desde un [Worker](/blog/cloudflare-workers-guia).
- **Guardar las imágenes en Images (*hosted images*).** Subes la original y la sirves con **variantes** (tamaños con nombre). Necesita el plan de pago de Images.

Aparte está **Polish**, un ajuste de zona que comprime las imágenes de tu origen sin cambiar las URL.

**Planes.** Las transformaciones están en todas las cuentas: el plan Free de Images incluye 5.000 transformaciones únicas al mes. Guardar imágenes en Images requiere el plan Paid. Polish no está en el plan Free de zona. **Solo Enterprise:** AVIF como formato de **entrada** (como salida está para todos).

## Casos de uso

- **Una web con fotos grandes.** Un blog o una tienda que sirve la misma foto como miniatura, tarjeta y portada, desde un único original.
- **AVIF y WebP sin tocar el origen.** Con `format=auto`, cada navegador recibe el formato más eficiente que acepta.
- **Imágenes que suben tus usuarios.** Redimensionar y quitar metadatos, incluido el GPS, antes de guardarlas.

## Arquitectura

![Flujo de Cloudflare Images: el navegador pide una URL con /cdn-cgi/image o una ruta atendida por un Worker; el borde busca la versión transformada en caché; si no está, descarga el original del origen, R2 o Images, lo transforma (tamaño, formato, calidad) y lo cachea; abajo, tabla con transformar remotas, imágenes alojadas y Polish](media:blog/cloudflare-images-guia/00-arquitectura.png)

1. El navegador pide una imagen transformada: por URL, por una ruta que atiende un Worker o por una regla (*flow*) que reescribe la petición.
2. Cloudflare busca en caché esa combinación de original y parámetros. Si está (**HIT**), la sirve sin tocar el origen.
3. Si no está (**MISS**), descarga el original, lo cachea con las reglas normales de caché, aplica los parámetros y guarda el resultado.
4. Las versiones transformadas se cachean al menos una hora, y más si el `Cache-Control` del original lo permite. Se guardan bajo la URL del original: **purgar el original purga todas sus versiones**. Las URL que empiezan por `/cdn-cgi/` no se pueden purgar una a una.

Cloudflare pide los originales de forma anónima, sin cookies ni autenticación.

**Negociación de formato.** Con `format=auto`, Cloudflare mira la cabecera `Accept`: AVIF si el navegador lo acepta, si no WebP, y si no el formato original. Si la imagen es demasiado grande para codificarla rápido en AVIF, cae a WebP o JPEG.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro, con los nombres de las zonas tapados.

### 1. Activa las transformaciones en la zona

En **Images & Stream › Transformations**, elige la zona y activa las transformaciones.

En **Sources** decides de dónde se pueden sacar originales. Por defecto, solo de la propia zona. Con **Add origin** añades otros (un dominio, con `*.` delante para incluir subdominios, y opcionalmente una ruta). **Any origin** deja transformar cualquier imagen pública de internet desde tu zona: no lo actives.

![Images › Transformations: zonas con las transformaciones activadas o desactivadas (nombres tapados) y uso de transformaciones únicas, 0 de 5.000](media:blog/cloudflare-images-guia/01-panel.png)

### 2. Pide una imagen con la URL

El formato es:

```
https://<zona>/cdn-cgi/image/<opciones>/<imagen-original>
```

Por ejemplo, 800 píxeles como máximo y el mejor formato para cada navegador:

```html
<img
  src="/cdn-cgi/image/width=800,fit=scale-down,format=auto/fotos/playa.jpg"
  srcset="/cdn-cgi/image/width=1600,fit=scale-down,format=auto/fotos/playa.jpg 2x"
  alt="Playa al amanecer">
```

Los parámetros que más vas a usar:

- `width` y `height`, con `fit`: `scale-down` (reduce, nunca amplía), `contain`, `cover` (rellena y recorta), `crop` o `pad` (rellena con un color de fondo).
- `format`: `auto`, `avif`, `webp`, `jpeg` o `baseline-jpeg`.
- `quality`: de 1 a 100 (85 por defecto) o niveles como `high` o `low`.
- `metadata`: `copyright` (por defecto), `keep` (conserva el GPS) o `none`.
- `onerror=redirect`: si falla, redirige al original (solo si está en la misma zona).

Para esconder `/cdn-cgi/image/`, una URL Rewrite Rule puede servir lo mismo desde `/imagenes/...`, con la comprobación de la cabecera `Via` que trae la documentación para evitar bucles.

### 3. O deja que un flow lo haga sin cambiar la URL

Desde mayo de 2026, en **Transformations › Automation** creas *flows*: condiciones (extensión, ruta o parámetro) y parámetros que se aplican solos. Por ejemplo, todo JPEG y PNG bajo `/fotos/*` con `format=auto`. Solo se ejecuta el primero que coincide. Hay también un *provider flow* que traduce las URL de Fastly Image Optimizer.

### 4. Polish, si tu zona es de pago

Polish está en **Speed › Settings › Image Optimization**. *Lossless* no cambia ni un píxel; *Lossy* comprime más. La opción **WebP** sirve una versión WebP a los navegadores que la aceptan, solo si sale más pequeña. Purga la caché para ver el efecto.

No lo combines con transformaciones: ya comprimen, y Polish no se aplica a URL transformadas.

### 5. Transforma desde un Worker

Un Worker te deja usar nombres en vez de píxeles, esconder los originales y validar la entrada. Este atiende `/img/<preset>/<ruta>` con originales en un host fijo. Asígnalo solo a `/img/*`, nunca a toda la zona.

```js
const ORIGEN = "https://originales.example.com";
const PRESETS = {
  miniatura: { width: 200, height: 200, fit: "cover" },
  tarjeta: { width: 640, fit: "scale-down" },
  portada: { width: 1600, fit: "scale-down" },
};
const RUTA_VALIDA = /^[\w\-\/]+\.(jpe?g|png|gif|webp)$/i;

export default {
  async fetch(request) {
    // Las peticiones del propio servicio de imágenes van directas al origen
    if (/image-resizing/.test(request.headers.get("via") ?? "")) {
      return fetch(request);
    }

    const [, prefijo, preset, ...resto] = new URL(request.url).pathname.split("/");
    const ruta = resto.join("/");
    if (prefijo !== "img" || !Object.hasOwn(PRESETS, preset)) {
      return new Response("Preset no válido", { status: 400 });
    }
    if (!RUTA_VALIDA.test(ruta)) {
      return new Response("Ruta no válida", { status: 400 });
    }

    // El Worker negocia el formato: format=auto solo existe en la URL
    const image = { ...PRESETS[preset] };
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("image/avif")) image.format = "avif";
    else if (accept.includes("image/webp")) image.format = "webp";

    // Sin reenviar cabeceras ni cookies del visitante
    const res = await fetch(`${ORIGEN}/${ruta}`, { cf: { image } });
    if (res.ok || res.redirected) return res;
    return new Response("Imagen no disponible", {
      status: res.status === 404 ? 404 : 502,
    });
  },
};
```

La lista cerrada de presets importa: con `width` libre, cualquiera puede generar miles de transformaciones únicas a tu costa. Y **Sources** no se aplica a `fetch()` desde Workers: valida tú el origen.

Para trabajar con los bytes (una subida, un objeto de R2) está el **binding de Images**. Este fragmento recibe una foto, la reduce a 1.200 píxeles en WebP y la guarda en R2:

```js
// wrangler.jsonc: "images": { "binding": "IMAGES" } y un bucket R2 como MEDIA
const MAX_BYTES = 10 * 1024 * 1024;

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const tipo = request.headers.get("content-type") ?? "";
    const tam = Number(request.headers.get("content-length"));
    if (!/^image\/(jpeg|png|webp)$/.test(tipo)) {
      return new Response("Formato no admitido", { status: 415 });
    }
    if (!request.body || !Number.isFinite(tam) || tam <= 0 || tam > MAX_BYTES) {
      return new Response("Tamaño no válido", { status: 413 });
    }

    try {
      const salida = (
        await env.IMAGES.input(request.body)
          .transform({ width: 1200, fit: "scale-down" })
          .output({ format: "image/webp", quality: 80 })
      ).response();
      const clave = `subidas/${crypto.randomUUID()}.webp`;
      await env.MEDIA.put(clave, salida.body, {
        httpMetadata: { contentType: "image/webp" },
      });
      return Response.json({ clave }, { status: 201 });
    } catch {
      return new Response("No es una imagen válida", { status: 400 });
    }
  },
};
```

Las respuestas del binding **no se cachean solas**: si sirves imágenes con él, activa la caché de Workers y fija `Cache-Control`.

### 6. Guardar en Images y usar variantes

Con el plan Paid, en **Hosted images › Delivery** creas variantes (hasta 100) con ancho, alto, `fit` y metadatos. La URL de entrega es:

```
https://imagedelivery.net/<ACCOUNT_HASH>/<IMAGE_ID>/<variante>
```

O desde tu dominio con `/cdn-cgi/imagedelivery/...`. Se entregan en AVIF o WebP según el navegador. Con **flexible variants** aceptan parámetros en la URL (`w=400`), salvo las que exigen URL firmada.

Para subidas de usuarios sin exponer tu token, **Direct Creator Upload** da una URL de un solo uso (`POST /accounts/{account_id}/images/v2/direct_upload`) que caduca a los 30 minutos.

### Lo mismo, como código

Con el proveedor de Terraform (v5), una variante para imágenes alojadas:

```hcl
resource "cloudflare_image_variant" "tarjeta" {
  account_id = var.account_id
  id         = "tarjeta"
  options = {
    fit      = "scale-down"
    width    = 640
    height   = 640
    metadata = "none"
  }
  never_require_signed_urls = false
}
```

Y Polish en una zona de pago:

```hcl
resource "cloudflare_zone_setting" "polish" {
  zone_id    = var.zone_id
  setting_id = "polish"
  value      = "lossy"
}
```

Permisos del token: *Images Write* y *Zone Settings Write*.

## Cómo comprobarlo

Pide una imagen anunciando AVIF:

```bash
curl -sI -H "Accept: image/avif,image/webp,*/*" \
  "https://www.example.com/cdn-cgi/image/width=400,format=auto/fotos/playa.jpg" \
  | grep -iE "content-type|cf-resized|cf-cache-status"
```

- `content-type: image/avif` (o `image/webp`) confirma la negociación de formato.
- `cf-resized` aparece cuando Cloudflare ha intentado transformar. Si lleva `err=`, el código dice por qué: `9422` es que se acabaron las 5.000 del plan Free; `9403`, un bucle.
- `Warning: cf-images 299 "cache-control is too restrictive"`: el original se cachea menos de una hora y Cloudflare optimiza con menos esfuerzo.

En **Images & Stream › Transformations › Analytics** ves estimaciones de uso por zona, origen y Worker.

## Límites y precios

| | Free | Paid |
|---|---|---|
| Transformaciones únicas | 5.000 al mes | 5.000 incluidas + 0,50 $ por cada 1.000 |
| Imágenes guardadas en Images | — | 5 $ por cada 100.000 al mes |
| Imágenes entregadas desde Images | — | 1 $ por cada 100.000 |

Cómo se cuenta una **transformación única**:

- Cada combinación de original y parámetros cuenta **una vez al mes**, la sirvas las veces que la sirvas. La misma foto a 100 y a 200 píxeles son dos.
- `format` y `quality` no cuentan: la misma foto en AVIF y en WebP es una sola.
- Con `width=auto`, cada ancho distinto es una transformación aparte.
- Desde julio de 2026, el binding también se cobra así. `.info()` es gratis.
- Pasadas las 5.000 en Free no se cobra: lo nuevo devuelve `9422`.
- Una entrega desde Images solo se cobra si es un `200` de más de 1.024 bytes.

Otros límites:

- Originales remotos: hasta 100 MB y 100 megapíxeles. Lado máximo de 12.000 píxeles (1.200 para AVIF).
- Imágenes alojadas: hasta 10 MB y 1.024 bytes de metadatos.
- Binding: entrada de hasta 20 MB.
- SVG no se redimensiona; se sirve saneado.

## Documentación oficial

- [Cloudflare Images](https://developers.cloudflare.com/images/) y [cuándo guardar en Images o en R2](https://developers.cloudflare.com/images/get-started/introduction/)
- [Transformaciones](https://developers.cloudflare.com/images/optimization/transformations/overview/), [orígenes permitidos](https://developers.cloudflare.com/images/optimization/transformations/sources/) y [flows](https://developers.cloudflare.com/images/optimization/transformations/flows/)
- [Parámetros](https://developers.cloudflare.com/images/optimization/features/) e [imágenes responsive](https://developers.cloudflare.com/images/optimization/make-responsive-images/)
- [Transformar con `fetch()` en Workers](https://developers.cloudflare.com/images/optimization/transformations/transform-via-workers/) y [binding de Images](https://developers.cloudflare.com/images/optimization/binding/)
- [Variantes](https://developers.cloudflare.com/images/optimization/hosted-images/create-variants/), [flexible variants](https://developers.cloudflare.com/images/optimization/hosted-images/enable-flexible-variants/) y [Direct Creator Upload](https://developers.cloudflare.com/images/storage/upload-images/direct-creator-upload/)
- [Polish](https://developers.cloudflare.com/images/polish/) y [opciones de compresión](https://developers.cloudflare.com/images/polish/compression/)
- [Precios](https://developers.cloudflare.com/images/pricing/), [límites y formatos](https://developers.cloudflare.com/images/get-started/limits/) y [errores](https://developers.cloudflare.com/images/reference/troubleshooting/)
- Changelog: [flows](https://developers.cloudflare.com/changelog/post/2026-05-27-transformation-flows/), [binding cobrado por transformación única](https://developers.cloudflare.com/changelog/post/2026-07-01-binding-unique-transformations/) y [analítica de transformaciones](https://developers.cloudflare.com/changelog/post/2026-09-23-transformation-analytics/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Waiting Room, la sala de espera para picos de tráfico.

## También te puede interesar

- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
