---
publishDate: 2026-04-28T09:00:00Z
draft: false
image: 'media:blog/cloudflare-d1-guia/portada.png'
title: 'D1: la base de datos SQL sin servidor de Cloudflare'
excerpt: 'Serie Cloudflare, parte 17. Qué es D1, cómo crear una base de datos con Wrangler, migraciones, consultas preparadas desde un Worker, réplicas de lectura con la Sessions API, Time Travel para volver atrás, dónde viven tus datos y cuánto cuesta.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'd1'
  - 'sqlite'
  - 'bases de datos'
  - 'workers'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 17 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Con [Workers](/blog/cloudflare-workers-guia) ya tienes código en el borde y con [R2](/blog/cloudflare-r2-guia), ficheros. Falta lo que casi toda aplicación acaba necesitando: tablas, filas y consultas SQL. Eso es D1.

## Qué es

D1 es una base de datos SQL gestionada y sin servidor. Usa el motor de **SQLite**: mismos tipos y funciones, `PRAGMA` incluidos (con matices). No hay servidor que dimensionar ni conexiones que gestionar.

Tres ideas para entenderla:

- **Se consulta desde un Worker con un *binding***, o desde fuera con la API REST y Wrangler.
- **Muchas bases pequeñas mejor que una enorme.** Cada base admite hasta 10 GB, pero una cuenta de pago puede tener un millón: una por cliente o por entorno.
- **Cada base es de un solo hilo.** Procesa las consultas de una en una, así que los índices importan.

**Planes.** D1 está en Workers Free y en Workers Paid. Cambian los límites y la retención de Time Travel (al final).

## Casos de uso

- **El backend de una aplicación pequeña o mediana:** usuarios, pedidos, comentarios.
- **Una base por cliente.** Aísla los datos y simplifica borrar o exportar a un cliente.
- **Catálogos y configuración** que se leen mucho y se escriben poco, con réplicas cerca de los usuarios.
- **Búsqueda de texto** con el módulo FTS5 de SQLite.

## Arquitectura

![Un Worker con binding a D1 abre una sesión con la Sessions API: las escrituras van siempre a la instancia primaria (ubicada por pista de ubicación o jurisdicción) y las lecturas pueden servirse desde réplicas en ENAM, WNAM, WEUR, EEUR, APAC y OC; Time Travel guarda el historial de la primaria. Debajo, tabla con los modos de withSession](media:blog/cloudflare-d1-guia/00-arquitectura.png)

1. Tu Worker consulta D1 a través del binding (`env.DB`).
2. Sin réplicas, **todas las consultas van a la instancia primaria**, en una sola región. Si el usuario está lejos, cada consulta paga el viaje.
3. Con la **replicación de lectura** activada y la **Sessions API**, D1 crea réplicas de solo lectura en cada región disponible (ENAM, WNAM, WEUR, EEUR, APAC y OC). Las lecturas pueden ir a la más cercana; las escrituras, siempre a la primaria.
4. Cada consulta deja un ***bookmark***, un marcador de la versión de la base. Con él, la sesión nunca lee algo más antiguo que lo que ya has visto o escrito.
5. **Time Travel** guarda el historial de la primaria y te deja volver a cualquier minuto dentro de la ventana de retención.

## Implementación paso a paso

La captura es del formulario de creación, en tema claro, rellenado con un nombre de ejemplo y cancelado. En el texto, la base de ejemplo es `serie-d1-demo`.

### 1. Crea la base de datos

En el panel, **Storage & databases › D1 SQL database › Create database**. Dos decisiones:

- **Nombre.** Corto, con guiones y que diga el entorno: `prod-tienda`.
- **Ubicación.** Por defecto, la primaria queda cerca de quien crea la base. Puedes dar una **pista** (`weur`, `eeur`, `enam`, `wnam`, `apac`, `oc`), pero no es una garantía. Sudamérica, África y Oriente Medio no están disponibles. Para una garantía legal, elige una **jurisdicción**: `eu`, `us` o `fedramp`. Se fija al crear la base y no se cambia. Si pones las dos, gana la jurisdicción.

