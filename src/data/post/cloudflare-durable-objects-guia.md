---
publishDate: 2026-05-05T09:00:00Z
draft: false
image: 'media:blog/cloudflare-durable-objects-guia/portada.png'
title: 'Durable Objects: estado y coordinación en el borde'
excerpt: 'Serie Cloudflare, parte 18. Qué es un Durable Object y por qué hay uno solo por nombre, cómo guardar datos en su SQLite, cómo llamarlo por RPC, para qué sirven las alarmas y la hibernación de WebSockets, cómo se declara en wrangler.jsonc y cuánto cuesta.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'durable objects'
  - 'workers'
  - 'almacenamiento'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 18 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Un [Worker](/blog/cloudflare-workers-guia) no recuerda nada entre peticiones, y KV tarda en propagar los cambios. Si dos personas necesitan ver el mismo dato a la vez (un contador, una sala de chat, una reserva), hace falta un punto único de coordinación. Eso es un Durable Object.

## Qué es

Un Durable Object es una instancia de una clase JavaScript o TypeScript que vive en la red de Cloudflare con un **identificador único en todo el mundo**. Lo definen tres propiedades:

- **Hay uno solo por ID.** Si mil Workers piden el objeto `"sala-42"`, todos hablan con la misma instancia.
- **Es de un solo hilo.** Las llamadas se procesan de una en una, así que no necesitas bloqueos.
- **Tiene su propio almacenamiento**, en la misma máquina, transaccional y con consistencia fuerte. Solo ese objeto puede leerlo.

En el código hay tres piezas:

- **La clase**, que extiende `DurableObject`. Sus métodos públicos se llaman por **RPC** (fecha de compatibilidad 2024-04-03 o posterior).
- **El namespace**: todos los objetos de esa clase. Llega al Worker como *binding*.
- **El stub**: el cliente de un objeto concreto, con `env.MI_CLASE.getByName("nombre")`.

**El almacenamiento es SQLite.** Cada objeto tiene una base de datos SQLite completa (`ctx.storage.sql.exec()`), una API clave-valor síncrona (`ctx.storage.kv`) y recuperación a cualquier punto de los últimos **30 días**. Desde julio de 2026, los namespaces nuevos tienen que usar SQLite; el backend clave-valor antiguo solo queda en las cuentas que ya lo tenían.

**Planes.** Durable Objects con SQLite está en el plan **Workers Free** desde abril de 2025, con límites diarios. No depende del plan de la zona.

## Casos de uso

