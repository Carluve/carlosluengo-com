---
publishDate: 2026-10-27T09:00:00Z
draft: false
image: 'media:blog/cloudflare-workers-ai-guia/portada.png'
title: 'Workers AI: modelos en las GPU de Cloudflare'
excerpt: 'Serie Cloudflare, parte 43. Qué es Workers AI, cómo llamar a un modelo desde un Worker con env.AI.run o desde fuera con la API REST, cómo hacer streaming, lotes y LoRA, cuánto cuesta en neuronas, qué te da gratis cada día y qué pasa con tus datos.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'workers ai'
  - 'inteligencia artificial'
  - 'llm'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 43 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Ya ejecutas código en el borde con [Workers](/blog/cloudflare-workers-guia) y procesos largos con [Workflows](/blog/cloudflare-workflows-guia). Te falta un modelo de IA. Workers AI te lo da sin alquilar GPU.

## Qué es

Workers AI ejecuta modelos abiertos en GPU de la red de Cloudflare. Eliges un modelo del catálogo, le mandas una entrada y pagas por uso. No despliegas ni escalas nada. Tres ideas:

- **El catálogo.** Modelos de texto (LLM), *embeddings*, clasificación, traducción, imagen, voz a texto y texto a voz. Cada modelo tiene un ID como `@cf/google/gemma-4-26b-a4b-it` y una ficha con su ventana de contexto, sus capacidades (*function calling*, visión, lotes, LoRA) y su precio.
- **Dos formas de llamarlo.** Desde un Worker, con el *binding* `env.AI.run()`, sin claves. Desde cualquier otro sitio, con la API REST y un token.
- **Neuronas.** Es la unidad de facturación. Cada modelo publica su precio en tokens (o en minutos de audio, o en imágenes) y su equivalencia en neuronas.

El catálogo cambia rápido. El 20 de noviembre de 2026 se retiraron 24 modelos, entre ellos varios Llama 3.2 y los LoRA de Gemma y Llama 2. Las peticiones a un modelo retirado devuelven `410 Gone` con el código de error 5028. Antes de copiar un ID de un tutorial antiguo, mira su ficha.

## Casos de uso

- **Resumir o clasificar texto** que ya pasa por tu Worker: tickets, reseñas, correos entrantes.
- **Búsqueda semántica.** Generas *embeddings* con un modelo como `@cf/baai/bge-m3` y los guardas en un índice vectorial.
- **Un chat o un asistente** con respuesta en *streaming*, para que el usuario vea el texto según se genera.
- **Procesos en segundo plano.** Cientos de peticiones que no corren prisa, enviadas en lote desde una cola o un Workflow.

## Arquitectura

![Flujo de Workers AI: el cliente llama a tu Worker o a la API REST; ambos llegan a Workers AI, que elige el modelo del catálogo y lo ejecuta en GPU de Cloudflare; opcionalmente pasa por AI Gateway; debajo, tabla con los modos síncrono, streaming y lote](media:blog/cloudflare-workers-ai-guia/00-arquitectura.png)

1. La petición llega a **tu Worker**, que valida la entrada y llama a `env.AI.run(modelo, entrada, opciones)`. O llega directamente a la **API REST** (`/accounts/{account_id}/ai/run/{modelo}`) con un token.
2. Opcionalmente pasa por **AI Gateway**, que añade registros, caché, límites de gasto y reintentos. Basta con indicar el ID del *gateway* en el tercer argumento.
3. Workers AI ejecuta el modelo en una **GPU de Cloudflare** y devuelve la respuesta de una de tres formas:
   - **Síncrona**: esperas la respuesta completa.
   - **Streaming**: con `stream: true` recibes *server-sent events* según se generan los tokens.
   - **Lote**: con `queueRequest: true` la petición se encola, recibes un `request_id` y consultas el resultado más tarde.

Si un modelo está saturado, la petición síncrona espera en una cola de capacidad. Desde septiembre de 2026 puedes pasar `rejectIfBusy: true` para que falle en lugar de esperar.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Abre Workers AI en el panel

Workers AI es un servicio de **cuenta**, no de zona. Está en **AI › Workers AI**. **Use REST API** te lleva al asistente para crear un token y copiar el ID de cuenta.

![Catálogo Models del panel: buscador y filtros por tipo de tarea, capacidades, autor y proveedor, con tarjetas de cada modelo](media:blog/cloudflare-workers-ai-guia/01-panel.png)

**Create a Workers AI API Token** abre el formulario de tokens con una plantilla ya rellena. Si creas el token a mano, necesita los permisos **Workers AI - Read** y **Workers AI - Edit**. Guárdalo como secreto, nunca en el código.

### 2. Crea un Worker con el binding

El atajo del panel es **Workers & Pages › Create application** con la plantilla **LLM Chat App**. Despliega un chat completo con el binding ya configurado.

Con Wrangler, el binding es una línea en `wrangler.jsonc`. Solo puede haber **un** binding de IA por Worker:

```jsonc
{
  "name": "resumidor",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-23",
  "ai": { "binding": "AI" }
}
```