![Formulario Create a D1 database: nombre de ejemplo «tienda-db», ubicación automática con la opción de dar una pista de región y la alternativa de fijar una jurisdicción](media:blog/cloudflare-d1-guia/01-crear-base.png)

Desde la terminal es una línea:

```bash
npx wrangler d1 create serie-d1-demo --jurisdiction=eu --binding=DB --update-config
```

`--binding` y `--update-config` añaden el binding a tu `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "serie-d1-demo",
      "database_id": "<DATABASE_ID>"
    }
  ]
}
```

### 2. Esquema con migraciones

No cambies el esquema a mano. Usa migraciones: ficheros SQL numerados que Wrangler aplica en orden y anota en `d1_migrations`.

```bash
npx wrangler d1 migrations create serie-d1-demo crear_notas
```

Eso crea `migrations/0001_crear_notas.sql`. Escribe dentro el esquema:

```sql
CREATE TABLE notas (
  id INTEGER PRIMARY KEY,
  autor TEXT NOT NULL,
  texto TEXT NOT NULL,
  creada INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_notas_autor ON notas (autor);
```

Aplícala en local y luego en la cuenta:

```bash
npx wrangler d1 migrations apply serie-d1-demo --local
npx wrangler d1 migrations apply serie-d1-demo --remote
```

Tres detalles:

- **Sin `--remote`, Wrangler trabaja contra la base local** de `wrangler dev`, no contra la de tu cuenta. Vale para `migrations apply` y para `d1 execute`.
- Si una migración falla, **se revierte**.
- D1 **aplica siempre las claves foráneas**, como `PRAGMA foreign_keys = on`. Si una migración necesita saltárselas, empieza con `PRAGMA defer_foreign_keys = on`: las violaciones se comprueban al final de la transacción.

La pestaña **Console** ejecuta SQL desde el panel. También se factura.


### 3. Consulta desde un Worker

La regla de oro: **consultas preparadas con `bind()`**, nunca SQL concatenando texto. Así evitas la inyección SQL.

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST") {
      const { autor, texto } = await request.json();
      const r = await env.DB
        .prepare("INSERT INTO notas (autor, texto) VALUES (?, ?)")
        .bind(autor, texto)
        .run();
      return Response.json({ id: r.meta.last_row_id });
    }

    const autor = url.searchParams.get("autor");
    if (!autor) return new Response("Falta el parámetro autor", { status: 400 });
    const { results } = await env.DB
      .prepare("SELECT id, texto, creada FROM notas WHERE autor = ?1 ORDER BY id DESC LIMIT 20")
      .bind(autor)
      .run();
    return Response.json(results);
  },
};
```

Los métodos:

- **`run()`** devuelve `results`, `success` y `meta` (con `rows_read`, `rows_written`, `duration`, `last_row_id`, `changes`). `all()` es equivalente.
- **`first()`** devuelve la primera fila, o `null` si no hay. Con `first("columna")`, solo ese valor. No añade `LIMIT 1` por ti: ponlo tú.
- **`raw()`** devuelve arrays sin metadatos; con `{ columnNames: true }`, la primera fila son los nombres.
- **`batch([...])`** manda varias sentencias en un solo viaje y **funciona como una transacción**: si una falla, se revierte todo. Cuenta como una sola consulta para el límite por invocación.

Los marcadores son `?` o `?1`, `?2` (por posición). Los parámetros con nombre no están soportados.

```js
await env.DB.batch([
  env.DB.prepare("INSERT INTO notas (autor, texto) VALUES (?, ?)").bind("ana", "hola"),
  env.DB.prepare("UPDATE notas SET texto = ? WHERE id = ?").bind("editada", 1),
]);
```

### 4. Réplicas de lectura y Sessions API

La replicación se activa por base en **Settings › Enable Read Replication**, o con la API (`PUT /accounts/{account_id}/d1/database/{database_id}` con `{"read_replication": {"mode": "auto"}}`). No cuesta nada extra: pagas las mismas filas leídas y escritas. Al desactivarla, las réplicas pueden tardar hasta 24 horas en borrarse.


Activarla no basta. **Sin la Sessions API, todo sigue yendo a la primaria.**

```js
// El bookmark lo emitió tu propio Worker en una respuesta anterior; si falta o no
// tiene una longitud razonable, se empieza sin él. D1 rechaza los que no reconoce.
const recibido = request.headers.get("x-d1-bookmark");
const bookmark = recibido && recibido.length <= 128 ? recibido : "first-unconstrained";
const session = env.DB.withSession(bookmark);

