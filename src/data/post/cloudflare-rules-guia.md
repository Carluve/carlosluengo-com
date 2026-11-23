---
publishDate: 2026-09-01T09:00:00Z
draft: false
image: 'media:blog/cloudflare-rules-guia/portada.png'
title: 'Rules en Cloudflare: redirecciones, Transform Rules y Snippets'
excerpt: 'Serie Cloudflare, parte 35. Redirecciones de una en una o por miles, reescritura de URL, cabeceras de petición y de respuesta, Configuration Rules, Origin Rules y Snippets: en qué orden se ejecutan, qué entra en cada plan y cómo dejarlo todo en Terraform.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'rules'
  - 'redirecciones'
  - 'terraform'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 35 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Ya has decidido qué se cachea ([CDN](/blog/cloudflare-cdn-cache-guia)) y qué se bloquea ([WAF](/blog/cloudflare-waf-guia)). Queda lo que antes vivía en el `.htaccess` o en nginx: redirigir, reescribir URLs, poner cabeceras o cambiar un ajuste para una ruta. En Cloudflare eso es **Rules**.

## Qué es

Rules es una familia de productos que actúan sobre las peticiones con proxy, con el mismo lenguaje de expresiones que ya has usado en el WAF:

- **Single Redirects (Redirect Rules).** Redirecciones por zona, estáticas o dinámicas, con patrones comodín (`*`).
- **Bulk Redirects.** Listas de miles de redirecciones a nivel de **cuenta**, válidas para todas tus zonas. Son estáticas: sin comodines ni expresiones regulares.
- **Transform Rules.** Reescriben la ruta y la *query string* (sin que el navegador lo note) y añaden, cambian o quitan cabeceras de petición y de respuesta. Incluyen las **Managed Transforms**, ajustes de cabeceras de un clic.
- **Configuration Rules.** Cambian ajustes de la zona (modo SSL, Rocket Loader, Polish, Under Attack…) solo para las peticiones que coinciden.
- **Origin Rules.** Cambian a dónde va la petición. En todos los planes, el puerto de destino; el `Host`, el SNI y el registro DNS de destino, solo en Enterprise.
- **Snippets.** Trozos pequeños de JavaScript que corren en el borde con el runtime de [Workers](/blog/cloudflare-workers-guia), sin coste adicional y con límites estrictos.

**Planes.** Todo está en todos los planes salvo los Snippets, que empiezan en Pro. Solo Enterprise: los overrides de `Host`, SNI y DNS en Origin Rules.

## Casos de uso

- **Migrar una web.** El blog pasa de `/blog/2024/titulo` a `/articulos/titulo`. Una Redirect Rule con comodines cubre todas las URLs; las que no siguen patrón van a una lista de Bulk Redirects.
- **Cabeceras de seguridad** en todas las respuestas, aunque tu aplicación no las ponga.
- **Excepciones por ruta.** Rocket Loader activo en la web, pero no en `/admin`, donde rompe el JavaScript del panel.
- **Lógica que no cabe en una regla.** Validar un parámetro, un A/B test o una página de mantenimiento: un Snippet.

## Arquitectura

![Orden de ejecución de Rules en una petición: Single Redirects, URL Rewrite, Configuration Rules, Origin Rules, WAF, Bulk Redirects, Managed Transforms y cabeceras de petición, Cache Rules, Snippets y origen; la respuesta vuelve pasando por las Response Header Transform Rules; debajo, tabla de qué se ejecuta en qué plan](media:blog/cloudflare-rules-guia/00-arquitectura.png)

El orden importa. Cloudflare ejecuta las piezas de Rules así:

1. **Single Redirects**
2. **URL Rewrite Rules**
3. **Configuration Rules**
4. **Origin Rules**
5. *(Aquí entra el [WAF](/blog/cloudflare-waf-guia): reglas personalizadas, rate limiting y gestionadas.)*
6. **Bulk Redirects**
7. **Managed Transforms** y **Request Header Transform Rules**
8. **Cache Rules**
9. **Snippets**
10. Cloud Connector y, por último, el origen.