Ojo: `wrangler dev` también usa tu cuenta para ejecutar los modelos. Lo que pruebes en local consume neuronas y cuenta para los límites.

### 3. Un endpoint que valida antes de gastar

Este Worker recibe `{ "texto": "...", "stream": false }` y devuelve un resumen. Rechaza la entrada mala **antes** de llamar al modelo, que es lo que cuesta dinero.

```ts
interface Env {
  AI: Ai;
}

const MODELO = "@cf/google/gemma-4-26b-a4b-it";
const MAX_CHARS = 8000;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("Usa POST", { status: 405 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "JSON no válido" }, { status: 400 });
    }

    const { texto, stream } = (body ?? {}) as { texto?: unknown; stream?: unknown };
    if (typeof texto !== "string" || texto.trim().length === 0) {
      return Response.json({ error: "Falta 'texto'" }, { status: 400 });
    }
    if (texto.length > MAX_CHARS) {
      return Response.json({ error: `Máximo ${MAX_CHARS} caracteres` }, { status: 413 });
    }
    if (stream !== undefined && typeof stream !== "boolean") {
      return Response.json({ error: "'stream' debe ser booleano" }, { status: 400 });
    }

    const messages = [
      { role: "system", content: "Resume el texto en tres frases, en español." },
      { role: "user", content: texto },
    ];

    try {
      if (stream) {
        const sse = await env.AI.run(MODELO, { messages, stream: true });
        return new Response(sse as ReadableStream, {
          headers: { "content-type": "text/event-stream" },
        });
      }

      const res = (await env.AI.run(MODELO, {
        messages,
        max_completion_tokens: 300,
      })) as { choices?: { message?: { content?: unknown } }[] };

      const resumen = res?.choices?.[0]?.message?.content;
      if (typeof resumen !== "string") {
        return Response.json({ error: "Respuesta inesperada del modelo" }, { status: 502 });
      }
      return Response.json({ resumen });
    } catch (err) {
      console.error("Workers AI:", err);
      return Response.json({ error: "El modelo no está disponible" }, { status: 503 });
    }
  },
} satisfies ExportedHandler<Env>;
```

Detalles que importan:

- **El tamaño de la entrada lo controlas tú.** Sin límite, cualquiera puede mandarte un libro y pagarlo tú. Si el endpoint es público, ponle además [rate limiting](/blog/cloudflare-rate-limiting-guia) o [Turnstile](/blog/cloudflare-turnstile-guia).
- **No te fíes de la forma de la respuesta.** Gemma 4 devuelve un objeto tipo *chat completion* (`choices[0].message.content`). Otros modelos usan otra forma. Compruébala siempre.
- **`max_tokens` está en desuso** en este modelo. Usa `max_completion_tokens`.
- **No devuelvas el error interno** al cliente. Regístralo y responde con un mensaje genérico.

### 4. La API REST, desde cualquier sitio

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/google/gemma-4-26b-a4b-it" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "messages": [{ "role": "user", "content": "¿Qué es una CDN? En una frase." }] }'
```

También hay endpoints compatibles con OpenAI: `/ai/v1/chat/completions` y `/ai/v1/embeddings`. Si ya usas el SDK de OpenAI, basta con cambiar la `baseURL` a `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1`.

### 5. Lotes: muchas peticiones sin prisa

Los modelos marcados con **Batch** en el catálogo (Gemma 4 lo está) aceptan varias peticiones de una vez. El cuerpo total debe pesar **menos de 10 MB**:

```ts
const cola = await env.AI.run(
  MODELO,
  { requests: textos.map((t) => ({ messages: [{ role: "user", content: t }] })) },
  { queueRequest: true },
);
// cola.status === "queued", guarda cola.request_id

// Más tarde (desde una cola, un cron o un Workflow):
const estado = await env.AI.run(MODELO, { request_id: idGuardado });
// "queued" o "running" mientras trabaja; al terminar, un array "responses"
```

Cada elemento de `responses` lleva un `id` (la posición de la petición original) y un campo `success`. Revísalos uno a uno: en un lote, unas peticiones pueden fallar y otras no.

### 6. LoRA: tu adaptador sobre un modelo base

Si has entrenado un adaptador LoRA, súbelo con Wrangler y úsalo con el parámetro `lora`:

```bash
npx wrangler ai finetune create @cf/mistralai/mistral-7b-instruct-v0.2-lora mi-lora ./adaptador
npx wrangler ai finetune list
```

```ts
const res = await env.AI.run("@cf/mistralai/mistral-7b-instruct-v0.2-lora", {
  messages: [{ role: "user", content: "Hola" }],
  raw: true,
  lora: "mi-lora",
});
```

La carpeta debe contener exactamente `adapter_config.json` y `adapter_model.safetensors`, y el JSON tiene que llevar `model_type` (`mistral`, `gemma` o `llama`). La función está en beta abierta y es gratuita mientras dure. Cloudflare avisa de que los modelos LoRA también se retirarán con el tiempo.

### Lo mismo, como código

Workers AI no tiene un recurso propio en Terraform: no hay nada que crear. Lo que declaras es el binding del Worker (proveedor v5):

```hcl
resource "cloudflare_workers_script" "resumidor" {
  account_id         = var.account_id
  script_name        = "resumidor"
  main_module        = "index.js"
  content_file       = "dist/index.js"
  content_sha256     = filesha256("dist/index.js")
  compatibility_date = "2026-11-23"

  bindings = [{
    type = "ai"
    name = "AI"
  }]
}
```

## Cómo comprobarlo

Con el Worker desplegado, una entrada vacía tiene que devolver 400 sin tocar el modelo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://resumidor.example.workers.dev \
  -H "Content-Type: application/json" -d '{}'
# 400
```

