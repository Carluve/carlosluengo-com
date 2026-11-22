---
publishDate: 2026-05-19T09:00:00Z
draft: false
image: 'media:blog/cloudflare-workflows-guia/portada.png'
title: 'Workflows: procesos duraderos paso a paso'
excerpt: 'Serie Cloudflare, parte 20. Qué es Cloudflare Workflows, cómo se escribe un proceso con step.do, step.sleep y step.waitForEvent, cómo se reintenta un paso que falla, cómo se lanza una instancia desde un Worker, Wrangler o la API, qué cabe en Workers Free y cuándo usar Queues o Durable Objects en su lugar.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'workflows'
  - 'workers'
  - 'serverless'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 20 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Un [Worker](/blog/cloudflare-workers-guia) responde a una petición y termina. Pero cobrar, esperar una aprobación y mandar un correo tres días después no cabe en una petición. Y si algo falla a mitad, no quieres cobrar dos veces. Para eso está Workflows.

## Qué es

Workflows es el motor de **ejecución duradera** de Cloudflare. Escribes un proceso como una lista de pasos dentro de un Worker, y Cloudflare guarda el resultado de cada paso. Si un paso falla, se reintenta solo. Si el proceso se interrumpe, continúa desde el último paso completado.

Las piezas:

- **`WorkflowEntrypoint`**: la clase del proceso. Su método `run(event, step)` contiene los pasos.
- **`step.do(nombre, fn)`**: un paso. Lo que devuelve se guarda y no se vuelve a ejecutar.
- **`step.sleep` y `step.sleepUntil`**: pausas de hasta un año, sin consumir CPU.
- **`step.waitForEvent`**: espera a un evento externo, como una aprobación o un webhook.
- **Instancia**: cada ejecución, con su ID, sus parámetros y su estado.

**Planes.** Workflows está incluido en **Workers Free** y en **Workers Paid**. No depende del plan de tu zona.

## Casos de uso

- **Altas de clientes (*onboarding*).** Crear la cuenta, mandar la bienvenida, esperar siete días y enviar un recordatorio si no ha completado el perfil.
- **Pedidos.** Reservar stock, esperar la aprobación de un pedido grande, cobrar y, si el cobro falla, liberar la reserva.
- **Cadenas de IA.** Trocear un documento, generar *embeddings* con Workers AI y guardarlos en Vectorize. Cada llamada es un paso con sus propios reintentos.
- **Tareas programadas largas.** Un Workflow puede lanzarse con una expresión cron, sin un *handler* `scheduled` aparte.

## Arquitectura

![Ciclo de vida de una instancia: se crea, espera en cola, ejecuta pasos que guardan su resultado y se reintentan, duerme o espera un evento sin ocupar concurrencia y termina completada o con error; debajo, límites de Workers Free y Paid](media:blog/cloudflare-workflows-guia/00-arquitectura.png)

1. Un Worker, Wrangler, la API REST o un cron **crea una instancia**.
2. La instancia entra en **`queued`** y pasa a **`running`** cuando hay hueco de concurrencia.
3. Cada **`step.do`** se ejecuta y su resultado se guarda. Si falla, se reintenta.
4. En un **`step.sleep`** o un **`step.waitForEvent`**, la instancia pasa a **`waiting`** y deja de contar para la concurrencia.
5. Al despertar, el motor vuelve a ejecutar `run()` desde el principio, pero **los pasos completados devuelven su resultado guardado** sin ejecutarse otra vez.
6. La instancia termina en **`complete`**, **`errored`** o **`terminated`**.

El punto 5 explica las reglas que hay que respetar:

- **Todo efecto va dentro de un `step.do`.** El código de fuera puede ejecutarse varias veces.
- **Pasos idempotentes.** Un paso se puede reintentar: antes de cobrar, comprueba si ya cobraste.
- **Nombres deterministas.** Nada de `Date.now()` ni valores aleatorios en el nombre del paso.
- **El estado se guarda devolviéndolo** desde el paso. `event.payload` es inmutable.

