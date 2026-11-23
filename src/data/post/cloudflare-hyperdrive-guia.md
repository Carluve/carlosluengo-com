---
publishDate: 2026-05-26T09:00:00Z
draft: false
image: 'media:blog/cloudflare-hyperdrive-guia/portada.png'
title: 'Hyperdrive: tu base de datos de siempre, más rápida'
excerpt: 'Serie Cloudflare, parte 21. Qué hace Hyperdrive con tu Postgres o MySQL de siempre, cómo se crea una configuración, cómo se usa desde un Worker con node-postgres, postgres.js o mysql2, cómo llegar a una base de datos privada, qué cachea y qué no, y qué cabe en el plan Free.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'hyperdrive'
  - 'postgres'
  - 'mysql'
  - 'workers'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 21 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

[D1](/blog/cloudflare-d1-guia) sirve si empiezas de cero. Si ya tienes un Postgres o un MySQL con años de datos, Hyperdrive permite que un [Worker](/blog/cloudflare-workers-guia) hable con esa base de datos sin pagar la latencia de cada conexión.

## Qué es

Hyperdrive se pone entre tu Worker y tu base de datos. No guarda tus datos. Hace tres cosas:

- **Abre la conexión cerca del Worker.** El saludo de Postgres o MySQL (TCP, TLS, autenticación) necesita varios viajes de ida y vuelta. Con Hyperdrive, esos viajes terminan en el centro de datos de Cloudflare más cercano, no en tu servidor.
- **Mantiene un pool de conexiones** cerca de tu base de datos y limita cuántas abre contra el origen.
- **Cachea las lecturas** durante 60 segundos por defecto.

Funciona con **PostgreSQL 9.0 a 18.x**, **MySQL 5.7 a 8.x** y MariaDB, y con servicios compatibles como Aurora, Neon, Supabase, Timescale, CockroachDB o PlanetScale. SQL Server y MongoDB no están soportados.

**Planes.** Hyperdrive va con los planes de Workers, no con los de la zona: 100.000 consultas al día en Workers Free y sin límite en Workers Paid. El pool y la caché no cuestan nada aparte. No hay nada exclusivo de Enterprise.

## Casos de uso

- **Llevar una API a Workers sin migrar la base de datos.**
- **Dejar de agotar conexiones.** Cada petición de un Worker abre un cliente nuevo, pero el origen solo ve las conexiones del pool.
- **Catálogos que se leen mucho y cambian poco.** Salen de la caché sin tocar la base de datos.
- **Bases de datos privadas.** Con [Tunnel](/blog/cloudflare-tunnel-guia) y Workers VPC llegas a un Postgres de tu red sin abrir puertos.

## Arquitectura

![Flujo de Hyperdrive: el Worker se conecta a Hyperdrive en el mismo centro de datos; las lecturas cacheables salen de la caché; el resto viaja al pool de conexiones cerca de la base de datos, que llega a Postgres o MySQL directamente o por Workers VPC y Tunnel; debajo, tabla con qué se cachea y qué no](media:blog/cloudflare-hyperdrive-guia/00-arquitectura.png)

Tu Worker usa un driver normal con las credenciales del binding, que apuntan a Hyperdrive. Si la lectura está en caché, responde Hyperdrive. Si no, la consulta pasa al pool, que llega al origen por Internet con TLS o por **Workers VPC**.

El pool trabaja en **modo transacción**: una conexión sirve a un cliente durante una transacción y vuelve al pool. Eso tiene consecuencias: un `SET` no sobrevive a su transacción. No funcionan los *advisory locks* de sesión (usa los de transacción), `LISTEN`/`NOTIFY` ni `PREPARE`/`EXECUTE` en SQL. En MySQL tampoco valen `USE`, las consultas con varias sentencias ni los *prepared statements*. Para esos casos, Cloudflare recomienda un segundo cliente directo, sin Hyperdrive.

## Implementación paso a paso

