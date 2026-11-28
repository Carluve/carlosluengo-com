---
publishDate: 2026-11-25T09:00:00Z
draft: false
image: 'media:blog/cloudflare-basin-guia/portada.png'
title: 'Basin: Pipelines, Catalog y SQL para analítica sobre R2'
excerpt: 'Serie Cloudflare, parte 48. Qué es Basin (antes Cloudflare Data Platform), cómo recoger eventos desde un Worker con Basin Pipelines, guardarlos como tablas Apache Iceberg en R2 con Basin Catalog y consultarlos con Basin SQL, con sus límites y precios.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'basin'
  - 'iceberg'
  - 'analitica'
  - 'r2'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 48 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Ya sabes guardar ficheros en [R2](/blog/cloudflare-r2-guia), filas en [D1](/blog/cloudflare-d1-guia) y mensajes en [Queues](/blog/cloudflare-queues-guia). Falta dónde guardar millones de eventos para analizarlos después. Eso es Basin.

## Qué es

Basin es la plataforma de analítica de Cloudflare. Se llamaba **Cloudflare Data Platform** hasta el 1 de octubre de 2026, cuando pasó a disponibilidad general con tres piezas renombradas:

- **Basin Pipelines** (antes Cloudflare Pipelines). Recibe eventos JSON por HTTP, desde un Worker o desde Logpush, los transforma con SQL y los escribe en R2 como tablas Iceberg, Parquet o JSON.
- **Basin Catalog** (antes R2 Data Catalog). Un catálogo [Apache Iceberg](https://iceberg.apache.org/) gestionado dentro de tu bucket. Expone la API REST estándar de Iceberg, así que DuckDB, Spark o PyIceberg leen las mismas tablas. Compacta y limpia *snapshots* por ti.
- **Basin SQL** (antes R2 SQL). Un motor SQL distribuido y sin servidor, sin clústeres que dimensionar.

Lo creado con los nombres antiguos sigue funcionando, pero se irá retirando: en proyectos nuevos usa `wrangler basin …`.

**Planes.** Basin Pipelines necesita **Workers Paid**. Basin Catalog necesita una suscripción a R2 activa y una tarjeta asociada a la cuenta. No hay funciones reservadas a Enterprise.

## Casos de uso

- **Analítica propia de una web.** Cada visita o clic pasa por un Worker y acaba en una tabla que consultas con SQL, sin herramientas de terceros.
- **Logs de Cloudflare a largo plazo.** Logpush envía a un *stream* y filtras los campos antes de guardarlos.
- **Telemetría de dispositivos.** Los dispositivos envían lotes JSON a un *endpoint* HTTP con token.
- **Un *data lake* portable.** Tablas Iceberg estándar que puedes leer desde Spark u otra nube sin pagar salida de datos.

## Arquitectura

![Flujo de Basin: un Worker o un cliente HTTP envían eventos a un stream de Basin Pipelines; el pipeline aplica SQL y el sink escribe ficheros Parquet en una tabla Iceberg de Basin Catalog sobre R2; Basin SQL o motores externos como DuckDB y Spark consultan la tabla](media:blog/cloudflare-basin-guia/00-arquitectura.png)

Basin Pipelines tiene tres piezas que se crean por separado:

1. **Stream.** Una cola duradera que recibe los eventos. **Estructurado** (con esquema de campos y tipos) o **no estructurado** (cualquier JSON en una columna `value`).
2. **Pipeline.** Un `INSERT INTO sink SELECT … FROM stream` donde filtras, eliges columnas o calculas campos. Varios `INSERT` reparten un stream en varias tablas.
3. **Sink.** El destino. El tipo `basin-catalog` escribe Parquet en una tabla Iceberg, con entrega *exactly-once*. Cada *roll interval*, o al llegar a cierto tamaño, publica un fichero.

Ojo: **el esquema de un stream no se puede cambiar**, y los eventos que no lo cumplen **se aceptan pero se descartan**. Valida antes, en tu Worker.

## Implementación paso a paso

El ejemplo: un Worker valida eventos `vista` y `clic` de tu web y los manda a un stream que acaba en la tabla `default.eventos`. Todo se configura a nivel de cuenta.

### 1. Crea un token de R2

El sink y Basin SQL necesitan un token de R2. En **R2 object storage › Overview › Manage API tokens › Create API token**, elige el permiso **Admin Read & Write**. A un cliente que solo consulta le basta **Admin Read only**.

![Basin Pipelines sin pipelines: botón Create Pipeline, comando de Wrangler y uso a cero](media:blog/cloudflare-basin-guia/01-panel.png)

Guárdalo en un gestor de contraseñas. El Worker no lo necesita: el *binding* se autentica solo.

### 2. Crea el stream, el sink y el pipeline

Lo más rápido es el asistente de Wrangler:

```bash
npx wrangler basin pipelines setup --name eventos
```

Las respuestas para este ejemplo:

- **HTTP endpoint:** desactivado. Los eventos llegan por el *binding* del Worker.
- **Esquema:** `ts` (`timestamp`, obligatorio), `tipo` (`string`, obligatorio), `ruta` (`string`, obligatorio) y `pais` (`string`, opcional).
- **Destino:** *Data Catalog (Iceberg)*, modo avanzado, *namespace* `default` y tabla `eventos`, que no debe existir aún.
- **Roll interval:** 60 segundos (el mínimo; por defecto son 300).
- **SQL:** ingesta simple (`SELECT *`).

Apunta el **ID del stream** (no el del pipeline): lo usa el *binding*. En el panel, **Basin Pipelines › Create Pipeline** abre un asistente equivalente.

Para filtrar en la ingesta, el SQL del pipeline admite `WHERE`, por ejemplo `INSERT INTO eventos_sink SELECT * FROM eventos WHERE tipo = 'vista'`.

### 3. Mantenimiento de la tabla

Con un *roll interval* de 60 segundos acabas con muchos ficheros pequeños, y eso ralentiza las consultas. Activa dos cosas en el catálogo:

- **Compactación:** junta ficheros pequeños en otros de 64 a 512 MB. Para streaming, la documentación sugiere 128–256 MB.
- **Caducidad de *snapshots*:** borra *snapshots* antiguos y sus ficheros huérfanos. Por defecto, los de más de 30 días, conservando los 5 últimos. Es gratuita.

En el panel, **Basin Catalog › Create catalog** incluye este paso al crear un catálogo nuevo. Para uno existente está en la pestaña **Settings › Table Maintenance**.

Con Wrangler, sobre el bucket que creó el asistente:

```bash
export CATALOG_TOKEN="..."   # el token del paso 1, nunca en el repositorio
npx wrangler basin catalog compaction enable mi-bucket --target-size 128 --token "$CATALOG_TOKEN"
npx wrangler basin catalog snapshot-expiration enable mi-bucket --token "$CATALOG_TOKEN" --older-than-days 7 --retain-last 10
```

### 4. El Worker que envía eventos

En `wrangler.jsonc`, el *binding* con el ID del stream:

```jsonc
{
  "pipelines": [
    { "binding": "EVENTS", "stream": "<STREAM_ID>" }
  ]
}
```

El campo antiguo `pipeline` aún funciona, con aviso de obsoleto. Con `npx wrangler types`, el *binding* queda tipado según el esquema del stream.

El Worker valida todo antes de enviar, porque un evento que no cumple el esquema se pierde sin error:

```js
const TIPOS = new Set(["vista", "clic"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/evento") {
      return new Response("No encontrado", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405, headers: { Allow: "POST" } });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "JSON no válido" }, { status: 400 });
    }

    const tipo = body?.tipo;
    const ruta = body?.ruta;
    if (typeof tipo !== "string" || !TIPOS.has(tipo)) {
      return Response.json({ error: "tipo debe ser 'vista' o 'clic'" }, { status: 400 });
    }
    if (typeof ruta !== "string" || !ruta.startsWith("/") || ruta.length > 512) {
      return Response.json({ error: "ruta no válida" }, { status: 400 });
    }

    const evento = { ts: new Date().toISOString(), tipo, ruta };
    const pais = request.cf?.country;
    if (typeof pais === "string") evento.pais = pais;

    try {
      await env.EVENTS.send([evento]);
    } catch (err) {
      console.error("No se pudo enviar al stream", err);
      return Response.json({ error: "Inténtalo más tarde" }, { status: 503 });
    }
    return new Response(null, { status: 202 });
  },
};
```

`send()` recibe un array y se resuelve cuando el stream confirma la ingesta. La hora la pone el servidor y el país sale de `request.cf`. Despliega con `npx wrangler deploy`.

Para el *endpoint* HTTP (`https://{stream-id}.ingest.cloudflare.com`), activa la autenticación y usa un token con el permiso **Basin Pipelines Send**.

### Lo mismo, como código

El proveedor de Terraform admite Basin desde la v5.19.0. Los recursos aún conservan los nombres antiguos (`cloudflare_pipeline_*`, `cloudflare_r2_data_catalog`):

```hcl
resource "cloudflare_r2_data_catalog" "eventos" {
  account_id  = var.account_id
  bucket_name = var.bucket_name # un bucket de R2 que ya existe
}

resource "cloudflare_pipeline_stream" "eventos" {
  account_id = var.account_id
  name       = "eventos"
  format     = { type = "json" }
  schema = {
    fields = [
      { name = "ts",   type = "timestamp", required = true },
      { name = "tipo", type = "string",    required = true },
      { name = "ruta", type = "string",    required = true },
      { name = "pais", type = "string",    required = false },
    ]
  }
  http           = { enabled = false, authentication = true, cors = {} }
  worker_binding = { enabled = true }
}

resource "cloudflare_pipeline_sink" "eventos" {
  account_id = var.account_id
  name       = "eventos_sink"
  type       = "r2_data_catalog"
  format     = { type = "parquet" }
  schema     = { fields = [] }
  config = {
    account_id = var.account_id
    bucket     = cloudflare_r2_data_catalog.eventos.bucket_name
    table_name = "eventos"
    token      = var.catalog_token # variable sensible, nunca en el repositorio
  }
}

resource "cloudflare_pipeline" "eventos" {
  account_id = var.account_id
  name       = "eventos_pipeline"
  sql        = "INSERT INTO ${cloudflare_pipeline_sink.eventos.name} SELECT * FROM ${cloudflare_pipeline_stream.eventos.name}"
}
```

Declara `catalog_token` con `sensitive = true`. La guía oficial muestra cómo crearlo con `cloudflare_account_token`.

## Cómo comprobarlo

Que el Worker acepta lo bueno y rechaza lo malo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://eventos.example.workers.dev/evento \
  -H "Content-Type: application/json" -d '{"tipo":"vista","ruta":"/"}'
# 202

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://eventos.example.workers.dev/evento \
  -H "Content-Type: application/json" -d 'esto no es json'
# 400
```

Pasado el *roll interval*, consulta con Basin SQL (el *warehouse* lo da `npx wrangler basin catalog get <bucket>`):

```bash
export WRANGLER_BASIN_SQL_AUTH_TOKEN="..."   # el token del paso 1
npx wrangler basin sql query "<WAREHOUSE>" "
SELECT ruta, COUNT(*) AS visitas
FROM default.eventos
WHERE tipo = 'vista' AND ts > '2026-11-01T00:00:00Z'
GROUP BY ruta
ORDER BY visitas DESC
LIMIT 20"
```

Si la tabla sale vacía, espera unos minutos a que se escriba el primer fichero. `SHOW TABLES IN default;` y `DESCRIBE default.eventos;` no escanean datos.

En el panel, **Basin Catalog › Query data** abre un editor SQL con autocompletado y `EXPLAIN`. Si faltan eventos, las métricas de errores de usuario del pipeline muestran los descartados por el esquema.

Para consultas rápidas y baratas: filtra por tiempo, nombra las columnas, usa `LIMIT` y, en tablas grandes, `approx_distinct()`.

## Límites y precios

**Límites de Basin Pipelines (por cuenta):**

| | Límite |
|---|---|
| Streams, sinks y pipelines | 20 de cada |
| Tamaño máximo por petición de ingesta | 5 MB |
| Ingesta por stream | 1 GB/s |

- Basin SQL es **solo lectura** y solo lee Parquet. Tiene JOIN, CTE, subconsultas y funciones de ventana, pero no `UNNEST`, `PIVOT` ni `LATERAL`.

**Precios.** Se factura desde el 3 de agosto de 2026 (fuera de Enterprise), más el almacenamiento y las operaciones de [R2](/blog/cloudflare-r2-guia).

| | Incluido al mes | Después |
|---|---|---|
| Ingesta en streams | Ilimitada | Gratis |
| Transformaciones SQL (Pipelines) | 50 GB | 0,04 $/GB |
| Sink a JSON | 50 GB, compartidos entre sinks | 0,03 $/GB |
| Sink a Parquet o Iceberg | 50 GB, compartidos entre sinks | 0,06 $/GB |
| Operaciones del catálogo | 1 millón | 9 $/millón |
| Compactación: datos procesados | 10 GB | 0,005 $/GB |
| Compactación: objetos procesados | 1 millón | 2 $/millón |
| Basin SQL: datos escaneados (comprimidos) | 10 GB | 0,0025 $/GB (2,50 $/TB) |

- Los sinks se miden sobre datos **sin comprimir**; Basin SQL, sobre datos **comprimidos**, con un mínimo de 10 MB por consulta.
- Las consultas que fallan no se cobran.
- Ejemplo oficial: entran 500 GB, llegan 300 GB a Iceberg. Pipelines cuesta 33 $, más 0,15 $ de catálogo y consultas, sin contar R2.

## Documentación oficial

- [Basin: visión general](https://developers.cloudflare.com/basin/) y [guía de primeros pasos](https://developers.cloudflare.com/basin/get-started/guide/)
- [Basin Pipelines](https://developers.cloudflare.com/basin-pipelines/), [escribir en un stream](https://developers.cloudflare.com/basin-pipelines/streams/writing-to-streams/) y [sink a Basin Catalog](https://developers.cloudflare.com/basin-pipelines/sinks/available-sinks/r2-data-catalog/)
- [Basin Catalog](https://developers.cloudflare.com/basin-catalog/), [gestionar catálogos](https://developers.cloudflare.com/basin-catalog/manage-catalogs/) y [mantenimiento de tablas](https://developers.cloudflare.com/basin-catalog/table-maintenance/)
- [Basin SQL](https://developers.cloudflare.com/basin-sql/) y [limitaciones y buenas prácticas](https://developers.cloudflare.com/basin-sql/reference/limitations-best-practices/)
- [Límites de Pipelines](https://developers.cloudflare.com/basin-pipelines/platform/limits/) y [precios de Basin](https://developers.cloudflare.com/basin/platform/pricing/)
- [Terraform para Basin Pipelines](https://developers.cloudflare.com/basin-pipelines/reference/terraform/)
- Changelog: [Basin en disponibilidad general](https://developers.cloudflare.com/changelog/post/2026-10-01-basin-ga/), [ingesta de 1 GB/s por stream](https://developers.cloudflare.com/changelog/post/2026-10-01-stream-ingest-limit-increase/) y [soporte en Terraform](https://developers.cloudflare.com/changelog/post/2026-04-27-terraform-support/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Registrar, dominios a precio de coste.

## También te puede interesar

- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Queues: mensajes y tareas en segundo plano](/blog/cloudflare-queues-guia)