## Implementación paso a paso

Las capturas son de mi cuenta, en tema claro, con los nombres de los Workflows tapados. El código del texto es un pedido inventado.

### 1. Mira la página de Workflows

En el panel, la página **Workflows** está a nivel de cuenta, junto a Workers. Ahí verás cada Workflow, sus métricas y sus instancias.

![Create Workflow: empezar conectando GitHub o GitLab, o con la plantilla Workflows starter template](media:blog/cloudflare-workflows-guia/01-crear.png)

Una vez desplegados, el panel lista cada Workflow con sus instancias por estado, y el uso de la cuenta en pasos, reintentos y tiempo de CPU:

![Panel de Workflows: lista de Workflows con instancias inactivas, en ejecución y terminadas (nombres tapados), uso de la cuenta y retención de 30 días para instancias correctas y con error](media:blog/cloudflare-workflows-guia/02-panel.png)

### 2. Crea el proyecto

```bash
npm create cloudflare@latest workflows-starter -- --template "cloudflare/workflows-starter"
```

Un Workflow vive dentro de un Worker. En `wrangler.jsonc` se declara con un *binding*:

```jsonc
{
  "name": "pedidos",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-22",
  "workflows": [
    {
      "name": "pedido",
      "binding": "PEDIDO",
      "class_name": "PedidoWorkflow"
    }
  ]
}
```

Con `npx wrangler types` obtienes el tipo `Env` con `PEDIDO` incluido.

### 3. Escribe los pasos

Un pedido que reserva stock, espera aprobación si supera 500 €, cobra con reintentos y pide una reseña tres días después:

```ts
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

type Pedido = { pedidoId: string; email: string; importe: number };

export class PedidoWorkflow extends WorkflowEntrypoint<Env, Pedido> {
  async run(event: WorkflowEvent<Pedido>, step: WorkflowStep) {
    const { pedidoId, importe } = event.payload;

    const reserva = await step.do("reservar stock", async () => {
      const r = await fetch(`https://api.example.com/stock/${pedidoId}`, { method: "POST" });
      if (r.status === 409) throw new NonRetryableError("Sin stock");
      if (!r.ok) throw new Error(`Stock respondió ${r.status}`);
      return await r.json<{ reservaId: string }>();
    });

    if (importe > 500) {
      const evento = await step.waitForEvent("esperar aprobación", {
        type: "aprobacion",
        timeout: "2 days",
      });
      const { aprobado } = evento.payload as { aprobado: boolean };
      if (!aprobado) return { estado: "rechazado" };
    }

    await step.do(
      "cobrar",
      { retries: { limit: 3, delay: "30 seconds", backoff: "exponential" }, timeout: "5 minutes" },
      async () => {
        // Llama a tu pasarela con pedidoId como clave de idempotencia
      },
    );

    await step.sleep("esperar 3 días", "3 days");

    await step.do("pedir reseña", async () => {
      // Envía el correo
    });

    return { estado: "completado", reservaId: reserva.reservaId };
  }
}
```

Lo importante:

- **Reintentos por defecto**: 5, con 10 segundos de espera inicial, *backoff* exponencial y 10 minutos de *timeout* por intento. El *backoff* puede ser `constant`, `linear` o `exponential`.
- **`NonRetryableError`** corta los reintentos y hace fallar la instancia. Es para errores definitivos, como un 409.
- **`waitForEvent`** espera 24 horas por defecto (de 1 segundo a 365 días). Si vence, lanza un error y la instancia falla; usa `try...catch` para seguir. El `type` solo admite letras, números, `-` y `_`.
- Un paso puede registrar un ***rollback*** que deshace lo hecho si la instancia falla después (patrón *saga*); por ejemplo, liberar la reserva.

### 4. Lanza instancias desde el Worker

En el mismo fichero, el *handler* `fetch` crea la instancia y recibe la aprobación:

```ts
export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);

    if (url.pathname === "/pedido" && req.method === "POST") {
      const pedido = await req.json<Pedido>();
      const instancia = await env.PEDIDO.create({ id: pedido.pedidoId, params: pedido });
      return Response.json({ id: instancia.id, estado: await instancia.status() });
    }

    if (url.pathname === "/aprobar" && req.method === "POST") {
      const instancia = await env.PEDIDO.get(url.searchParams.get("id")!);
      await instancia.sendEvent({ type: "aprobacion", payload: { aprobado: true } });
      return Response.json({ ok: true });
    }

    return new Response("No encontrado", { status: 404 });
  },
};
```

Usar el ID del pedido como ID de instancia evita duplicados: `create()` falla si ese ID ya existe. Un evento enviado **antes** de llegar a `waitForEvent` no se pierde: queda guardado hasta que la instancia lo recoja. `createBatch()` crea hasta 100 instancias por llamada.

Despliega con `npx wrangler deploy`. En el panel, el Workflow muestra un **diagrama generado a partir del código** (en beta para JavaScript y TypeScript).


### 5. Lánzalo también desde Wrangler o la API

```bash
npx wrangler workflows trigger pedido '{"pedidoId":"A-1001","email":"cliente@example.com","importe":800}'
npx wrangler workflows instances send-event pedido latest --type aprobacion --payload '{"aprobado":true}'
```

Con la API, el evento de aprobación es un `POST` con el *payload* como cuerpo:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workflows/pedido/instances/A-1001/events/aprobacion" \
  -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" --data '{"aprobado":true}'
```