Hyperdrive se configura en la cuenta, no en la zona. La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Prepara la base de datos

Crea un usuario solo para Hyperdrive, con los permisos justos. Dos requisitos:

- **TLS obligatorio.** No hay conexiones en texto plano. El modo por defecto es `require` en Postgres y `REQUIRED` en MySQL.
- **Acceso desde Cloudflare.** Si filtras por IP, permite los rangos de Cloudflare: Hyperdrive se conecta desde ellos.

### 2. Crea la configuración

En el panel, ve a la página **Hyperdrive** de la cuenta y pulsa **Create configuration**. Pones un nombre, eliges base de datos pública o privada y pegas la cadena de conexión.

![Formulario Create Hyperdrive Connection: nombre de ejemplo tienda-postgres, cadena de conexión y caché activada](media:blog/cloudflare-hyperdrive-guia/01-panel.png)

Con Wrangler:

```bash
npx wrangler hyperdrive create tienda-db --connection-string="$DATABASE_URL"
```

`DATABASE_URL` es `postgres://usuario:contraseña@host:5432/base` (o `mysql://…`), en una variable de entorno para que la contraseña no acabe en el historial. Hyperdrive prueba la conexión y devuelve el `id` del binding.

### 3. Conéctala a un Worker

En `wrangler.jsonc`:

```jsonc
{
  "name": "tienda-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-23",
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<ID_DE_LA_CONFIGURACION>",
      "localConnectionString": "postgres://postgres:postgres@localhost:5432/tienda"
    }
  ]
}
```

Con una `compatibility_date` del 4 de agosto de 2026 o posterior, la compatibilidad con Node.js que necesitan los drivers viene activada. Con una anterior, añade `"compatibility_flags": ["nodejs_compat"]`. `localConnectionString` es opcional y sirve para usar `wrangler dev` contra una base local.

Versiones mínimas recomendadas: `pg` 8.16.3, `postgres` 3.4.5 y `mysql2` 3.13.0.

```ts
import { Client } from "pg";

export interface Env {
  HYPERDRIVE: Hyperdrive;
}

const SLUG = /^[a-z0-9-]{1,40}$/;

async function consulta(env: Env, sql: string, params: unknown[]) {
  // Un cliente por petición: el pool de verdad lo mantiene Hyperdrive.
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();
  return (await client.query(sql, params)).rows;
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/productos") return new Response("No encontrado", { status: 404 });

    try {
      if (req.method === "GET") {
        const categoria = url.searchParams.get("categoria");
        if (categoria === null || !SLUG.test(categoria)) {
          return Response.json({ error: "categoria no válida" }, { status: 400 });
        }
        const filas = await consulta(
          env,
          "SELECT id, nombre, precio FROM productos WHERE categoria = $1 ORDER BY nombre LIMIT 50",
          [categoria],
        );
        return Response.json(filas);
      }

      if (req.method === "POST") {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "JSON no válido" }, { status: 400 });
        }
        const b = body as Record<string, unknown> | null;
        if (
          typeof b !== "object" || b === null ||
          typeof b.nombre !== "string" || b.nombre.length < 1 || b.nombre.length > 100 ||
          typeof b.precio !== "number" || !Number.isFinite(b.precio) || b.precio < 0 ||
          typeof b.categoria !== "string" || !SLUG.test(b.categoria)
        ) {
          return Response.json({ error: "datos no válidos" }, { status: 400 });
        }
        const [fila] = await consulta(
          env,
          "INSERT INTO productos (nombre, precio, categoria) VALUES ($1, $2, $3) RETURNING id",
          [b.nombre, b.precio, b.categoria],
        );
        return Response.json(fila, { status: 201 });
      }

      return new Response("Método no permitido", { status: 405 });
    } catch (e) {
      console.error(e);
      return Response.json({ error: "error de base de datos" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
```

Usa siempre consultas parametrizadas y devuelve un error genérico. Crear un cliente por petición es lo recomendado: Hyperdrive lo cierra al acabar y conserva la conexión real.

