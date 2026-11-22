---
publishDate: 2026-11-26T09:00:00Z
draft: true
image: 'media:blog/cloudflare-cdn-cache-guia/portada.png'
title: 'CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas'
excerpt: 'Serie Cloudflare, parte 4. Qué cachea Cloudflare sin que hagas nada (y por qué tu HTML no), cómo leer cf-cache-status, cómo escribir una Cache Rule, qué aporta Tiered Cache y cómo purgar sin tumbar tu origen.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'cdn'
  - 'cache'
  - 'rendimiento'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 4 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Con el DNS en su sitio ([parte 1](/blog/cloudflare-dns-dnssec-guia)) y el HTTPS bien cerrado ([parte 3](/blog/cloudflare-ssl-tls-guia)), toca la razón por la que mucha gente llega a Cloudflare: que la web cargue rápido sin comprar más servidores. Eso es la caché.

## Qué es

La CDN de Cloudflare guarda copias de tus respuestas en sus centros de datos de todo el mundo. Si un visitante de Madrid pide un fichero que ya está en la caché de Madrid, Cloudflare se lo sirve sin preguntar a tu servidor. Funciona en cualquier registro **con proxy**, en todos los planes.

Tres piezas que conviene tener claras:

- **El comportamiento por defecto.** Cloudflare decide por la **extensión** del fichero, no por el tipo MIME. Cachea 56 extensiones de contenido estático (CSS, JS, imágenes, fuentes, PDF, vídeo, ZIP…) y **no cachea HTML ni JSON** a menos que tú lo digas.
- **Cache Rules.** Reglas que cambian ese comportamiento: qué se cachea, cuánto tiempo en el borde y en el navegador, y cómo se construye la clave de caché.
- **Tiered Cache.** Organiza los centros de datos en niveles para que un fallo de caché en Madrid se resuelva en otro centro de Cloudflare antes de llegar a tu servidor.

**Planes.** La caché, las Cache Rules (10 en Free, 25 en Pro, 50 en Business, 300 en Enterprise), Smart Tiered Cache y todos los tipos de purga están en todos los planes. Cache Analytics es de pago (Pro en adelante). Las topologías Generic Global, Regional y personalizada de Tiered Cache, las claves de caché con cabeceras o cookies y Query String Sort son **solo Enterprise**. Cache Reserve es un complemento de pago.

## Casos de uso

- **Una web estática o un blog.** Los ficheros con *hash* en el nombre (`app.3f9a1c.js`) se pueden cachear durante meses. El HTML, con una regla corta o revalidando.
- **Descargas y medios.** PDFs, instaladores o vídeos que muchos visitantes piden a la vez y que, sin caché, saturarían el ancho de banda del servidor.
- **Un origen lejano o caro.** Un servidor en EE. UU. o un bucket en la nube con tráfico de salida de pago. Con Tiered Cache, la mayoría de los fallos de caché se resuelven dentro de Cloudflare.
- **Picos de tráfico.** Una campaña o un enlace en portada. Si el contenido está en caché, el pico lo absorbe Cloudflare.

## Arquitectura

![Recorrido de una petición: visitante, centro de datos cercano (nivel inferior) con la decisión de Cache Rules, nivel superior de Tiered Cache y origen, con una tabla de los valores de cf-cache-status](media:blog/cloudflare-cdn-cache-guia/00-arquitectura.png)

1. La petición llega al **centro de datos más cercano** al visitante. Antes de buscar nada, Cloudflare aplica las **Cache Rules**: ¿esta petición es cacheable y con qué clave?
2. Si lo es y la copia está en caché y en vigor, responde con **HIT**.
3. Si no está, con **Tiered Cache** activo pregunta a un **nivel superior**: el centro de datos que Cloudflare considera más cercano a tu origen. Muchos centros inferiores comparten ese nivel superior, así que es mucho más probable que ya tenga la copia.
4. Solo si tampoco está ahí, la petición llega a **tu origen** (MISS). La respuesta se guarda en los niveles por los que pasa.

Cuánto tiempo se guarda lo decide la cabecera `Cache-Control` de tu origen, salvo que una Cache Rule diga otra cosa. Sin cabecera, Cloudflare aplica sus TTL por defecto: 120 minutos para respuestas 200, 206 y 301; 20 minutos para 302 y 303; 3 minutos para 404 y 410. No cachea una respuesta con `private`, `no-store`, `no-cache`, `max-age=0` o con `Set-Cookie`.

## Implementación paso a paso

Las capturas son de `carluve.dev`, una zona en plan **Free**. La regla de caché del paso 2 la rellené para la captura y la cancelé sin desplegarla.

### 1. Revisa la configuración general

En **Caching › Configuration** están los ajustes de toda la zona: purgas, nivel de caché y la TTL del navegador.

![Caching › Configuration: Purge Cache con Custom Purge y Purge Everything, Invalidate Cache, Caching Level en Standard, Browser Cache TTL de 4 horas y CSAM Scanning Tool](media:blog/cloudflare-cdn-cache-guia/01-configuracion.png)