Las instancias se crean con `POST /accounts/{account_id}/workflows/{workflow_name}/instances`. El token necesita *Workers Scripts Write*, que permite modificar todos los Workers de la cuenta: crea uno dedicado.

También puedes lanzar una instancia desde el propio panel, con los parámetros en JSON.


### 6. Ajusta cada Workflow

En el mismo bloque de `wrangler.jsonc` puedes añadir:

- **`concurrency.limit`** (desde noviembre de 2026): máximo de instancias de este Workflow a la vez. Protege una base de datos o una API externa.
- **`schedules`**: expresiones cron, por ejemplo `["0 * * * *"]`.
- **`default_retention`**: cuánto se guarda el estado de las instancias terminadas.
- **`jurisdiction`**: `eu`, `us` o `fedramp`. Se fija al crear el Workflow y no se puede cambiar.
- **`limits.steps`** y **`limits.cpu_ms`**, para subir pasos y CPU en Workers Paid.

### Lo mismo, como código

El proveedor de Terraform (v5, desde la 5.11.0) tiene el recurso `cloudflare_workflow`. Registra el Workflow sobre un Worker ya subido:

```hcl
resource "cloudflare_workers_script" "pedidos" {
  account_id     = var.account_id
  script_name    = "pedidos"
  content_file   = "${path.module}/dist/index.js"
  content_sha256 = filesha256("${path.module}/dist/index.js")
  main_module    = "index.js"
}

resource "cloudflare_workflow" "pedido" {
  account_id    = var.account_id
  workflow_name = "pedido"
  class_name    = "PedidoWorkflow"
  script_name   = cloudflare_workers_script.pedidos.script_name
}
```

Si usas Wrangler, `wrangler deploy` ya crea o actualiza el Workflow.

## Cómo comprobarlo

```bash
npx wrangler workflows instances list pedido
npx wrangler workflows instances describe pedido latest
```

`describe` muestra cada paso con su salida, reintentos y errores, y cuándo despierta si está dormido. Desde código, `instance.status()` devuelve el estado, la salida y el error. Desde septiembre de 2026, `instance.subscribe()` emite los eventos de la instancia en directo, sin sondear.


Las métricas están en la página de cada Workflow y en el dataset `workflowsAdaptiveGroups` de la API GraphQL (31 días). Para una instancia atascada tienes `pause`, `resume`, `terminate` y `restart`, desde código o con Wrangler. `restart` puede empezar desde un paso concreto.