const { results } = await session
  .prepare("SELECT id, texto FROM notas WHERE autor = ?")
  .bind("ana")
  .run();

const response = Response.json(results);
response.headers.set("x-d1-bookmark", session.getBookmark() ?? "");
return response;
```

- **`first-unconstrained`** (por defecto): la primera consulta va a cualquier instancia.
- **`first-primary`**: la primera consulta va a la primaria, para leer el dato más reciente.
- **Un bookmark**: la sesión empieza al menos tan actualizada como ese punto. Devolverlo al cliente en una cabecera garantiza que el usuario vea lo que acaba de escribir.

`meta.served_by_region` y `meta.served_by_primary` dicen quién respondió. La Sessions API solo existe en el binding, no en la API REST.

### 5. Time Travel: volver atrás

Time Travel está **siempre activo** y es gratis. Restaura la base a cualquier minuto de los últimos 7 días (Free) o 30 (Paid).

```bash
# Marcador actual y el de un momento pasado
npx wrangler d1 time-travel info serie-d1-demo
npx wrangler d1 time-travel info serie-d1-demo --timestamp="2026-11-21T10:00:00+01:00"

# Restaurar
npx wrangler d1 time-travel restore serie-d1-demo --timestamp=1795251600
```

Ojo: **la restauración sobrescribe la base** y cancela las consultas en curso. Wrangler imprime el bookmark anterior para deshacerla. No se puede clonar una base a un momento pasado.

Si borras una base entera, la API de *undelete* solo la recupera durante **7 días** (desde octubre de 2026).

### 6. Importar y exportar

```bash
npx wrangler d1 export serie-d1-demo --remote --output=./copia.sql
npx wrangler d1 execute serie-d1-demo --remote --file=./copia.sql
```

- **Una exportación en marcha bloquea** las demás peticiones a esa base. Hazla en horas valle.
- Desde noviembre de 2026 se **exportan también bases con tablas virtuales** (FTS5, R*Tree).
- Para traer un `.sqlite3`, conviértelo con `sqlite3 base.sqlite3 .dump > base.sql` y quita `BEGIN TRANSACTION` y `COMMIT;`.

### 7. ORMs

**Drizzle** y **Prisma** funcionan con D1. Desde mayo de 2026, `wrangler d1 migrations apply` lee las carpetas de Drizzle si pones `migrations_pattern` en el binding:

```jsonc
"migrations_dir": "migrations",
"migrations_pattern": "migrations/*/migration.sql"
```

### Lo mismo, como código

Con el proveedor de Terraform (v5), la base de datos y el Worker que la usa:

```hcl
resource "cloudflare_d1_database" "demo" {
  account_id   = var.account_id
  name         = "serie-d1-demo"
  jurisdiction = "eu"
  read_replication = {
    mode = "auto"
  }
}