- **Salas de chat y juegos multijugador.** Un objeto por sala recibe los WebSockets de los participantes y reparte los mensajes.
- **Contadores y reservas exactas.** Plazas, stock, votos. Dos compras simultáneas nunca venden la misma plaza.
- **Rate limiting propio.** Un objeto por usuario o por clave de API cuenta las peticiones con tu lógica.
- **Documentos colaborativos.** Un objeto por documento coordina las ediciones y guarda el historial.
- **Agentes de IA.** El [Agents SDK](https://developers.cloudflare.com/agents/) se apoya en Durable Objects: cada agente es un objeto con su estado, su SQLite y sus tareas programadas.

No es una base de datos global para consultas que crucen todos tus usuarios; para eso está D1. La pauta: un objeto por unidad de coordinación.

## Arquitectura

![Tres visitantes en Madrid, Nueva York y Tokio llegan a Workers en centros de datos cercanos; los tres llaman con getByName al mismo Durable Object, que tiene un solo hilo, SQLite propio, una alarma y WebSockets con hibernación; debajo, tabla de estados del objeto y cuándo se factura la duración](media:blog/cloudflare-durable-objects-guia/00-arquitectura.png)

1. El visitante llega al **Worker** del centro de datos más cercano.
2. El Worker pide un stub con `getByName("example.com")`. El nombre se convierte siempre en el mismo ID.
3. La primera vez, Cloudflare **crea el objeto cerca de quien lo pidió**. Después no se mueve: las peticiones de Tokio viajan hasta él.
4. El objeto ejecuta el método, lee o escribe en su SQLite y responde.

**Dónde nace.** Puedes sugerir una región con un *location hint* en la primera llamada: `getByName("sala", { locationHint: "weur" })`. Es una pista, no una garantía. Si los datos no pueden salir de una región, usa una **jurisdicción**: `env.MI_CLASE.jurisdiction("eu")`. Hay `eu`, `us` (desde junio de 2026) y `fedramp`.

**Ciclo de vida.** Un objeto inactivo cuyos únicos WebSockets usan la API de hibernación hiberna a los **10 segundos** y deja de facturar duración. Si algo se lo impide (un `setTimeout`, una conexión saliente), se desaloja a los **70–140 segundos**. Al despertar, el constructor se ejecuta otra vez. Las variables se pierden; SQLite, no.

## Implementación paso a paso

Vamos a hacer un contador de visitas por ruta: un objeto por dominio, una tabla SQLite y una alarma que pone el contador a cero cada 24 horas. La captura es del panel de Durable Objects de mi cuenta, en tema claro, con los nombres de las clases y de los Workers tapados.

### 1. Crea el proyecto

```bash
npm create cloudflare@latest -- contador
```

Elige **Hello World example › Worker + Durable Objects › TypeScript**. Cambiaremos la clase de ejemplo.

### 2. Declara la clase en wrangler.jsonc

```jsonc
{
  "name": "contador",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-22",
  "durable_objects": {
    "bindings": [{ "name": "CONTADOR", "class_name": "Contador" }]
  },
  "exports": {
    "Contador": { "type": "durable-object", "storage": "sqlite" }
  }
}
```

- **`durable_objects.bindings`** expone el namespace como `env.CONTADOR`.
- **`exports`** crea la clase con SQLite. Es el formato declarativo de **junio de 2026**: describes el estado y `wrangler deploy` crea, renombra (`"state": "renamed"`), borra (`"state": "deleted"`) o transfiere clases entre Workers.

Los proyectos anteriores usan el formato antiguo, que sigue funcionando:

```jsonc
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["Contador"] }]
```

Un Worker usa `exports` o `migrations`, nunca los dos, y con `exports` no hay vuelta atrás. Los cambios de clase solo se aplican con `wrangler deploy`: `wrangler versions upload` falla si hay `exports`. El backend de almacenamiento tampoco se cambia en caliente: hay que borrar la clase y crearla de nuevo.

### 3. Escribe la clase y el Worker

```ts
import { DurableObject } from "cloudflare:workers";

export class Contador extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Se ejecuta antes de atender la primera llamada
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS visitas (
           ruta TEXT PRIMARY KEY,
           total INTEGER NOT NULL
         )`
      );
    });
  }

  async sumar(ruta: string): Promise<number> {
    const { total } = this.ctx.storage.sql
      .exec(
        `INSERT INTO visitas (ruta, total) VALUES (?, 1)
         ON CONFLICT(ruta) DO UPDATE SET total = total + 1
         RETURNING total`,
        ruta
      )
      .one();

    // Una sola alarma por objeto: solo la programamos si no hay ninguna
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
    }
    return total as number;
  }

  async alarm() {
    this.ctx.storage.sql.exec("DELETE FROM visitas");
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const stub = env.CONTADOR.getByName(url.hostname);
    const total = await stub.sumar(url.pathname);
    return Response.json({ ruta: url.pathname, total });
  },
} satisfies ExportedHandler<Env>;
```

- **`getByName()`** devuelve el stub al momento; el objeto se crea en la primera llamada. Para un ID aleatorio, usa `newUniqueId()` y guárdalo como texto.
- **`stub.sumar()`** es una llamada RPC normal. Usa siempre `await`: sin él, los errores se pierden. Dos visitas simultáneas se ejecutan una detrás de otra, sin condición de carrera.
- **Las alarmas** se ejecutan al menos una vez. Si `alarm()` lanza una excepción, se reintenta con espera exponencial desde 2 segundos, hasta 6 veces.
- **Desde noviembre de 2026**, el runtime reintenta, hasta 4 veces por defecto, las llamadas que fallan *antes* de llegar al objeto. Un reintento nunca ejecuta un método dos veces.

### 4. Despliega

```bash
npx wrangler deploy
```

El primer despliegue crea el namespace y el binding.

![Panel de Durable Objects: lista de clases con su Worker, peticiones y errores (nombres tapados) y, a la derecha, el uso de la cuenta: duración, peticiones, almacenamiento SQL y filas leídas y escritas](media:blog/cloudflare-durable-objects-guia/01-panel.png)

### 5. Si necesitas WebSockets, usa la hibernación

En una sala de chat, el objeto acepta los WebSockets con `ctx.acceptWebSocket()` en lugar de `ws.accept()`. Así hiberna entre mensajes sin cortar las conexiones:

```ts
export class Sala extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const [cliente, servidor] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(servidor);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(ws: WebSocket, mensaje: string | ArrayBuffer) {
    for (const otro of this.ctx.getWebSockets()) otro.send(mensaje);
  }

  async webSocketClose(ws: WebSocket) {
    ws.close();
  }
}
```

Con `ws.accept()` pagarías duración mientras dure la conexión. Los datos de cada usuario se guardan en la conexión con `ws.serializeAttachment()` (máximo 16.384 bytes) y sobreviven a la hibernación.

### Lo mismo, como código

Con Terraform (proveedor v5), el binding y la clase van en la versión del Worker:

```hcl
resource "cloudflare_worker" "contador" {
  account_id = var.account_id
  name       = "contador"
}

