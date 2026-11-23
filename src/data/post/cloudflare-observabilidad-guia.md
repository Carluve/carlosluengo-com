---
publishDate: 2026-06-30T09:00:00Z
draft: false
image: 'media:blog/cloudflare-observabilidad-guia/portada.png'
title: 'Observabilidad en Cloudflare: logs, trazas y Logpush'
excerpt: 'Serie Cloudflare, parte 26. Cómo activar Workers Logs y las trazas OpenTelemetry, cuándo usar wrangler tail o un Tail Worker, cómo consultar con el Query Builder, cómo exportar a Grafana o Datadog y cómo sacar los logs de tu zona a R2 con Logpush, ya disponible en todos los planes.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'observabilidad'
  - 'workers'
  - 'logpush'
  - 'opentelemetry'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 26 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Ya tienes [Workers](/blog/cloudflare-workers-guia) hablando con [R2](/blog/cloudflare-r2-guia), [Queues](/blog/cloudflare-queues-guia) y [Durable Objects](/blog/cloudflare-durable-objects-guia). Cuando algo falla en producción, necesitas saber qué pasó, en qué petición y dónde se fue el tiempo.

## Qué es

Cloudflare agrupa varias herramientas bajo **Observability**:

- **Workers Logs.** Guarda tus `console.log`, los errores y un log por invocación. Se consulta en el panel.
- **Workers Traces.** Trazas OpenTelemetry automáticas: cada `fetch`, cada lectura de KV o R2 y cada llamada a un Durable Object es un *span*. Puedes añadir los tuyos.
- **Tiempo real.** `wrangler tail` o la vista **Live** del panel. No guardan nada.
- **Tail Workers.** Un Worker que recibe los eventos de otro.
- **Exportación OpenTelemetry.** Logs y trazas hacia Grafana Cloud, Datadog, Honeycomb, Sentry, Axiom y otros.
- **Logpush.** Entrega por lotes los logs de tu zona o tu cuenta (HTTP, firewall, DNS, Zero Trust…) a R2, S3 o un SIEM.

**Planes.** Workers Logs y las trazas están en Workers Free y Paid. Los Tail Workers y Workers Logpush necesitan **Workers Paid**. Logpush para el resto de datasets está en todos los planes desde el 30 de septiembre de 2026. Algunos datasets dependen del producto: `websocket_analytics` es de **Enterprise**.

## Casos de uso

- **Vigilar un despliegue.** Subes una versión y miras en vivo si salen excepciones.
- **Encontrar la petición lenta.** La traza dice si el tiempo se fue en tu código, en D1 o en una API externa.
- **Cumplimiento.** Logpush guarda las peticiones HTTP y los eventos del WAF en tu propio almacenamiento.
- **Seguir con tu herramienta.** Si el equipo ya vive en Grafana o Datadog, exportas y no cambias de panel.

## Arquitectura

![Flujo de la observabilidad en Cloudflare: un Worker emite logs y spans hacia Workers Logs y Traces (7 días, Query Builder), hacia destinos OpenTelemetry, hacia un Tail Worker y hacia wrangler tail; debajo, el tráfico de la zona sale por Logpush a R2, S3 o un SIEM; tabla con cada herramienta, para qué sirve y su plan](media:blog/cloudflare-observabilidad-guia/00-arquitectura.png)

Hay dos fuentes de datos:

1. **Tus Workers.** Cada invocación genera un log de invocación, tus logs, las excepciones y, con trazas activas, los *spans*. Salen por cuatro caminos: se **guardan** en Cloudflare (`persist`, activo por defecto), se **exportan** por OpenTelemetry, pasan a un **Tail Worker** o se ven en **tiempo real**.
2. **La red de Cloudflare.** Peticiones a tu zona, eventos del firewall, DNS, Access o Gateway. Salen con **Logpush**, que envía lotes en cuanto los tiene. Logpush **no recupera el pasado**: si el job falla o está parado, esos logs se pierden.