## Límites y precios

| | Workers Free | Workers Paid |
|---|---|---|
| CPU por paso | 10 ms | 30 s (configurable hasta 5 min) |
| Pasos por instancia | 1.024 | 10.000 (configurable hasta 25.000) |
| Instancias en ejecución (cuenta) | 100 | 50.000 |
| Creación de instancias | 100/s | 300/s por cuenta, 100/s por Workflow |
| Instancias en cola | 100.000 | 2.000.000 |
| Estado por instancia | 100 MB | 1 GB |
| Retención de instancias terminadas | 3 días | 7 días (hasta 30) |
| Pasos incluidos | 3.000 al día | 500.000 al mes, luego 0,80 $ / 100.000 |
| Almacenamiento incluido | 1 GB-mes | 1 GB-mes, luego 0,20 $ / GB-mes |

- **En los dos planes**: 1 MiB por resultado de paso y por evento, y `step.sleep` de hasta 365 días.
- **Esperar no consume CPU.** Un paso no tiene límite de tiempo real; solo cuenta la CPU.
- **Peticiones y CPU** se cobran como en Workers: en Paid, 10 millones de invocaciones y 30 millones de ms de CPU al mes incluidos. Cada instancia creada es una invocación; los pasos no.
- **Pasos y almacenamiento** se facturan desde el 10 de agosto de 2026. Los reintentos y los *rollbacks* no cuentan como pasos.
- Workflows no funciona en Workers for Platforms.

**¿Workflows, Queues o Durable Objects?**

- **Queues**: mensajes sueltos y picos de carga. Cada invocación del consumidor tiene 15 minutos de tiempo real. El consumidor puede crear un Workflow por mensaje.
- **Durable Objects**: estado compartido y coordinación en tiempo real (un chat, WebSockets). Tienen alarmas, pero los reintentos por pasos los montas tú.
- **Workflows**: un proceso con principio y fin, varios pasos, esperas largas y reintentos.

## Documentación oficial

- [Workflows: visión general](https://developers.cloudflare.com/workflows/) y [primeros pasos](https://developers.cloudflare.com/workflows/get-started/guide/)
- [Workers API](https://developers.cloudflare.com/workflows/build/workers-api/) y [reglas de Workflows](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)
- [Sleep y reintentos](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/) y [eventos y parámetros](https://developers.cloudflare.com/workflows/build/events-and-parameters/)
- [Lanzar Workflows](https://developers.cloudflare.com/workflows/build/trigger-workflows/), [comandos de Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/workflows/) y [API REST](https://developers.cloudflare.com/api/resources/workflows/subresources/instances/methods/create/)
- [Métricas](https://developers.cloudflare.com/workflows/observability/metrics-analytics/) y [suscribirse a eventos de una instancia](https://developers.cloudflare.com/workflows/build/subscribe-to-instance-events/)
- [Límites](https://developers.cloudflare.com/workflows/reference/limits/) y [precios](https://developers.cloudflare.com/workflows/reference/pricing/)
- [Changelog de Workflows](https://developers.cloudflare.com/changelog/product/workflows/): [facturación de pasos](https://developers.cloudflare.com/changelog/post/2026-07-07-workflows-billing-updates/), [retención de 7 días en Paid](https://developers.cloudflare.com/changelog/post/2026-09-10-paid-retention-default/), [jurisdicciones](https://developers.cloudflare.com/changelog/post/2026-10-27-workflow-jurisdictions/) y [concurrencia por Workflow](https://developers.cloudflare.com/changelog/post/2026-11-10-per-workflow-concurrency-limits/)
- [Terraform: recurso `cloudflare_workflow`](https://developers.cloudflare.com/changelog/post/2025-10-09-workflows-terraform/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Hyperdrive: tu base de datos de siempre, más rápida.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