- **Caching Level** en **Standard** (el valor por defecto): guarda una copia distinta por cada *query string*. *No Query String* solo sirve desde caché si no hay parámetros; *Ignore Query String* sirve la misma copia sea cual sea, solo para estáticos.
- **Browser Cache TTL** de **4 horas** (por defecto en todos los planes): lo que le dice Cloudflare al navegador si tu origen no manda nada más largo. *Respect Existing Headers* deja tus cabeceras como están.
- **Development Mode** (más abajo en la página) desactiva la caché 3 horas mientras cambias cosas. No purga: al terminar, lo cacheado sigue ahí.

### 2. Crea una Cache Rule

**Caching › Cache Rules › Create rule › Cache Rules**. El ejemplo: todo lo que esté bajo `/assets/` se cachea un día en el borde, diga lo que diga el origen.

![Formulario New Cache Rule: expresión http.request.full_uri wildcard "https://carluve.dev/assets/*", Eligible for cache, Edge TTL con Ignore cache-control header y TTL de 1 día](media:blog/cloudflare-cdn-cache-guia/02-regla-cache.png)

Los bloques que más se usan:

- **Cache eligibility.** *Eligible for cache* hace cacheable lo que no lo sería por defecto (HTML, JSON, una API). *Bypass cache* hace lo contrario.
- **Edge TTL.** Cuánto vive la copia en Cloudflare: respetar el `Cache-Control` del origen, respetarlo con TTL por defecto si no hay, o **ignorarlo** y usar el tuyo. En Free el mínimo es 2 horas (1 hora en Pro y 1 segundo en Business y Enterprise). También puedes fijar TTL por código de estado.
- **Browser TTL.** Lo que se le dice al navegador. Ojo: una purga en Cloudflare **no borra** lo que ya tienen los navegadores.
- **Cache key.** En todos los planes: ignorar el orden de los parámetros, *Cache Deception Armor* y cachear por tipo de dispositivo. Incluir cabeceras, cookies o datos del usuario en la clave es de Enterprise.
- **Serve stale while revalidating**, **Respect strong ETags** y **Origin error page pass-through**.

Desde la página de reglas también se crean las **Cache Response Rules** (desde marzo de 2026): actúan sobre la respuesta del origen y pueden reescribir `Cache-Control`, gestionar etiquetas de caché o quitar `Set-Cookie`.

Un aviso antes de poner *Eligible for cache* sobre HTML: si la página cambia por usuario (sesión, carrito, nombre en la cabecera), cachearla sin más puede servir a un visitante la página de otro. Excluye esas rutas o deja que la cookie de sesión fuerce el bypass.

### 3. Activa Tiered Cache

**Caching › Tiered Cache**, activa el interruptor y elige la topología. En Free, Pro y Business solo hay una: **Smart Tiered Cache**, que elige dinámicamente los niveles superiores más cercanos a tu origen. Es gratis.

![Caching › Tiered Cache en una zona Free: interruptor Tiered Cache Topology, opción Smart Tiered Cache y la vista previa de la topología con origen, nivel superior y peticiones de usuarios](media:blog/cloudflare-cdn-cache-guia/03-tiered-cache.png)

Smart Tiered Cache forma ahora parte de **Smart Shield**, el paquete de protección del origen. Desde abril de 2026, si tu origen está en AWS, Google Cloud, Azure u Oracle puedes indicar la región en *Origin Configuration* para que el nivel superior sea el más cercano, sin coste.

### 4. Purga cuando cambies algo

En **Caching › Configuration › Purge Cache**:

- **Custom Purge**: por URL, por *hostname*, por etiqueta (`Cache-Tag`) o por prefijo. Desde abril de 2025, **todos los tipos están en todos los planes**.
- **Purge Everything**: lo borra todo. Úsalo poco: durante unos minutos todo será MISS y tu origen recibirá el golpe.
- **Invalidate** (desde septiembre de 2026): en vez de borrar, marca el contenido como caducado y Cloudflare lo revalida con el origen en la siguiente petición.

Lo más limpio es no tener que purgar: nombres de fichero con *hash* para los estáticos y TTL cortas o revalidación para el HTML.

### Lo mismo, como código

Con el proveedor de Terraform (v5), la regla de caché y Tiered Cache:

```hcl
resource "cloudflare_ruleset" "cache" {
  zone_id = var.zone_id
  name    = "Cache rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"
  rules = [{
    ref         = "cache_assets"
    description = "Cachear /assets 1 día"
    expression  = "(starts_with(http.request.uri.path, \"/assets/\"))"
    action      = "set_cache_settings"
    action_parameters = {
      cache       = true
      edge_ttl    = { mode = "override_origin", default = 86400 }
      browser_ttl = { mode = "respect_origin" }
    }
  }]
}

resource "cloudflare_argo_tiered_caching" "tiered" {
  zone_id = var.zone_id
  value   = "on"
}

resource "cloudflare_tiered_cache" "smart" {
  zone_id = var.zone_id
  value   = "on"
}
```