Con **postgres.js**, la documentación recomienda `max: 5` (los Workers limitan las conexiones externas simultáneas) y `fetch_types: false` si no usas tipos array. Deja `prepare` en `true`: con `false`, Hyperdrive no cachea las sentencias preparadas.

```ts
import postgres from "postgres";

const sql = postgres(env.HYPERDRIVE.connectionString, { max: 5, fetch_types: false });
const filas = await sql`SELECT id, nombre FROM productos WHERE categoria = ${categoria}`;
```

Con **mysql2**, pasas cada campo del binding por separado y necesitas `disableEval`:

```ts
import { createConnection } from "mysql2/promise";

const db = await createConnection({
  host: env.HYPERDRIVE.host,
  user: env.HYPERDRIVE.user,
  password: env.HYPERDRIVE.password,
  database: env.HYPERDRIVE.database,
  port: env.HYPERDRIVE.port,
  disableEval: true, // obligatorio en Workers
});
const [filas] = await db.query("SELECT id, nombre FROM productos WHERE categoria = ?", [categoria]);
```

Si cada petición hace varias consultas seguidas, activa **Placement** en la región de tu base de datos: cada consulta baja de 20-30 ms a 1-3 ms.

### 4. Si la base de datos es privada

Desde abril de 2026, la vía recomendada es **Workers VPC**: un túnel de [Cloudflare Tunnel](/blog/cloudflare-tunnel-guia) en tu red, un *VPC Service* TCP que apunta a la base de datos y una configuración de Hyperdrive que lo usa. Sin aplicación de [Access](/blog/cloudflare-access-guia) ni *service token*.

Con Wrangler, con el túnel ya creado:

```bash
npx wrangler vpc service create tienda-pg \
  --type tcp --tcp-port 5432 --app-protocol postgresql \
  --tunnel-id <ID_DEL_TUNEL> --ipv4 192.0.2.10

npx wrangler hyperdrive create tienda-privada \
  --service-id <ID_DEL_VPC_SERVICE> \
  --database tienda --user hyperdrive --password "$DB_PASSWORD" \
  --scheme postgresql
```

`--service-id` no se combina con `--origin-host`, `--origin-port`, `--connection-string` ni con las credenciales de Access. Si la base de datos usa una CA privada (el bundle de RDS, por ejemplo) o pide certificado de cliente, súbelos con `wrangler cert upload` y adjúntalos al VPC Service en vez de relajar la verificación. La vía con Tunnel y Access sigue documentada.

### 5. Ajusta la caché

- **Se cachea:** consultas de solo lectura con respuestas de hasta 50 MB.
- **No se cachea:** escrituras ni consultas con funciones como `NOW()`, `CURRENT_TIMESTAMP`, `RANDOM()` o, en MySQL, `LAST_INSERT_ID()`. Si necesitas la fecha, calcúlala en el Worker y pásala como parámetro. La detección es textual: basta un comentario `-- NOW()` para que la consulta no se cachee.

Por defecto, `max_age` es de **60 segundos** (máximo una hora) y `stale_while_revalidate`, de **15**. Además, **una escritura no invalida la caché**: si insertas un producto y relees el listado, puedes ver la versión anterior durante algo más de un minuto.

No hay interruptor por consulta. La solución es una **segunda configuración sin caché** contra la misma base de datos:

```bash
npx wrangler hyperdrive create tienda-db-fresca --connection-string="$DATABASE_URL" --caching-disabled
```

```jsonc
"hyperdrive": [
  { "binding": "HYPERDRIVE", "id": "<ID_CON_CACHE>" },
  { "binding": "HYPERDRIVE_FRESCO", "id": "<ID_SIN_CACHE>" }
]
```

Usa `HYPERDRIVE_FRESCO`, con su propio cliente, para sesiones, permisos y lecturas justo después de escribir. Las dos configuraciones suman conexiones al origen. Para cambiar los tiempos: `wrangler hyperdrive update <ID> --max-age 300 --swr 30`.

