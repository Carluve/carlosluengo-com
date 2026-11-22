---
publishDate: 2026-04-21T09:00:00Z
draft: false
image: 'media:blog/cloudflare-kv-guia/portada.png'
title: 'Workers KV: almacenamiento clave-valor en el borde'
excerpt: 'Serie Cloudflare, parte 16. Qué es Workers KV, por qué un cambio tarda hasta 60 segundos en verse en todo el mundo, para qué sirve (y para qué no), cómo usarlo desde un Worker con get, put, list y delete, cómo cargar datos con Wrangler y cuánto cuesta.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'kv'
  - 'workers'
  - 'almacenamiento'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 16 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En la [parte 14](/blog/cloudflare-workers-guia) conectamos un Worker a KV casi de pasada. Ahora toca entender qué es ese almacén, por qué es tan rápido leyendo y por qué no conviene usarlo para todo.

## Qué es

Workers KV es un almacén clave-valor global. Guardas un valor (texto, JSON o binario) bajo una clave y lo lees desde cualquier Worker, en cualquier centro de datos de Cloudflare.

Tres ideas que lo explican casi todo:

- **Namespace.** Es la «base de datos»: un conjunto de claves con su propio ID. Un Worker accede a él con un *binding*, sin credenciales.
- **Pensado para leer mucho y escribir poco.** Los datos viven en unos pocos almacenes centrales y se cachean en el centro de datos donde se leen. Una clave leída a menudo responde muy rápido.
- **Consistencia eventual.** Un cambio suele verse al momento en el centro de datos donde se hizo, pero puede tardar **60 segundos o más** en el resto del mundo. Y no hay transacciones ni operaciones atómicas.

**Planes.** KV va incluido en **Workers Free** y **Workers Paid** (el plan de Workers de la cuenta, no el de tu zona). No hay nada exclusivo de Enterprise.

## Casos de uso

- **Configuración y *feature flags*.** Un JSON con la configuración de la aplicación o qué funciones están activas para cada cliente. Se lee en cada petición y cambia pocas veces al día.
- **Listas de permitidos y bloqueados.** IPs, dominios o tokens que el Worker consulta antes de responder.
- **Caché de respuestas de una API.** Guardas el resultado con caducidad y te ahorras llamar al origen.
- **Sesiones, con matices.** La documentación recomienda KV para sesiones porque se leen mucho y se escriben poco. Pero un cierre de sesión puede tardar hasta un minuto en verse en otro continente. Si eso es un problema de seguridad, usa Durable Objects.

**Cuándo no usar KV:**

- **Contadores, inventario, reservas.** Escrituras frecuentes a la misma clave o que deben ser exactas. Mejor **Durable Objects**: consistencia fuerte y transacciones.
- **Datos relacionales o consultas.** Usuarios, pedidos, filtros por campos. Eso es **D1** (SQL).
- **Ficheros grandes.** Imágenes, vídeos o copias de seguridad van a **[R2](/blog/cloudflare-r2-guia)**.

## Arquitectura

![Flujo de Workers KV: las escrituras desde Wrangler, la API o un Worker van a los almacenes centrales; el Worker lee primero de la caché local del centro de datos, luego de los niveles regional y central y, si no está, de los almacenes centrales; los demás centros pueden tardar 60 segundos o más en ver un cambio; debajo, tabla de límites de Workers Free y Workers Paid](media:blog/cloudflare-kv-guia/00-arquitectura.png)

1. **Escritura.** Un `put()` desde un Worker, Wrangler o la API llega a los **almacenes centrales**. No se envía a la caché de todos los centros de datos.
2. **Primera lectura en un sitio (lectura fría).** El centro de datos no tiene la clave. La busca en un nivel regional, luego en uno central y, al final, en los almacenes centrales. Es la lectura más lenta.
3. **Lecturas siguientes (lectura caliente).** El valor queda en la caché local durante `cacheTtl` (60 segundos por defecto). KV lo refresca en segundo plano mientras se siga pidiendo.
4. **Por qué tarda en propagarse.** Un centro de datos que ya tenía la versión antigua la sigue sirviendo hasta que caduca su copia. También se cachea que una clave **no existe**: si la lees antes de crearla, tardarás lo mismo en verla aparecer.

## Implementación paso a paso

La captura es del formulario de creación de un namespace, en tema claro, rellenado con un nombre de ejemplo y cancelado. En el texto, el namespace de ejemplo es `demo-config`.

### 1. Crea el namespace

Desde el panel, en **Storage & databases › Workers KV › Create**. O desde la terminal:

```bash
npx wrangler kv namespace create demo-config
```

Wrangler devuelve el ID y te ofrece añadir el binding a `wrangler.jsonc`. También puedes poner `kv_namespaces` sin `id` en la configuración y Wrangler lo crea en el primer `deploy` (lo vimos en la [parte 14](/blog/cloudflare-workers-guia)).