La respuesta vuelve pasando por las **Response Header Transform Rules**.

Tres consecuencias prácticas:

- **Una redirección corta la evaluación.** Si coincide una Single Redirect, las Bulk Redirects ya no se evalúan. Dentro de una fase gana la **primera** regla que redirige.
- **Las demás acciones se acumulan.** En reescrituras y cabeceras, una regla posterior puede sobrescribir a una anterior. Pero todas las reglas de una fase **ven los valores originales**: la segunda reescritura no ve la ruta que dejó la primera.
- **El WAF va en medio.** Si bloquea, la Bulk Redirect no se ejecuta. Una Single Redirect ya habría respondido antes.

Rules tiene prioridad sobre las antiguas **Page Rules**, para las que hay guía de migración.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Una redirección con comodines

**Rules › Overview › Create rule › Redirect Rule**. Elige **Wildcard pattern** y rellena:

- **Request URL:** `https://www.*`
- **Target URL:** `https://${1}`
- **Status code:** 301
- **Preserve query string:** activado

Cada `*` se recupera en el destino con `${1}`, `${2}`… Así, `https://www.example.com/precios?plan=pro` va a `https://example.com/precios?plan=pro`. `http://www.example.com` no coincide, porque el patrón exige `https`.

![Rules › Overview: plantillas para crear reglas de redirección y de caché](media:blog/cloudflare-rules-guia/01-panel.png)

Sobre el código:

- **301 y 302** permiten que el navegador cambie `POST` por `GET` al seguir la redirección.
- **307 y 308** conservan el método. Úsalos si rediriges formularios o una API.
- Empieza con **302** mientras pruebas: los navegadores cachean los 301 y luego cuesta deshacerlos.

### 2. Miles de redirecciones: Bulk Redirects

Si las URLs antiguas no siguen ningún patrón, usa **Bulk Redirects**. Vive en la cuenta, no en la zona, aunque también aparece en **Rules › Settings › Bulk Redirects**. Son dos pasos:

1. **Una lista** con las parejas origen y destino. Puedes subir un CSV. El origen no puede llevar *query string*.
2. **Una regla** que activa la lista. Sin regla, la lista no hace nada.

Cada redirección tiene sus parámetros: **Include subdomains**, **Subpath matching**, **Preserve query string** (los tres desactivados por defecto), **Preserve path suffix** (activado) y el código de estado (301 por defecto).

### 3. Cabeceras de respuesta

**Rules › Overview › Create rule › Response Header Transform Rule**. Para añadir cabeceras de seguridad a toda la zona, elige **All incoming requests** y añade tres operaciones **Set static**:

| Cabecera | Valor |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

Ten en cuenta:

- No puedes tocar cabeceras que empiezan por `cf-` o `x-cf-`.
- Para `set-cookie`, usa **Add**, no **Set**. *Set* borra todas las `set-cookie` existentes, también las de otros productos de Cloudflare.
- Cambiar `cache-control` aquí **no cambia cómo cachea Cloudflare**: la caché ya se decidió antes. Para eso están las Cache Rules.

En las cabeceras de **petición** hay más restricciones: no puedes cambiar `x-forwarded-for`, `true-client-ip`, `x-real-ip` ni `x-forwarded-proto`, ni dar valor a `cookie` (solo quitarla). Para pasar la IP real al origen, usa `CF-Connecting-IP` o la Managed Transform **Add "True-Client-IP" header**.

### 4. Reescritura, configuración y origen

- **URL Rewrite Rule.** Sirve `/articulos/` desde `/posts/` sin que cambie la barra del navegador, con un valor fijo o una expresión (`wildcard_replace()`, `concat()`). No cambia el *hostname*.
- **Configuration Rule.** Por ejemplo, `starts_with(http.request.uri.path, "/admin/")` con Rocket Loader y Email Obfuscation desactivados. Desde enero de 2026 también controla el *buffering* del cuerpo; en **None**, el WAF no puede inspeccionarlo.
- **Origin Rule.** En Free, cambia el puerto de destino (de 1 a 65.535). Por ejemplo, `/app/*` a una aplicación que escucha en el 9000.