### Lo mismo, como código

Con el proveedor de Terraform (v5):

```hcl
variable "db_password" {
  type      = string
  sensitive = true
}

resource "cloudflare_hyperdrive_config" "tienda" {
  account_id = var.account_id
  name       = "tienda-db"
  origin = {
    host     = "db.example.com"
    port     = 5432
    database = "tienda"
    user     = "hyperdrive"
    password = var.db_password
    scheme   = "postgres"
  }
  caching = {
    max_age                = 120
    stale_while_revalidate = 15
  }
  origin_connection_limit = 20
}
```

Para una base privada, cambia `host` y `port` por `service_id`. El token necesita *Hyperdrive Write*. La API nunca devuelve la contraseña, pero queda en el estado de Terraform: protégelo.

## Cómo comprobarlo

En local, `npx wrangler dev` usa `localConnectionString`. Desde diciembre de 2025 también puede conectarse a una base remota por TLS, pero en local **no hay caché de Hyperdrive**.

Tras desplegar:

```bash
curl -s "https://tienda-api.<tu-subdominio>.workers.dev/productos?categoria=libros"
# [{"id":1,"nombre":"...","precio":12.5}, ...]

curl -s -o /dev/null -w "%{http_code}\n" "https://tienda-api.<tu-subdominio>.workers.dev/productos"
# 400 (falta categoria)
```

En el panel, cada configuración tiene una pestaña **Metrics** con las conexiones del pool: abiertas, en espera y el máximo. Si siempre hay clientes en espera, el límite de conexiones se queda corto. Los aciertos de caché y las latencias por consulta están en la API de GraphQL, dataset `hyperdriveQueriesAdaptiveGroups`.

## Límites y precios

| | Workers Free | Workers Paid |
|---|---|---|
| Consultas al día | 100.000 | Sin límite |
| Configuraciones por cuenta | 10 | 25 |
| Conexiones al origen por configuración | ~20 | ~100 |

Iguales en los dos planes:

- **Conexión inicial:** 15 s de timeout. **Conexión inactiva:** 10 minutos.
- **Sentencia:** 60 s como máximo; las más largas se cortan.
- **Respuesta cacheada:** 50 MB como máximo; las mayores llegan, pero no se cachean.
- Cuentan todas las consultas, cacheadas o no. En Free, pasadas las 100.000, fallan hasta las 00:00 UTC.
- El límite de conexiones es blando (Hyperdrive puede pasarse para no perder disponibilidad) y se puede bajar hasta 5. Solo limita las conexiones al origen, no los clientes de tus Workers.
- Sin coste por transferencia.

## Documentación oficial

- [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) y [primeros pasos](https://developers.cloudflare.com/hyperdrive/get-started/)
- [Cómo funciona](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/), [pool de conexiones](https://developers.cloudflare.com/hyperdrive/concepts/connection-pooling/) y [caché de consultas](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)
- [Bases de datos y funciones soportadas](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/)
- [postgres.js](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/) y [MySQL](https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/)
- [Base de datos privada con Workers VPC](https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database-vpc/) y [con Tunnel y Access](https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database/)
- [Límites](https://developers.cloudflare.com/hyperdrive/platform/limits/), [precios](https://developers.cloudflare.com/hyperdrive/platform/pricing/) y [métricas](https://developers.cloudflare.com/hyperdrive/observability/metrics/)
- [Comandos de Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/hyperdrive/)
- [Changelog de Hyperdrive](https://developers.cloudflare.com/changelog/product/hyperdrive/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Containers y Sandboxes: contenedores junto a tus Workers.

## También te puede interesar

- [D1: la base de datos SQL sin servidor de Cloudflare](/blog/cloudflare-d1-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Cloudflare Tunnel: publicar un servicio sin abrir puertos](/blog/cloudflare-tunnel-guia)