El muestreo es ***head-based***: se decide al llegar la petición, antes de saber si fallará. `head_sampling_rate` va de 0 a 1 y por defecto vale 1.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Activa logs y trazas

Los Workers nuevos ya traen los logs activados. Las trazas, en beta, van aparte:

```jsonc
{
  "name": "api-pedidos",
  "main": "src/index.js",
  "compatibility_date": "2026-11-23",
  "observability": {
    "logs": { "enabled": true, "head_sampling_rate": 1 },
    "traces": { "enabled": true, "head_sampling_rate": 0.1 }
  }
}
```

- `observability.enabled` a secas solo activa los **logs**.
- Aquí se guardan todos los logs y una de cada diez trazas.
- `"invocation_logs": false` dentro de `logs` quita el log automático por invocación.
- Hace falta Wrangler 3.78.6 o superior.

### 2. Escribe logs que se puedan consultar

Registra **objetos**, no frases: Workers Logs indexa cada clave. El ejemplo valida la entrada y abre un *span* propio:

```js
import { tracing } from "cloudflare:workers";

const TIENDA = /^[a-z0-9-]{1,32}$/;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/pedidos" || request.method !== "POST") {
      return new Response("No encontrado", { status: 404 });
    }

    const tienda = url.searchParams.get("tienda");
    if (!tienda || !TIENDA.test(tienda)) {
      return Response.json({ error: "tienda ausente o no válida" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "JSON no válido" }, { status: 400 });
    }
    const unidades = body?.unidades;
    if (!Number.isInteger(unidades) || unidades < 1 || unidades > 100) {
      return Response.json({ error: "unidades: entero de 1 a 100" }, { status: 400 });
    }

    return tracing.enterSpan("crear-pedido", async (span) => {
      span.setAttribute("pedido.tienda", tienda);
      try {
        // ... guardar en D1, encolar, etc.
        console.log({ event: "pedido_creado", tienda, unidades });
        return Response.json({ ok: true }, { status: 201 });
      } catch (err) {
        console.error({ event: "pedido_fallido", tienda }, err);
        return Response.json({ error: "No se pudo crear" }, { status: 500 });
      }
    });
  },
};
```

- Con `{ event, tienda }` filtras por campo. Con `"tienda: " + tienda` tendrías que buscar texto.
- **No registres datos personales ni secretos.** Lo que registras se guarda y se exporta tal cual.
- `console.error` con el `Error` conserva nombre, mensaje y *stack*, y Workers Issues lo agrupa como fallo.
- `enterSpan` cierra el *span* al terminar la función, dentro de la traza automática.

### 3. Mira en vivo y consulta

Durante un despliegue:

```bash
npx wrangler tail api-pedidos --format pretty --status error
```

También filtra por `--method`, `--header`, `--ip self`, `--search` o `--version-id`. Con mucho tráfico entra en modo muestreo y descarta mensajes; filtrar lo evita. Como máximo, diez clientes siguen un Worker a la vez.

Para lo que ya pasó: **Workers & Pages › tu Worker › Observability**, o la página **Observability** de la cuenta. El **Query Builder** combina filtros por campo (igual, contiene, regex, existe…), visualizaciones (Count, Sum, Average, percentiles de P001 a P999) con **Group By**, y las vistas **Events** e **Invocations**. Las consultas guardadas son de toda la cuenta. Desde febrero de 2026 exportas resultados en JSON o CSV y compartes un enlace a un evento o una traza.

### 4. Exporta con OpenTelemetry

Crea el destino en **Observability › Destinations › Add destination**: nombre, tipo (*Traces* o *Logs*), endpoint OTLP y cabeceras de autenticación. Cloudflare hace un envío de prueba antes de guardarlo.

![Logpush a nivel de cuenta: sin trabajos todavía, con el botón Create a Logpush job y Transformer Studio](media:blog/cloudflare-observabilidad-guia/01-panel.png)

Enlázalo desde el Worker y despliega:

```jsonc
"observability": {
  "traces": { "enabled": true, "destinations": ["grafana-traces"], "persist": false },
  "logs": { "enabled": true, "destinations": ["grafana-logs"] }
}
```

- El nombre debe coincidir con el del panel.
- `persist: false` exporta sin guardar copia en Cloudflare.
- Solo OTLP sobre HTTP con **JSON**; no acepta protobuf binario.
- Las métricas de Workers no se exportan por esta vía.

### 5. Tail Worker, para lógica propia

Para enviar datos fuera, Cloudflare recomienda OpenTelemetry. El Tail Worker es la opción avanzada: filtras o avisas con tu propio código. Necesita **Workers Paid** y se cobra por CPU. Este reenvía solo los fallos, sin *query strings*:

```js
export default {
  async tail(events, env) {
    if (!env.ALERT_URL || !env.ALERT_TOKEN || !Array.isArray(events)) return;

    const fallos = events
      .filter((e) => e?.outcome && e.outcome !== "ok")
      .slice(0, 50)
      .map((e) => {
        let ruta = null;
        try { ruta = new URL(e.event?.request?.url).pathname; } catch {}
        return { worker: String(e.scriptName ?? "?"), resultado: String(e.outcome), ruta };
      });
    if (fallos.length === 0) return;

    try {
      const res = await fetch(env.ALERT_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.ALERT_TOKEN}` },
        body: JSON.stringify(fallos),
      });
      if (!res.ok) console.error({ event: "tail_envio_fallido", status: res.status });
    } catch (err) {
      console.error({ event: "tail_envio_error" }, err);
    }
  },
};
```

El token va como secreto (`npx wrangler secret put ALERT_TOKEN`). En el Worker productor: `"tail_consumers": [{ "service": "alertas-tail" }]`.

### 6. Saca los logs de la zona con Logpush

En la zona, ve a **Analytics & Logs › Logpush** y pulsa **Create a Logpush job**. Para datasets de cuenta, usa la página **Logpush** de la cuenta.

**R2 Object Storage - automatic** crea el bucket por ti. La opción personalizada pide bucket, ruta, subcarpetas diarias (recomendado) y un token de R2 con escritura. Después eliges campos, filtro y opciones avanzadas.

- **Exclude DDoS attack traffic** (septiembre de 2026) quita el tráfico de ataques en `http_requests`, `firewall_events` y `network_analytics_logs`.
- Desde octubre de 2026, `http_requests` y `firewall_events` existen **a nivel de cuenta**: un job para todas tus zonas, con el campo `ZoneName`.
- Activa las **notificaciones de salud** de Logpush para enterarte si un job deja de entregar.

Para Workers Logpush (`workers_trace_events`), añade `"logpush": true` al `wrangler.jsonc` de cada Worker.

## Lo mismo, como código

Con el proveedor de Terraform (v5), un job de la zona a R2. Las credenciales llegan por variables sensibles:

```hcl
variable "zone_id" { type = string }
variable "account_id" { type = string }

variable "r2_access_key_id" {
  type      = string
  sensitive = true
}

variable "r2_secret_access_key" {
  type      = string
  sensitive = true
}

resource "cloudflare_logpush_job" "http_a_r2" {
  zone_id               = var.zone_id
  name                  = "example-com-http"
  dataset               = "http_requests"
  enabled               = true
  filter_attack_traffic = true
  destination_conf      = "r2://logs-http/{DATE}?account-id=${var.account_id}&access-key-id=${var.r2_access_key_id}&secret-access-key=${var.r2_secret_access_key}"

  output_options = {
    field_names      = ["ClientRequestHost", "ClientRequestURI", "EdgeResponseStatus", "EdgeStartTimestamp", "RayID"]
    timestamp_format = "rfc3339"
  }
}
```

- El token necesita **Logs Write**. Con `account_id` en lugar de `zone_id` creas un job de cuenta.
- `destination_conf` acaba en el *state*: guárdalo cifrado.
- Por API: `POST /zones/{zone_id}/logpush/jobs` con el mismo cuerpo.

## Cómo comprobarlo

Con `wrangler tail` abierto, manda una petición mal formada:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://api-pedidos.example.workers.dev/pedidos?tienda=madrid" \
  -H "content-type: application/json" --data 'no-es-json'
# 400
```

