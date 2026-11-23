---
publishDate: 2026-11-24T09:00:00Z
draft: false
image: 'media:blog/cloudflare-agents-sdk-guia/portada.png'
title: 'Agents SDK: agentes con estado'
excerpt: 'Serie Cloudflare, parte 47. Qué es el Agents SDK de Cloudflare, cómo un Agent vive en un Durable Object con estado sincronizado, métodos callable, tareas programadas y WebSockets, cómo montar un chat con AIChatAgent y aprobación humana, cómo exponer un servidor MCP y qué cuesta.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'agents'
  - 'ia'
  - 'durable objects'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 47 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Un agente que lo olvida todo tras cada petición es solo una función. Para recordar, programar tareas y hablar con varios clientes necesita estado. En Cloudflare, el estado vive en los [Durable Objects](/blog/cloudflare-durable-objects-guia). El Agents SDK los envuelve en una clase pensada para agentes.

## Qué es

El Agents SDK es un paquete de npm (`agents`) para escribir agentes sobre [Workers](/blog/cloudflare-workers-guia). Su pieza central es la clase `Agent`: un Durable Object con utilidades ya montadas. Cada instancia tiene un nombre único y su propio SQLite. Trae:

- **Estado sincronizado.** `this.setState()` guarda un valor JSON y lo envía a todos los clientes conectados.
- **Métodos *callable*.** Con `@callable()`, el cliente invoca el método por WebSocket como una función local.
- **Tareas programadas.** `this.schedule()` ejecuta un método tras X segundos, en una fecha o con cron.
- **WebSockets con hibernación** y **SQL** con `this.sql`.

Además están `AIChatAgent` (`@cloudflare/ai-chat`), para chats con aprobación humana, y las utilidades MCP. El SDK cambia rápido (la 0.34.0 es del 20 de noviembre de 2026): fija versiones.

## Casos de uso

- **Un asistente por usuario**, con su historial y sus preferencias.
- **Recordatorios y tareas periódicas** sin cron externo.
- **Acciones con confirmación**: el modelo propone, una persona aprueba.
- **Herramientas MCP** para otros agentes o tu IDE.

## Arquitectura

![Clientes (navegador, HTTP, MCP) llegan a un Worker que autentica y enruta con routeAgentRequest a una instancia del agente: un Durable Object con estado sincronizado, callable, schedule, SQLite y WebSockets; debajo, tabla de piezas del SDK](media:blog/cloudflare-agents-sdk-guia/00-arquitectura.png)

1. El cliente abre un WebSocket o hace una petición HTTP a `/agents/:binding/:nombre`.
2. Tu Worker llama a `routeAgentRequest()`. Los *hooks* `onBeforeConnect` y `onBeforeRequest` pueden rechazarla antes, sin despertar al agente.
3. `:binding` es el nombre del binding en kebab-case (`TareasAgent` → `tareas-agent`). `:nombre` elige la instancia.
4. Cuando la instancia cambia el estado, este se guarda y se envía a todos los clientes.
5. Sin actividad, la instancia hiberna. Al despertar, el constructor vuelve a ejecutarse: guarda lo importante en `this.state`, `connection.state` o SQLite, nunca en propiedades de la clase.

## Implementación paso a paso

Vas a montar un agente de tareas: guarda una lista, la sincroniza con el navegador y avisa a la hora pedida.

### 1. Crea el proyecto

```bash
npm create cloudflare@latest tareas-agent
# Plantilla "Hello World" Worker, TypeScript
cd tareas-agent
npm install agents
```

En `tsconfig.json`, extiende `agents/tsconfig`. **No actives `experimentalDecorators`**: rompe `@callable()` sin avisar.

### 2. Declara el agente en wrangler.jsonc

```jsonc
{
  "name": "tareas-agent",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-23",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": {
    "bindings": [{ "name": "TareasAgent", "class_name": "TareasAgent" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["TareasAgent"] }],
  "observability": { "enabled": true, "traces": { "enabled": true } }
}
```