Purgar por API, con un token que tenga el permiso *Cache Purge*. Un tipo de purga por llamada:

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  --request POST \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{"files": ["https://www.example.com/assets/app.css"]}'

# Otras variantes del cuerpo:
# {"prefixes": ["www.example.com/blog/"]}
# {"tags": ["producto-1234"]}
# {"hosts": ["www.example.com"]}
# {"purge_everything": true}
```

Que la API responda 200 solo significa que Cloudflare ha recibido la orden. Para confirmarlo, vuelve a pedir el fichero y mira que ya no dé HIT.

## Cómo comprobarlo

La cabecera `cf-cache-status` dice de dónde ha salido cada respuesta:

```bash
# Primera petición: MISS (o HIT si otro visitante ya la pidió)
curl -sI https://www.example.com/assets/app.css | grep -iE "cf-cache-status|age|cache-control"

# Segunda: HIT y una cabecera Age con los segundos que lleva en caché
curl -sI https://www.example.com/assets/app.css | grep -iE "cf-cache-status|age"

# El HTML sin regla: DYNAMIC
curl -sI https://www.example.com/ | grep -i cf-cache-status
```

Los valores que vas a ver: **HIT** (desde caché), **MISS** (al origen y se guarda), **EXPIRED** (estaba pero caducado), **REVALIDATED** (el origen confirmó que no había cambiado), **UPDATING** (se sirvió la copia caducada mientras se renueva en segundo plano), **STALE** (copia caducada porque el origen no respondía), **DYNAMIC** (ni se buscó en caché) y **BYPASS** (era candidata, pero la respuesta del origen no se podía cachear). Desde mayo de 2026, las respuestas que no se pueden cachear devuelven siempre BYPASS en vez de MISS, así que las estadísticas de aciertos son más fiables.

En el panel, **Caching › Overview** muestra Cache Analytics con el desglose por estado, pero solo en planes de pago. En Free ves esto:

![Caching › Overview en una zona Free: Cache Analytics solo está disponible en Pro, Business y Enterprise, con botón Upgrade your plan](media:blog/cloudflare-cdn-cache-guia/04-analitica-pago.png)

En Free te queda la analítica general de la zona (peticiones servidas por Cloudflare frente a las del origen) y el `curl`.

## Límites y precios

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Cache Rules | 10 | 25 | 50 | 300 |
| Edge TTL mínima | 2 h | 1 h | 1 s | 1 s |
| Tamaño máximo cacheable | 512 MB | 512 MB | 512 MB | 5 GB (ampliable) |
| Smart Tiered Cache | ✓ | ✓ | ✓ | ✓ |
| Generic Global, Regional y Custom Tiered Cache | — | — | — | ✓ |
| Cache Analytics | — | 7 días | 30 días | 30 días |
| Purga (hostname, tag, prefijo, todo) | 5/min | 5/s | 10/s | 50/s |
| Purga por URL | 800 URLs/s | 1.500 URLs/s | 1.500 URLs/s | 3.000 URLs/s |

- Hasta 100 elementos por llamada de purga (500 URLs en Enterprise). Los límites son por cuenta y los comparten las zonas del mismo plan.
- **Cache Reserve** guarda una copia persistente en R2 para el contenido que se pide poco: 0,015 $ por GB y mes, 4,50 $ por millón de escrituras y 0,36 $ por millón de lecturas. Solo admite contenido con TTL de al menos 10 horas.
- **Always Online** sirve copias del Internet Archive si tu origen no responde. El rastreo es cada 30 días en Free, 15 en Pro y 5 en Business y Enterprise.

## Documentación oficial

- [Comportamiento por defecto de la caché](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) y [valores de cf-cache-status](https://developers.cloudflare.com/cache/concepts/cache-responses/)
- [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/), [sus ajustes](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/) y [ejemplo de Terraform](https://developers.cloudflare.com/cache/how-to/cache-rules/terraform-example/)
- [Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/) y [Cache Reserve](https://developers.cloudflare.com/cache/advanced-configuration/cache-reserve/)
- [Purgar la caché](https://developers.cloudflare.com/cache/how-to/purge-cache/), [purga por etiquetas](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/) e [invalidación](https://developers.cloudflare.com/cache/guides/invalidate-cache/)
- [TTL de borde y de navegador](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/) y [niveles de caché](https://developers.cloudflare.com/cache/how-to/set-caching-levels/)
- [Cache Analytics](https://developers.cloudflare.com/cache/performance-review/cache-analytics/)
- [Changelog de Cache](https://developers.cloudflare.com/cache/changelog/)

Documentación consultada el 22 de noviembre de 2026.

**Siguiente en la serie:** WAF, con reglas gestionadas y reglas personalizadas.

## También te puede interesar

- [SSL/TLS en Cloudflare: certificados de borde, Origin CA y modos de cifrado](/blog/cloudflare-ssl-tls-guia)
- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