resource "cloudflare_worker_version" "contador" {
  account_id         = var.account_id
  worker_id          = cloudflare_worker.contador.id
  compatibility_date = "2026-11-22"
  main_module        = "index.js"
  modules = [{
    name         = "index.js"
    content_type = "application/javascript+module"
    content_file = "dist/index.js"
  }]
  bindings = [{
    type       = "durable_object_namespace"
    name       = "CONTADOR"
    class_name = "Contador"
  }]
  migrations = {
    new_sqlite_classes = ["Contador"]
  }
}
```

La documentación avisa de que la primera vez **falla**: el binding no puede apuntar a una clase que aún no existe. Hay que aplicar sin el binding, añadirlo después y quitar `migrations`. Por eso Cloudflare recomienda dejar a Terraform solo `cloudflare_worker` y desplegar con Wrangler.

## Cómo comprobarlo

```bash
curl -s https://contador.example.com/
# {"ruta":"/","total":1}
curl -s https://contador.example.com/
# {"ruta":"/","total":2}

# Logs del Worker y del objeto en directo
npx wrangler tail contador
```

Para ver los datos, el panel tiene **Data Studio**: en **Durable Objects** eliges el namespace, pulsas **Data Studio** y escribes el nombre del objeto (aquí, el hostname). Trabaja sobre el objeto real: cada consulta se factura y queda auditada. Necesitas al menos el rol de **Editor** sobre el Worker.


La pestaña **Metrics** del namespace muestra peticiones, duración, memoria y, desde julio de 2026, el almacenamiento total. Puedes filtrar por el ID o el nombre de un objeto.


## Límites y precios

| | Workers Free | Workers Paid |
|---|---|---|
| Peticiones | 100.000/día | 1 M/mes incluido, luego 0,15 $/M |
| Duración | 13.000 GB-s/día | 400.000 GB-s/mes, luego 12,50 $/M GB-s |
| Filas leídas (SQLite) | 5 M/día | 25.000 M/mes, luego 0,001 $/M |
| Filas escritas (SQLite) | 100.000/día | 50 M/mes, luego 1,00 $/M |
| Almacenamiento | 5 GB en total | 5 GB-mes, luego 0,20 $/GB-mes |
| Clases por cuenta | 100 | 500 |

- **Las peticiones** incluyen HTTP, sesiones RPC, mensajes de WebSocket y alarmas. Los mensajes entrantes de WebSocket cuentan 20 a 1.
- **La duración** es tiempo de reloj sobre los 128 MB de cada objeto. Un segundo activo son 0,125 GB-s: los 13.000 GB-s diarios de Free dan para unas 29 horas de objeto activo al día, entre todos.
- **Cada `setAlarm()`** y cada borrado cuentan como fila escrita.
- En Free, los límites se reinician a las 00:00 UTC. Si te pasas, esas operaciones fallan hasta el día siguiente.
- Para todos: objetos ilimitados, 10 GB por objeto en Paid, 8 MB por fila o valor, 100 columnas por tabla y 30 segundos de CPU por petición (ampliable a 5 minutos con `limits.cpu_ms`).
- Cada objeto aguanta unas 1.000 peticiones por segundo. Si necesitas más, reparte la carga: uno por usuario en vez de uno global.
- El almacenamiento SQLite se factura desde enero de 2026.

**Límite de gasto.** En **Billing › Spend Management**, Durable Objects tiene una fila propia, separada de la de Workers. Al alcanzar el límite, Cloudflare bloquea las operaciones hasta el siguiente periodo, pero el almacenamiento se sigue cobrando.


## Documentación oficial

- [Qué son los Durable Objects](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/), [primeros pasos](https://developers.cloudflare.com/durable-objects/get-started/) y [buenas prácticas](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Namespace: getByName, idFromName, newUniqueId](https://developers.cloudflare.com/durable-objects/api/namespace/) y [llamadas RPC](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/)
- [API de almacenamiento SQLite](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) y [alarmas](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [WebSockets e hibernación](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) y [ciclo de vida](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
- [Location hints y jurisdicciones](https://developers.cloudflare.com/durable-objects/reference/data-location/) y [Data Studio](https://developers.cloudflare.com/durable-objects/observability/data-studio/)
- [Clases con `exports`](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/) y [migraciones antiguas](https://developers.cloudflare.com/durable-objects/reference/durable-object-class-migrations-legacy/)
- [Límites](https://developers.cloudflare.com/durable-objects/platform/limits/), [precios](https://developers.cloudflare.com/durable-objects/platform/pricing/) y [límites de gasto](https://developers.cloudflare.com/billing/manage/spend-management/)
- [Terraform y Durable Objects](https://developers.cloudflare.com/workers/platform/infrastructure-as-code/)
- Changelog: [namespaces nuevos solo con SQLite](https://developers.cloudflare.com/changelog/post/2026-07-09-restrict-new-kv-backed-namespaces/), [clases declarativas con `exports`](https://developers.cloudflare.com/changelog/post/2026-06-30-declarative-do-class-exports/), [jurisdicción `us`](https://developers.cloudflare.com/changelog/post/2026-06-26-durable-objects-us-jurisdiction/) y [reintentos automáticos](https://developers.cloudflare.com/changelog/post/2026-11-05-durable-objects-automatic-retries/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Queues: tareas en segundo plano.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [Rate limiting en Cloudflare: limitar peticiones sin bloquear a tus usuarios](/blog/cloudflare-rate-limiting-guia)