### 5. Snippets (Pro o superior)

Un Snippet tiene dos partes: el **código** y una **regla** que decide cuándo corre. En **Rules › Snippets › Create Snippet** escribes el código y lo pruebas con las pestañas **HTTP** y **Preview** antes de desplegar. El nombre no se puede cambiar después.

Un ejemplo: un atajo `/ir?a=docs` que redirige solo a destinos conocidos. Validar el parámetro evita que tu dominio sea un redirector abierto.

```js
const DESTINOS = new Map([
  ["docs", "https://example.com/documentacion/"],
  ["blog", "https://example.com/articulos/"],
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const clave = url.searchParams.get("a");

    if (clave === null || !DESTINOS.has(clave)) {
      return new Response("Destino no válido", { status: 400 });
    }
    return Response.redirect(DESTINOS.get(clave), 302);
  },
};
```

Regla del Snippet: `http.request.uri.path eq "/ir"`. El `Map` evita que claves como `__proto__` devuelvan algo inesperado.

Ojo: si el Snippet hace `fetch()` a otro *hostname* con proxy de la misma zona, esa subpetición **no pasa** por el WAF. Protege la petición original o valida en el destino.

**¿Snippet o Worker?** Snippet para lógica corta sin estado: cabeceras, redirecciones, rutas, autenticación con cabeceras. Worker si necesitas bindings (KV, D1, R2), variables de entorno, logs, cron, más de 5 ms de CPU o versiones con *rollback*.

### Lo mismo, como código

Con el proveedor de Terraform v5, cada fase es un `cloudflare_ruleset`. Así queda la redirección de `/blog/*` a `/articulos/*`:

```hcl
resource "cloudflare_ruleset" "redirecciones" {
  zone_id = var.zone_id
  name    = "Redirecciones"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"
  rules = [{
    ref         = "blog_a_articulos"
    description = "/blog/* a /articulos/*"
    expression  = "http.request.uri.path wildcard \"/blog/*\""
    action      = "redirect"
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          # $${1} es ${1} escapado para Terraform
          expression = "wildcard_replace(http.request.uri.path, \"/blog/*\", \"/articulos/$${1}\")"
        }
      }
    }
  }]
}
```

Las cabeceras de respuesta van en la fase `http_response_headers_transform` (las de petición, en `http_request_late_transform`; las reescrituras, en `http_request_transform`):

```hcl
resource "cloudflare_ruleset" "cabeceras_respuesta" {
  zone_id = var.zone_id
  name    = "Cabeceras de seguridad"
  kind    = "zone"
  phase   = "http_response_headers_transform"
  rules = [{
    ref        = "cabeceras_seguridad"
    expression = "true"
    action     = "rewrite"
    action_parameters = {
      headers = {
        "X-Content-Type-Options" = { operation = "set", value = "nosniff" }
        "Referrer-Policy"        = { operation = "set", value = "strict-origin-when-cross-origin" }
      }
    }
  }]
}
```

Bulk Redirects: una lista de tipo `redirect` y un ruleset de **cuenta** (`kind = "root"`) en la fase `http_request_redirect`:

```hcl
resource "cloudflare_list" "redirecciones_antiguas" {
  account_id = var.account_id
  name       = "redirecciones_antiguas"
  kind       = "redirect"
  items = [{
    redirect = {
      source_url  = "example.com/quienes-somos"
      target_url  = "https://example.com/equipo"
      status_code = 301
    }
  }]
}

resource "cloudflare_ruleset" "bulk_redirects" {
  account_id = var.account_id
  name       = "Bulk Redirects"
  kind       = "root"
  phase      = "http_request_redirect"
  rules = [{
    ref        = "activar_redirecciones_antiguas"
    expression = "http.request.full_uri in $redirecciones_antiguas"
    action     = "redirect"
    action_parameters = {
      from_list = {
        name = cloudflare_list.redirecciones_antiguas.name
        key  = "http.request.full_uri"
      }
    }
  }]
}
```