resource "cloudflare_workers_script" "api" {
  account_id  = var.account_id
  script_name = "serie-d1-api"
  content     = file("${path.module}/worker.js")
  main_module = "worker.js"
  bindings = [{
    type = "d1"
    name = "DB"
    id   = cloudflare_d1_database.demo.id
  }]
}
```

El token necesita *D1 Write* (y *Workers Scripts Write* para el Worker). Ojo: si Terraform **reemplaza** la base, pierdes los datos, y cambiar `jurisdiction` fuerza ese reemplazo. Una base existente se importa con `terraform import cloudflare_d1_database.demo '<account_id>/<database_id>'`. Terraform gestiona la base, no el esquema: las tablas siguen en las migraciones.

## Cómo comprobarlo

Que la base existe, su tamaño y su versión:

```bash
npx wrangler d1 info serie-d1-demo
```

Que la consulta usa el índice y no recorre la tabla entera:

```bash
npx wrangler d1 execute serie-d1-demo --remote \
  --command "EXPLAIN QUERY PLAN SELECT id FROM notas WHERE autor = 'ana'"
# Debe aparecer: SEARCH notas USING INDEX idx_notas_autor
```

Mira también `meta.rows_read` en la respuesta de `run()`: es lo que pagas.

En el panel, la pestaña **Metrics** de la base muestra consultas, filas leídas y escritas y tamaño.


## Límites y precios

| | Workers Free | Workers Paid |
|---|---|---|
| Bases de datos por cuenta | 10 | 1.000.000 (100.000 incluidas) |
| Tamaño máximo por base | 500 MB | 10 GB (no ampliable) |
| Almacenamiento por cuenta | 5 GB | 1 TB (ampliable bajo petición) |
| Time Travel | 7 días | 30 días |
| Consultas por invocación de Worker | 50 | 1.000 |
| Filas leídas | 5 millones/día | 25.000 millones/mes incluidas, luego 0,001 $/millón |
| Filas escritas | 100.000/día | 50 millones/mes incluidas, luego 1,00 $/millón |
| Almacenamiento | 5 GB | 5 GB incluidos, luego 0,75 $/GB-mes |
| Bases por encima de las incluidas | — | 0,10 $/base-mes |

- **En Free, al superar el límite diario las consultas fallan** hasta las 00:00 UTC (desde el 1 de septiembre de 2026). Los datos no se pierden y recibes un aviso por correo.
- **No hay coste de salida.** El Worker que consulta se factura aparte.
- Se factura por **fila**, no por tamaño. Un índice reduce las filas leídas, pero cada escritura en una columna indexada suma una fila escrita.
- Límites iguales en todos los planes: 100 parámetros por consulta, 100 columnas por tabla, 2 MB por fila o valor, 100 KB por sentencia, 30 segundos por consulta y, desde el 4 de noviembre de 2026, **50 MB por resultado**. Pide solo las columnas que necesitas y pagina con `LIMIT`.

## Documentación oficial

- [D1: visión general](https://developers.cloudflare.com/d1/) y [primeros pasos](https://developers.cloudflare.com/d1/get-started/)
- [Workers Binding API](https://developers.cloudflare.com/d1/worker-api/d1-database/) y [consultas preparadas](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [Migraciones](https://developers.cloudflare.com/d1/reference/migrations/) y [claves foráneas](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
- [Replicación de lectura y Sessions API](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) y [ubicación de los datos](https://developers.cloudflare.com/d1/configuration/data-location/)
- [Importar y exportar](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Comandos de Wrangler para D1](https://developers.cloudflare.com/workers/wrangler/commands/d1/)
- [Límites](https://developers.cloudflare.com/d1/platform/limits/) y [precios](https://developers.cloudflare.com/d1/platform/pricing/)
- [Changelog de D1](https://developers.cloudflare.com/changelog/product/d1/), con el [límite de 50 MB por resultado](https://developers.cloudflare.com/changelog/post/2026-10-30-query-result-size-limit/) y la [exportación de tablas virtuales](https://developers.cloudflare.com/changelog/post/2026-11-12-d1-export-virtual-tables/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Durable Objects: estado y coordinación.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