Y una válida, el resumen:

```bash
curl -s -X POST https://resumidor.example.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"texto":"Cloudflare opera una red global que actúa como proxy inverso..."}'
```

Con `"stream": true`, añade `-N` a curl para ver llegar los eventos. El consumo de neuronas aparece en **AI › Workers AI**. Si enrutas por AI Gateway, verás además cada petición con sus tokens y su coste.

## Límites y precios

**Precio.** 0,011 $ por cada 1.000 neuronas. Todas las cuentas tienen **10.000 neuronas gratis al día**, en Workers Free y en Workers Paid. El contador se reinicia a las 00:00 UTC. En Free, al agotarlas, las peticiones fallan hasta el día siguiente. En Paid, lo que pasa de 10.000 se cobra.

Algunos precios del catálogo:

| Modelo | Entrada (por M tokens) | Salida (por M tokens) |
|---|---|---|
| `@cf/zai-org/glm-4.7-flash` | 0,06 $ | 0,40 $ |
| `@cf/google/gemma-4-26b-a4b-it` | 0,10 $ | 0,30 $ |
| `@cf/openai/gpt-oss-20b` | 0,20 $ | 0,30 $ |
| `@cf/baai/bge-m3` (*embeddings*) | 0,012 $ | — |

Para hacerte una idea: con Gemma 4, un millón de tokens de salida equivale a 27.273 neuronas. Las 10.000 diarias dan para unos 360.000 tokens de salida. Algunos modelos grandes (como `glm-5.3` o `deepseek-v4.1-flash-1017`) **no están en Workers Free**: piden Workers Paid o créditos prepago de AI Gateway.

**Límites de peticiones por minuto**, por tipo de tarea:

| Tarea | Peticiones/minuto |
|---|---|
| Generación de texto | 300 |
| Generación de texto, modelos solo de pago | 20 (50 con créditos de AI Gateway) |
| *Embeddings* | 3.000 (1.500 en `bge-large-en-v1.5`) |
| Voz a texto, imagen a texto, texto a imagen, traducción | 720 |

Los modelos en beta pueden tener límites más bajos.

**Otros límites.** Lotes: menos de 10 MB por petición. LoRA: adaptador de menos de 300 MB, rango `r ≤ 8` según la guía, modelo base sin cuantizar y hasta 100 adaptadores por cuenta.

**Tus datos.** Según la página de uso de datos de Workers AI:

- Cloudflare **no entrena modelos** con tus entradas, salidas, *embeddings* ni datos de ajuste.
- En una inferencia normal, **no guarda** la entrada ni la salida una vez entregada la respuesta.
- Sí se guarda contenido cuando lo pides tú: lotes, LoRA, registros o caché de AI Gateway, o lo que escribas en R2, KV o tus logs.
- Guarda metadatos operativos (modelo, tamaños, tokens, neuronas, latencia, códigos de error), sin el contenido.
- Los modelos son de terceros y cada uno tiene su licencia. Revísala antes de usarlo en producción.

## Documentación oficial

- [Workers AI: visión general](https://developers.cloudflare.com/workers-ai/) y [catálogo de modelos](https://developers.cloudflare.com/workers-ai/models/)
- [Binding de Workers](https://developers.cloudflare.com/workers-ai/configuration/bindings/) y [primeros pasos con Wrangler](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/)
- [API REST](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) y [endpoints compatibles con OpenAI](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)
- [Batch API](https://developers.cloudflare.com/workers-ai/features/batch-api/) y [su uso desde el binding](https://developers.cloudflare.com/workers-ai/features/batch-api/workers-binding/)
- [Adaptadores LoRA](https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/)
- [Precios](https://developers.cloudflare.com/workers-ai/platform/pricing/), [límites](https://developers.cloudflare.com/workers-ai/platform/limits/) y [uso de datos](https://developers.cloudflare.com/workers-ai/platform/data-usage/)
- [Workers AI a través de AI Gateway](https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/)
- [Terraform: bindings de Workers](https://developers.cloudflare.com/workers/platform/infrastructure-as-code/)
- [Changelog de Workers AI](https://developers.cloudflare.com/workers-ai/changelog/), [retirada de modelos del 20-nov-2026](https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/) y [`rejectIfBusy`](https://developers.cloudflare.com/changelog/post/2026-09-17-reject-if-busy/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Clef y Clairic: los modelos propios de Cloudflare.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Workflows: procesos duraderos paso a paso](/blog/cloudflare-workflows-guia)
- [Queues: mensajes y tareas en segundo plano](/blog/cloudflare-queues-guia)