Los Snippets usan dos recursos: `cloudflare_snippet` (el código, con `snippet_name`, `files` y `metadata.main_module`) y `cloudflare_snippet_rules`, que define **todas** las reglas de Snippets de la zona de una vez.

Dos avisos:

- Terraform asume que controla **todas** las reglas de cada fase. Si has creado reglas en el panel, impórtalas antes con `cf-terraforming`.
- Usa `ref`: mantiene el ID de la regla entre cambios.

En la API, desde septiembre de 2026, las llamadas que modifican rulesets aceptan `?dry_run=true`. Validan la expresión, los permisos y las cuotas sin publicar nada.

## Cómo comprobarlo

Una redirección se ve en la cabecera `location`:

```bash
curl -sI https://www.example.com/precios?plan=pro | grep -iE "^(HTTP|location)"
# HTTP/2 301
# location: https://example.com/precios?plan=pro
```

Para las cabeceras de respuesta, filtra por su nombre.

Si una regla no salta, usa el **Rules simulator** (beta, en la cuenta). Simula una petición con la URL, el método, las cabeceras, las cookies o el país que elijas, y te dice qué reglas y Snippets se aplicarían y en qué orden.

## Límites y precios

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Single Redirects, Transform, Configuration y Origin Rules (cada tipo) | 10 | 25 | 50 | 300 |
| Expresiones regulares | — | — | ✓ | ✓ |
| Snippets | — | 25 | 50 | 300 |
| Subpeticiones por Snippet | — | 2 | 3 | 5 |
| Bulk Redirects: redirecciones entre listas | 10.000 | 25.000 | 50.000 | 1.000.000 |

- **Solo Enterprise:** overrides de `Host`, SNI y registro DNS en Origin Rules; más reglas (50) y listas (25) de Bulk Redirects, frente a 15 reglas y 5 listas en el resto.
- Las cuotas de Bulk Redirects son **por cuenta** y dependen del plan más alto que tengas. Las demás son **por zona**.
- **Snippets:** 5 ms de ejecución, 2 MB de memoria y 32 KB de código en todos los planes, sin coste extra. Una subpetición que sigue una redirección cuenta doble. Version Management no los soporta.
- Las **Managed Transforms** no consumen cuota de Transform Rules.

## Documentación oficial

- [Cloudflare Rules](https://developers.cloudflare.com/rules/) y [orden de ejecución](https://developers.cloudflare.com/rules/url-forwarding/#execution-order)
- [Single Redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/), [sus ajustes](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/) y [ejemplo de www a raíz](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/)
- [Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/), [conceptos](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/concepts/) y [parámetros](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/reference/parameters/)
- [Transform Rules](https://developers.cloudflare.com/rules/transform/), [cabeceras de petición](https://developers.cloudflare.com/rules/transform/request-header-modification/), [de respuesta](https://developers.cloudflare.com/rules/transform/response-header-modification/) y [Managed Transforms](https://developers.cloudflare.com/rules/transform/managed-transforms/)
- [Configuration Rules](https://developers.cloudflare.com/rules/configuration-rules/) y [ajustes disponibles](https://developers.cloudflare.com/rules/configuration-rules/settings/)
- [Origin Rules](https://developers.cloudflare.com/rules/origin-rules/)
- [Snippets](https://developers.cloudflare.com/rules/snippets/), [cómo funcionan](https://developers.cloudflare.com/rules/snippets/how-it-works/) y [Snippets o Workers](https://developers.cloudflare.com/rules/snippets/when-to-use/)
- [Terraform: Transform Rules](https://developers.cloudflare.com/terraform/additional-configurations/transform-rules/)
- [Rules simulator](https://developers.cloudflare.com/rules/simulator/) y [validación con dry_run](https://developers.cloudflare.com/ruleset-engine/rulesets-api/dry-run/)
- [Changelog de Rules](https://developers.cloudflare.com/rules/changelog/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Security Center y Brand Protection.

## También te puede interesar

- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [Cloudflare Workers](/blog/cloudflare-workers-guia)