`new_sqlite_classes` usa almacenamiento SQLite, el único en Free. `traces` activa el trazado del paso 5. Genera el tipo `Env` con `npx wrangler types`.

### 3. Escribe el agente

En `src/agente.ts`, los clientes leen el estado y solo el servidor lo cambia. Cualquier cliente conectado puede invocar un `@callable()`, así que hay que validar sus argumentos.

```ts
import { Agent, callable } from "agents";

type Tarea = { id: string; texto: string; hecha: boolean };
type Estado = { tareas: Tarea[] };

const MAX_TAREAS = 100;

export class TareasAgent extends Agent<Env, Estado> {
  initialState: Estado = { tareas: [] };

  // Rechaza setState() desde clientes.
  validateStateChange(_next: Estado, source: unknown) {
    if (source !== "server") throw new Error("Estado de solo lectura");
  }

  @callable()
  anadir(texto: unknown): Tarea {
    if (typeof texto !== "string" || !texto.trim() || texto.length > 200) {
      throw new Error("texto: entre 1 y 200 caracteres");
    }
    if (this.state.tareas.length >= MAX_TAREAS) throw new Error("Lista llena");
    const tarea = { id: crypto.randomUUID(), texto: texto.trim(), hecha: false };
    this.setState({ tareas: [...this.state.tareas, tarea] });
    return tarea;
  }

  @callable()
  async recordar(id: unknown, minutos: unknown): Promise<string> {
    if (typeof id !== "string" || !this.state.tareas.some((t) => t.id === id)) {
      throw new Error("id desconocido");
    }
    if (!Number.isInteger(minutos) || (minutos as number) < 1 || (minutos as number) > 1440) {
      throw new Error("minutos: entero entre 1 y 1440");
    }
    const programada = await this.schedule((minutos as number) * 60, "aviso", { id });
    return programada.id;
  }

  // La llama el planificador.
  async aviso(payload: unknown) {
    const id = (payload as { id?: unknown } | null)?.id;
    const tarea = this.state.tareas.find((t) => t.id === id);
    if (!tarea || tarea.hecha) return;
    this.broadcast(JSON.stringify({ tipo: "aviso", tarea }));
  }

  // GET: lista. POST {"texto": "..."}: añade.
  async onRequest(req: Request): Promise<Response> {
    if (req.method === "GET") return Response.json(this.state);
    if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "JSON no válido" }, { status: 400 });
    }
    try {
      const tarea = this.anadir((body as { texto?: unknown } | null)?.texto);
      return Response.json(tarea, { status: 201 });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  }
}
```

- `validateStateChange` es síncrono y se ejecuta antes de guardar: si lanza, el cambio se descarta. Si un `@callable()` lanza, la promesa del cliente se rechaza con el mensaje.
- Un reintento o un desalojo pueden ejecutar `aviso` dos veces. Haz idempotentes los efectos externos.

### 4. Autentica en el Worker

El Worker va en `src/index.ts`. El token es un secreto: guárdalo con `npx wrangler secret put API_TOKEN`, nunca en el código.

```ts
import { routeAgentRequest } from "agents";
export { TareasAgent } from "./agente";

const enc = new TextEncoder();

function autorizado(req: Request, env: Env): boolean {
  const cabecera = req.headers.get("Authorization");
  // Un navegador no puede poner cabeceras al abrir un WebSocket: acepta ?token=
  const token = cabecera?.startsWith("Bearer ")
    ? cabecera.slice(7)
    : new URL(req.url).searchParams.get("token");
  if (!token || !env.API_TOKEN) return false;
  const a = enc.encode(token);
  const b = enc.encode(env.API_TOKEN);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(req, env): Promise<Response> {
    const comprobar = async (r: Request) =>
      autorizado(r, env) ? undefined : new Response("No autorizado", { status: 401 });

    return (
      (await routeAgentRequest(req, env, {
        onBeforeConnect: comprobar,
        onBeforeRequest: comprobar,
      })) ?? new Response("No encontrado", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
```