Aparece en la terminal y, en segundos, en **Observability**. Tras una petición válida, filtra por `event = pedido_creado` y abre la traza para ver el *span* `crear-pedido`.

En **Destinations**, cada destino muestra su último envío: *Last: n minutes ago*, *Never run* o *Error*. Los datos pueden tardar unos minutos en llegar al proveedor.

Para Logpush:

```bash
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/logpush/jobs" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

`last_complete` debe avanzar y `last_error` ser `null`. En R2 verás una carpeta por día con ficheros gzip.

## Límites y precios

**Workers Logs y trazas.** Retención máxima de 7 días. Cada log, hasta 256 KB (se trunca y marca `$cloudflare.truncated`). Tope de 5.000 millones de logs por cuenta y día; después, muestreo del 1 %.

Hasta el 30 de noviembre de 2026, Workers Logs incluye 200.000 eventos al día con 3 días de retención en Free, y 20 millones al mes (luego 0,60 $ por millón) con 7 días en Paid.

**Desde el 1 de diciembre de 2026** se cobra por GB con **Cloudflare Observability**, una bolsa por cuenta que comparten Workers Logs, Workers Traces, Containers, R2 Data Access Logs, AI Gateway, Issues y Cloudflare Traces:

| | Free | Paid |
|---|---|---|
| Ingesta | 0,5 GB al día | 50 GB por ciclo + 0,25 $/GB |
| Almacenamiento | 7 días | 10 GB-mes + 0,10 $/GB-mes |

En Free, al agotar el día se deja de ingerir hasta las 00:00 UTC. En Enterprise, el cambio llega con la renovación. Muestrear o usar `persist: false` reduce la factura.

**Logpush** (salvo Workers): 25 GB al mes incluidos hacia R2 o Pipelines (luego 0,03 $/GB) y otros 25 GB hacia destinos externos (luego 0,10 $/GB), medidos sin comprimir. Un registro HTTP ocupa 1,5–3 kB: un millón de peticiones al día son unos 45–90 GB al mes. Hasta 1.000 jobs por cuenta.

**Workers Logpush**: solo Paid, 10 millones de peticiones al mes y 0,05 $ por millón más. `logs` y `exceptions` comparten 16.384 caracteres por evento.

## Documentación oficial

- [Observabilidad de Workers](https://developers.cloudflare.com/workers/observability/) y [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Trazas](https://developers.cloudflare.com/workers/observability/traces/) y [spans personalizados](https://developers.cloudflare.com/workers/observability/traces/custom-spans/)
- [Logs en tiempo real](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/), [Tail Workers](https://developers.cloudflare.com/workers/observability/logs/tail-workers/) y [Query Builder](https://developers.cloudflare.com/workers/observability/query-builder/)
- [Exportación OpenTelemetry](https://developers.cloudflare.com/workers/observability/opentelemetry-export/) y [destinos](https://developers.cloudflare.com/observability/export/opentelemetry/)
- [Logpush](https://developers.cloudflare.com/logs/logpush/), [sus precios](https://developers.cloudflare.com/logs/logpush/pricing/), [Logpush a R2](https://developers.cloudflare.com/logs/logpush/logpush-job/enable-destinations/r2/) y [Workers Logpush](https://developers.cloudflare.com/workers/observability/logs/logpush/)
- [Precios de Cloudflare Observability](https://developers.cloudflare.com/observability/pricing/)
- [Changelog: Logpush en todos los planes](https://developers.cloudflare.com/changelog/post/2026-09-30-logpush-usage-based-pricing/)
- [Terraform: `cloudflare_logpush_job`](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/logpush_job)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** sitios estáticos en Workers, con static assets.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