Si los datos deben guardarse solo en una región, añade `--jurisdiction=eu` (o `us`, o `fedramp`). Solo se elige al crearlo; después no se cambia. La jurisdicción controla dónde se **almacenan** los datos, no desde dónde se leen: el valor se puede cachear fuera de la UE.

![Ventana Create a KV namespace: nombre de ejemplo FEATURE_FLAGS y ubicación de los datos Standard (replicado globalmente) o Jurisdiction](media:blog/cloudflare-kv-guia/01-crear-namespace.png)

### 2. Escribe y lee claves con Wrangler

```bash
npx wrangler kv key put --binding=CONFIG "flags" '{"nuevoCheckout":true}' --remote
npx wrangler kv key get --binding=CONFIG "flags" --text --remote
npx wrangler kv key list --binding=CONFIG --prefix="cliente:" --remote
npx wrangler kv key delete --binding=CONFIG "flags" --remote
```

Ojo con **`--remote`**. Desde Wrangler v4, los comandos `kv key` y `kv bulk` trabajan **en local por defecto**. Sin esa opción escribes en `.wrangler/state`, en tu máquina, no en Cloudflare. Es el error más habitual.

Para cargar muchas claves a la vez, un JSON y `kv bulk put`:

```json
[
  { "key": "cliente:acme", "value": "{\"plan\":\"pro\"}" },
  { "key": "sesion:abc123", "value": "u_42", "expiration_ttl": 3600 }
]
```

```bash
npx wrangler kv bulk put datos.json --binding=CONFIG --remote
```

El valor siempre es una cadena: si guardas JSON, va escapado. La API de escritura en bloque admite hasta **10.000 pares** por petición y menos de 100 MB. Cada par cuenta como una escritura a efectos de facturación.

En el panel, la pestaña **KV Pairs** del namespace sirve para añadir y consultar claves a mano.


### 3. Conecta el namespace a tu Worker

En `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    { "binding": "CONFIG", "id": "<ID_DEL_NAMESPACE>" }
  ]
}
```

O en el panel: **Workers & Pages ›** tu Worker **› Settings › Bindings › Add › KV Namespace**. Eliges el nombre de la variable y el namespace, y despliegas.


### 4. Úsalo desde el código

```js
export default {
  async fetch(request, env, ctx) {
    // Lectura con caché de 5 minutos: menos lecturas frías, cambios más lentos
    const flags = await env.CONFIG.get("flags", { type: "json", cacheTtl: 300 });

    // Hasta 100 claves en una sola operación
    const clientes = await env.CONFIG.get(["cliente:acme", "cliente:globex"], "json");

    // Escritura con caducidad (mínimo 60 s) y metadatos (máximo 1.024 bytes)
    await env.CONFIG.put("sesion:abc123", "u_42", {
      expirationTtl: 3600,
      metadata: { creada: Date.now() },
    });

    // Valor y metadatos juntos
    const { value, metadata } = await env.CONFIG.getWithMetadata("sesion:abc123");

    // Listar por prefijo: hasta 1.000 claves por página
    const pagina = await env.CONFIG.list({ prefix: "cliente:" });
    // pagina.keys, pagina.list_complete, pagina.cursor

    await env.CONFIG.delete("sesion:abc123");

    return Response.json({ flags, clientes: Object.fromEntries(clientes), value, metadata });
  },
};
```

Lo que conviene saber de cada método:

- **`get()`** devuelve `null` si la clave no existe. El tipo puede ser `text` (por defecto), `json`, `arrayBuffer` o `stream`. La lectura múltiple admite hasta 100 claves, solo en `text` o `json`, y cuenta como **una** operación frente al límite de 1.000 por invocación. Se factura por clave leída.
- **`cacheTtl`** es cuánto tiempo guarda el valor el centro de datos que lo lee. Mínimo **30 segundos** (desde enero de 2026; antes, 60) y 60 por defecto. Súbelo para datos que casi no cambian, no si necesitas ver los cambios enseguida.
- **`put()`** acepta `expirationTtl` (segundos desde ahora) o `expiration` (fecha en segundos Unix). Ninguno puede estar a menos de 60 segundos en el futuro. La caducidad manda sobre `cacheTtl`. Desde el binding no hay escritura en bloque.
- **Una escritura por segundo a la misma clave.** Si escribes más rápido, recibes `429 Too Many Requests`. Si dos escrituras compiten, gana la última.
- **`list()`** devuelve las claves ordenadas, con su caducidad y metadatos, pero no los valores. Para saber si quedan más páginas, mira `list_complete`, no si `keys` viene vacío. Si el valor cabe en los metadatos, guárdalo ahí: te ahorras un `get()` por clave.

### Lo mismo, como código

Con el proveedor de Terraform (v5), el namespace y una clave inicial:

```hcl
resource "cloudflare_workers_kv_namespace" "config" {
  account_id   = var.account_id
  title        = "demo-config"
  jurisdiction = "eu" # opcional; solo al crearlo
}

resource "cloudflare_workers_kv" "flags" {
  account_id   = var.account_id
  namespace_id = cloudflare_workers_kv_namespace.config.id
  key_name     = "flags"
  value        = jsonencode({ nuevoCheckout = true })
}
```

El token necesita el permiso *Workers KV Storage Write*. Un namespace existente se importa con `terraform import cloudflare_workers_kv_namespace.config '<account_id>/<namespace_id>'`. Gestiona con Terraform la configuración estable, no datos que tu aplicación cambia en tiempo de ejecución.

Con la API, las rutas son `/accounts/{account_id}/storage/kv/namespaces/...`. Las antiguas `/accounts/{account_id}/workers/namespaces/...` dejaron de funcionar el 15 de octubre de 2026: si tienes scripts viejos, revísalos.

## Cómo comprobarlo

Escribe una clave en remoto y léela:

```bash
npx wrangler kv key put --binding=CONFIG "prueba" "hola" --remote
npx wrangler kv key get --binding=CONFIG "prueba" --text --remote
# hola
```

Para ver la consistencia eventual, cambia el valor y pide el Worker desde dos sitios lejanos (tu conexión y una VPN en otro continente). Durante un rato pueden devolver valores distintos. Es lo esperado.

En el panel, la pestaña de métricas del namespace muestra lecturas, escrituras y almacenamiento. Así sabes si te acercas a los límites diarios del plan Free.


## Límites y precios

| | Workers Free | Workers Paid |
|---|---|---|
| Lecturas | 100.000 al día | 10 millones/mes incluidas, luego 0,50 $/millón |
| Escrituras | 1.000 al día | 1 millón/mes incluido, luego 5 $/millón |
| Borrados | 1.000 al día | 1 millón/mes incluido, luego 5 $/millón |
| Listados | 1.000 al día | 1 millón/mes incluido, luego 5 $/millón |
| Almacenamiento | 1 GB | 1 GB incluido, luego 0,50 $/GB-mes |
| Namespaces | 1.000 | 1.000 incluidos, luego 0,10 $ por namespace y mes |

Igual en los dos planes:

- Clave de hasta **512 bytes**; metadatos de hasta **1.024 bytes**; valor de hasta **25 MiB**.
- **Una escritura por segundo** a la misma clave; sin límite entre claves distintas en Paid.
- Hasta **1.000 operaciones** con servicios externos por invocación (KV, R2…).

Lo que suele sorprender en la factura:

- En Free, las cuotas se reinician a las **00:00 UTC**. Si agotas una, las operaciones de ese tipo fallan con error hasta el día siguiente.
- Se cobra **todo**, también leer una clave que no existe y lo que haces desde el panel o con Wrangler.
- No hay coste por tráfico de salida.

**En beta privada:** *Workers KV Instant*, un modo de namespace para configuración pequeña (hasta 1 MB por namespace) con cambios que se propagan más rápido. No se puede combinar con jurisdicción.

## Documentación oficial

- [Workers KV: visión general](https://developers.cloudflare.com/kv/) y [primeros pasos](https://developers.cloudflare.com/kv/get-started/)
- [Cómo funciona KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/) y [namespaces](https://developers.cloudflare.com/kv/concepts/kv-namespaces/)
- API del binding: [leer](https://developers.cloudflare.com/kv/api/read-key-value-pairs/), [escribir](https://developers.cloudflare.com/kv/api/write-key-value-pairs/), [listar](https://developers.cloudflare.com/kv/api/list-keys/) y [borrar](https://developers.cloudflare.com/kv/api/delete-key-value-pairs/)
- [Comandos de Wrangler para KV](https://developers.cloudflare.com/kv/reference/kv-commands/) y [cambio a modo local en Wrangler v4](https://developers.cloudflare.com/workers/wrangler/migration/update-v3-to-v4/)
- [Límites](https://developers.cloudflare.com/kv/platform/limits/) y [precios](https://developers.cloudflare.com/kv/platform/pricing/)
- [Ubicación de los datos y jurisdicciones](https://developers.cloudflare.com/kv/reference/data-location/)
- [Métricas y analítica](https://developers.cloudflare.com/kv/observability/metrics-analytics/)
- [Elegir producto de almacenamiento](https://developers.cloudflare.com/workers/platform/storage-options/)
- Changelog: [cacheTtl mínimo de 30 s](https://developers.cloudflare.com/changelog/post/2026-01-30-kv-reduced-minimum-cachettl/), [fin de las rutas antiguas de la API](https://developers.cloudflare.com/changelog/post/2026-07-15-kv-legacy-namespace-routes-deprecation/) y [jurisdicciones disponibles para todos](https://developers.cloudflare.com/changelog/post/2026-10-02-kv-jurisdictions-ga/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** D1: SQLite sin servidor.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