Un token compartido vale para una demo. En producción, valida la sesión (o pon [Access](/blog/cloudflare-access-guia) delante) y comprueba que el `name` de la ruta (segundo argumento del *hook*) corresponde al usuario. Un token en la URL puede acabar en los logs; es mejor una cookie.

En React, `useAgent<TareasAgent>({ agent: "tareas-agent", name: "demo", query: { token } })` (de `agents/react`) da `agent.state` sincronizado y `agent.stub.anadir()` tipado.

### 5. Despliega

```bash
npx wrangler deploy
```

Con `traces` activado, la página **Agents** del panel permite repetir sesiones y ver la cascada de cada ejecución. Las llamadas directas al AI SDK se envuelven con `wrapAISDK()`.

En los ajustes del Worker verás el binding y el secreto, cifrado.

### 6. Un chat con IA y aprobación humana

`AIChatAgent` guarda la conversación en SQLite y reanuda la respuesta si el cliente se desconecta a mitad. Instala `@cloudflare/ai-chat ai @ai-sdk/provider zod`, añade `"ai": { "binding": "AI" }` y la clase `Asistente` con su binding y una migración `v2`.

```ts
import { AIChatAgent } from "@cloudflare/ai-chat";
import { createAI } from "agents/models/ai-sdk";
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { z } from "zod";

export class Asistente extends AIChatAgent<Env> {
  maxPersistedMessages = 200;

  async onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS notas (id TEXT PRIMARY KEY, texto TEXT)`;
  }

  async onChatMessage() {
    const ai = createAI({ binding: this.env.AI });
    const result = streamText({
      model: ai("@cf/zai-org/glm-4.7-flash"),
      messages: await convertToModelMessages(this.messages),
      tools: {
        borrarNota: tool({
          description: "Borra una nota por su id",
          inputSchema: z.object({ id: z.string().uuid() }),
          needsApproval: async () => true, // siempre pide confirmación
          execute: async ({ id }) => {
            this.sql`DELETE FROM notas WHERE id = ${id}`;
            return { borrada: id };
          },
        }),
      },
      stopWhen: stepCountIs(5),
    });
    return result.toUIMessageStreamResponse();
  }
}
```

Zod valida los argumentos que propone el modelo. En el cliente, `useAgentChat` (de `@cloudflare/ai-chat/react`) muestra la llamada pendiente y tus botones llaman a `addToolApprovalResponse({ id, approved })` con el id de `getToolApproval(part)`. `needsApproval` también acepta una condición (por ejemplo, un importe).

Hay otros dos patrones. En un Workflow, `this.waitForApproval(step, { timeout: "7 days" })` pausa hasta `approveWorkflow()` o `rejectWorkflow()`, como `step.waitForEvent` en [Workflows](/blog/cloudflare-workflows-guia). Si vence el plazo, devuelve un valor falso: contempla ese caso. En MCP, la *elicitation* pide datos o una autorización al usuario.

### 7. Un servidor MCP

`McpAgent` está obsoleto y solo queda para servidores antiguos. Lo nuevo es `createMcpHandler`, sin estado: un servidor por petición.

```bash
npm install agents @modelcontextprotocol/server@2.3.1 zod
```

```ts
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function crearServidor() {
  const server = new McpServer({ name: "utilidades", version: "1.0.0" });
  server.registerTool(
    "slug",
    {
      description: "Convierte un título en un slug para URL",
      inputSchema: z.object({ titulo: z.string().min(1).max(200) }),
    },
    async ({ titulo }) => ({
      content: [{ type: "text", text: titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-") }],
    }),
  );
  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(crearServidor)(request, env, ctx);
  },
} satisfies ExportedHandler;
```

Responde en `/mcp` y solo acepta localhost y `workers.dev`, salvo que añadas tu dominio en `allowedHostnames`. No verifica tokens: para OAuth, envuélvelo con `OAuthResourceServer` de `@cloudflare/workers-oauth-provider` y lee la identidad con `getMcpAuthContext()`. El estado entre peticiones se guarda en un agente, [D1](/blog/cloudflare-d1-guia) o [KV](/blog/cloudflare-kv-guia).

### Lo mismo, como código

En este servicio todo es código desde el principio (clase, Worker y `wrangler.jsonc`) y se despliega con Wrangler.

## Cómo comprobarlo

```bash
URL=https://tareas-agent.<tu-subdominio>.workers.dev/agents/tareas-agent/demo

# Sin token: 401
curl -i "$URL"

# Añadir una tarea: 201
curl -i -X POST "$URL" -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" -d '{"texto":"Renovar el dominio"}'

# Texto vacío: 400
curl -i -X POST "$URL" -H "Authorization: Bearer $API_TOKEN" -d '{"texto":""}'

npx wrangler tail   # logs en directo
```

Con dos pestañas abiertas, lo que añades en una aparece en la otra. Si pides al asistente que borre una nota, debe esperar tu aprobación.

## Límites y precios

Un agente se factura como un Durable Object, más el Worker que enruta. El modelo se paga aparte, por tokens.

| | Workers Free | Workers Paid |
|---|---|---|
| Peticiones a Durable Objects | 100.000 al día | 1 millón al mes, luego 0,15 $ / millón |
| Duración | 13.000 GB-s al día | 400.000 GB-s al mes, luego 12,50 $ / millón de GB-s |
| Filas leídas (SQLite) | 5 millones al día | 25.000 millones al mes, luego 0,001 $ / millón |
| Filas escritas (SQLite) | 100.000 al día | 50 millones al mes, luego 1,00 $ / millón |
| Almacenamiento | 5 GB en total | 5 GB-mes, luego 0,20 $ / GB-mes |

- **WebSockets**: los mensajes entrantes cuentan 20:1 (100 mensajes, 5 peticiones); los salientes son gratis.
- **Por agente**: 1 GB de estado y 30 segundos de CPU, renovados con cada petición, mensaje o tarea programada. Esperar a un LLM no tiene límite.
- **Tareas programadas**: payload JSON; cron con precisión de minuto. Un callback que falla se reintenta; por defecto, hasta 3 intentos. Las tareas con retraso o fecha no son idempotentes: cada llamada añade otra tarea salvo que pases `{ idempotent: true }`.

## Documentación oficial

- [Agents: visión general](https://developers.cloudflare.com/agents/) y [la clase Agent](https://developers.cloudflare.com/agents/agent-class/)
- [Estado](https://developers.cloudflare.com/agents/agent-class/state/), [callable](https://developers.cloudflare.com/agents/agent-class/callable-methods/), [tareas programadas](https://developers.cloudflare.com/agents/runtime/capabilities/scheduler/) y [WebSockets](https://developers.cloudflare.com/agents/agent-class/websockets/)
- [Enrutado](https://developers.cloudflare.com/agents/runtime/routing/) y [autenticación](https://developers.cloudflare.com/agents/runtime/routing/authentication/)
- [Chat agents](https://developers.cloudflare.com/agents/agent-class/communication-channels/chat/chat-agents/) y [human in the loop](https://developers.cloudflare.com/agents/concepts/agentic-patterns/human-in-the-loop/)
- [Servidor MCP con createMcpHandler](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/)
- [Límites de Agents](https://developers.cloudflare.com/agents/platform/limits/), [precios de Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/) y [changelog](https://developers.cloudflare.com/changelog/product/agents/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Basin: Pipelines, Catalog y SQL.

## También te puede interesar

- [Durable Objects: estado y coordinación en el borde](/blog/cloudflare-durable-objects-guia)
- [Workflows: procesos duraderos paso a paso](/blog/cloudflare-workflows-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
