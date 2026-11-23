---
publishDate: 2026-11-03T09:00:00Z
draft: false
image: 'media:blog/cloudflare-clef-clairic-guia/portada.png'
title: 'Clef y Clairic: los modelos propios de Cloudflare'
excerpt: 'Serie Cloudflare, parte 44. Qué son Clef (decisión) y Clairic (extracción), los primeros modelos entrenados por el equipo de Workers AI; cuándo usar cada uno, cómo llamarlos desde un Worker con validación de entradas y salidas, y cuánto cuestan.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'workers ai'
  - 'ia'
  - 'clef'
  - 'clairic'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 44 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

A veces solo necesitas una respuesta corta y fiable: «¿es urgente?», «¿cuál es el total?». Con un LLM pides JSON, esperas a que genere tokens y lo parseas. Clef y Clairic cubren ese hueco desde [Workers](/blog/cloudflare-workers-guia) con Workers AI.

## Qué es

Clef y Clairic son los primeros modelos **entrenados por el propio equipo de Workers AI** de Cloudflare. No generan texto libre. Usan la API *System One*: les mandas un `state` (el contenido a evaluar) y un esquema tipado, y te devuelven respuestas tipadas con probabilidades.

- **Clef es un modelo de decisión** (1 de octubre de 2026). Le haces hasta 64 preguntas de tres tipos y elige entre opciones que tú defines:
  - `noul`: sí o no. Devuelve la probabilidad de «sí».
  - `choice`: una opción de un conjunto. Devuelve la elegida, la probabilidad de cada una y una confianza.
  - `score`: un nivel de una escala ordenada. Devuelve una puntuación ponderada por probabilidad.
- **Clairic es un modelo de extracción** (19 de octubre de 2026, en *preview*). Sirve cuando la respuesta no cabe en una lista de opciones: un importe, una fecha. Le defines campos tipados (`text`, `number`, `date`, `duration`, `list`, `estimate`, `forecast`…) y devuelve un valor por campo, o `null` si la entrada no lo determina. Cada valor puede estar **leído** del texto, **calculado** a partir de él o **estimado**.

La familia hoy:

| Modelo | Qué es | Contexto alojado |
|---|---|---|
| `@cf/cloudflare/clef` | Decisión, 27B, admite imágenes | 65.536 tokens |
| `@cf/cloudflare/clef-flash` | Decisión, 9B, el más rápido | 24.576 tokens |
| `@cf/cloudflare/clef-omni` | Decisión, MoE de 30B (3B activos); texto, imagen, audio y vídeo | 64.000 tokens |
| `@cf/cloudflare/clairic` | Extracción, *preview* | 65.536 tokens |
| `@cf/cloudflare/clairic-flash` | Extracción, *preview* temprana de investigación | 65.536 tokens |

Los pesos de Clef y Clef-flash son abiertos (Apache 2.0) en Hugging Face. Los de Clairic, según Cloudflare, se publicarán «pronto»; hoy solo está alojado.

**Planes.** Son modelos de Workers AI: entran en la asignación gratuita diaria tanto en Workers Free como en Workers Paid. No hay nada específico de Enterprise.

## Casos de uso

- **Triaje de soporte.** ¿Es urgente? ¿A qué equipo va? El ticket se enruta sin que nadie lo lea antes.
- **Salvaguardas para agentes.** «¿Debería ejecutar esta acción?» antes de llamar a una herramienta.
- **Moderación con tu política.** Un `score` contra tu rúbrica.
- **Facturas.** Clairic lee número, total y contactos, y calcula el vencimiento.
- **Estimaciones.** «¿Cuántos días tardará en pagarse?», con mediana e intervalo del 80 %.

## Arquitectura

![Flujo: una petición llega a un Worker, que valida la entrada y llama por el binding AI a Clef (decisión: noul, choice, score) o a Clairic (extracción: text, number, date, estimate); las respuestas tipadas con probabilidad pasan por un umbral de confianza que decide entre actuar automáticamente o mandar a revisión humana; debajo, tabla comparativa de Clef, Clef-flash, Clef-omni y Clairic](media:blog/cloudflare-clef-clairic-guia/00-arquitectura.png)

El flujo típico tiene cuatro pasos:

1. Tu **Worker** recibe la petición y valida lo que llega.
2. Llama al modelo con `env.AI.run()`, o desde fuera con la API REST en `/accounts/{account_id}/ai/run/{modelo}`. Ambas vías admiten pasar por AI Gateway.
3. El modelo lee el `state` **en una sola pasada** y puntúa cada respuesta permitida. No hay tokens de salida ni razonamiento que esperar.
4. Tu código decide con las probabilidades: si la confianza es alta, actúa; si no, lo manda a una persona.

En las pruebas de lanzamiento de Cloudflare, Clef-flash respondió en 38,8 ms de mediana. Mide con tus datos.

La documentación lo deja claro: **una respuesta bien formada no tiene por qué ser correcta**. Usa `confidence`, `p_null` y los intervalos para decidir qué automatizas.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Localiza el modelo

En el panel, **AI › Workers AI** tiene el catálogo de modelos. Busca `clef` o `clairic` para ver el ID, el precio y la ventana de contexto.

![Catálogo de modelos filtrado: clairic y clairic-flash aparecen como modelos de Cloudflare («Cloudflare-hosted»), junto a modelos de terceros](media:blog/cloudflare-clef-clairic-guia/01-panel.png)

### 2. Un token para la API REST (opcional)

Para llamar desde fuera de Cloudflare: **AI › Workers AI › Use REST API › Create a Workers AI API Token**. Si lo creas a mano, necesita **Workers AI - Read** y **Workers AI - Edit**. Guárdalo en un gestor de secretos, nunca en el código.

Desde un Worker no hace falta token: basta con el *binding*.

### 3. Añade el binding `AI` al Worker

En `wrangler.jsonc`:

```jsonc
{
  "name": "triaje-clef",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "ai": { "binding": "AI" }
}
```

Cada Worker admite **un solo** binding de AI. Las llamadas desde `wrangler dev` también consumen. En el panel: **Workers & Pages › tu Worker › Bindings › Add binding › Workers AI**.

### 4. Triaje con Clef-flash, validando todo

El Worker acepta `POST {"texto": "..."}`, pregunta a Clef-flash si es urgente y qué equipo debe atenderlo, y **comprueba la forma de la respuesta** antes de usarla.

```ts
export interface Env { AI: Ai }

const EQUIPOS = ["billing", "technical", "sales"] as const;
const MAX_CARACTERES = 8000;
const UMBRAL = 0.8; // por debajo, revisión humana

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "POST") {
      return Response.json({ error: "Usa POST" }, { status: 405 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "JSON no válido" }, { status: 400 });
    }

    const texto = (body as { texto?: unknown } | null)?.texto;
    if (typeof texto !== "string" || !texto.trim() || texto.length > MAX_CARACTERES) {
      return Response.json(
        { error: `'texto' debe ser una cadena de 1 a ${MAX_CARACTERES} caracteres` },
        { status: 400 },
      );
    }

    let r: unknown;
    try {
      r = await env.AI.run("@cf/cloudflare/clef-flash", {
        model: "clef-flash",
        state: texto,
        questions: {
          urgent: { type: "noul", instructions: "Is this support request urgent?" },
          team: {
            type: "choice",
            instructions: "Which team should handle this request?",
            criteria: {
              billing: "Payments, invoices, and refunds",
              technical: "Outages, errors, and configuration",
              sales: "Plans and upgrades",
            },
          },
        },
      });
    } catch {
      return Response.json({ error: "El modelo no respondió" }, { status: 502 });
    }

    // Nunca te fíes de un payload externo: comprueba tipos y valores.
    const a = (r as { answers?: Record<string, any> } | null)?.answers;
    const pUrgente = a?.urgent?.noul;
    const equipo = a?.team?.choice;
    const confianza = a?.team?.confidence;

    if (
      typeof pUrgente !== "number" ||
      typeof confianza !== "number" ||
      !EQUIPOS.includes(equipo)
    ) {
      return Response.json({ error: "Respuesta inesperada del modelo" }, { status: 502 });
    }

    return Response.json({
      urgente: pUrgente >= 0.5,
      equipo,
      revisionHumana: confianza < UMBRAL,
      pUrgente,
      confianza,
    });
  },
} satisfies ExportedHandler<Env>;
```

- **El umbral es tuyo.** 0,8 es un ejemplo; ajústalo mirando los casos dudosos.
- **Instrucciones en inglés**, como en los ejemplos oficiales. No he encontrado una lista de idiomas admitidos: prueba con tickets reales en español antes de automatizar.
- **Clef-flash tiene 24.576 tokens de contexto.** Un texto más largo se recorta. Para entradas largas, usa Clef.

### 5. Extraer valores con Clairic

Para una factura, el esquema son campos tipados. Si un campo depende de la fecha de hoy, pásala en `reference_date`: el modelo no sabe cuándo se ejecuta.

```ts
const r = await env.AI.run("@cf/cloudflare/clairic", {
  model: "clairic",
  state: textoFactura, // validado antes, igual que en el paso 4
  reference_date: new Date().toISOString().slice(0, 10),
  fields: {
    invoice_number: { type: "text" },
    due_date: { type: "date", instructions: "Issue date plus the net payment days" },
    total: { type: "number", decimals: 2, unit: "EUR", instructions: "Amount due including shipping" },
    days_to_pay: { type: "estimate", min: 0, max: 120, step: 1 },
  },
});

const total = (r as any)?.answers?.total;
const fiable =
  typeof total?.value === "number" &&
  typeof total?.confidence === "number" &&
  total.confidence >= 0.95 &&
  total.p_null < 0.05;
// Si no es fiable, a revisión. Nunca autorices un pago solo con esto.
```

Cada respuesta escalar trae `value`, `p_null` (probabilidad de que la entrada no determine el valor) y `confidence`. Los `text` traen además `span`, la posición exacta en el texto. Los `estimate` traen `median`, `p10` y `p90`.

Cloudflare avisa de que, en esta *preview*, las cuentas de uno o dos pasos son fiables, pero las cadenas largas no: extrae los datos y calcula en tu código. Las previsiones (`forecast`) son básicas.

### Lo mismo, como código

Con el proveedor de Terraform (v5), el binding es un elemento más de `bindings`:

```hcl
resource "cloudflare_workers_script" "triaje" {
  account_id         = var.account_id
  script_name        = "triaje-clef"
  main_module        = "index.js"
  content_file       = "dist/index.js"
  content_sha256     = filesha256("dist/index.js")
  compatibility_date = "2026-11-01"
  bindings = [{
    name = "AI"
    type = "ai"
  }]
}
```

No hay que «activar» el modelo: basta con el binding.

## Cómo comprobarlo

Despliega el Worker y lanza dos peticiones: una válida y otra con JSON roto.

```bash
URL=https://triaje-clef.tu-subdominio.workers.dev

curl -s -X POST "$URL" -H 'content-type: application/json' \
  -d '{"texto":"Checkout has been failing for every customer for the last hour."}'
# {"urgente":true,"equipo":"technical","revisionHumana":false,...}

curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL" -d '{roto'
# 400
```

Los errores de entrada devuelven 400 sin llegar al modelo.

Para probar Clairic sin Worker, usa la API REST con el token en una variable de entorno:

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/cloudflare/clairic" \
  -H "Authorization: Bearer $CLOUDFLARE_AUTH_TOKEN" \
  -d '{"model":"clairic","state":"Invoice INV-2291, issued 2026-09-02, net 30. Total $1,080.00.",
       "fields":{"invoice_number":{"type":"text"},"due_date":{"type":"date"}}}'
```

`usage.passes` indica cuántas pasadas hizo. Cada campo `text` va en su propia pasada, y cada pasada vuelve a cobrar el `state` completo.

## Límites y precios

Ninguno de estos modelos cobra tokens de salida: solo pagas la entrada. Las imágenes, el audio y el vídeo se convierten en tokens de entrada.

| Modelo | Precio por millón de tokens de entrada | Entrada multimedia |
|---|---|---|
| Clef | 0,24 $ | Hasta 4 imágenes |
| Clef-flash | 0,038 $ | Hasta 4 imágenes |
| Clef-omni | 0,15 $ | 4 imágenes, 4 audios (máx. 300 s), 2 vídeos (máx. 60 s) |
| Clairic | 0,10 $ hasta el 1-dic-2026; después, 0,24 $ | 4 imágenes o páginas de PDF en total |
| Clairic-flash | 0,10 $ | 4 imágenes |

- **Gratis:** 10.000 neuronas al día. Por encima, Workers Paid, a 0,011 $ por cada 1.000 neuronas. Con las tablas oficiales, son unos 458.000 tokens diarios de Clef o 2,9 millones de Clef-flash.
- **Rate limit:** 300 peticiones por minuto, el valor por defecto de los modelos de generación de texto.
- **Preguntas y campos:** Clef admite de 1 a 64 preguntas por petición. Clairic no tiene límite de campos, pero cada pasada debe caber en la ventana de contexto.
- **Imágenes:** PNG, JPEG o WebP embebidas (base64), 4 MiB cada una. No se aceptan URL remotas.
- **Datos:** todas las fichas indican *zero data retention*.
- **Clairic está en *preview*:** se ofrece «tal cual» y Cloudflare puede retirarlo.

## Documentación oficial

- Modelos: [Clef](https://developers.cloudflare.com/workers-ai/models/clef/), [Clef-flash](https://developers.cloudflare.com/workers-ai/models/clef-flash/), [Clef-omni](https://developers.cloudflare.com/workers-ai/models/clef-omni/), [Clairic](https://developers.cloudflare.com/workers-ai/models/clairic/) y [Clairic-flash](https://developers.cloudflare.com/workers-ai/models/clairic-flash/)
- [Modelos de extracción: cuándo usarlos y cómo interpretar los resultados](https://developers.cloudflare.com/workers-ai/concepts/extraction-models/)
- [Precios de Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) y [límites](https://developers.cloudflare.com/workers-ai/platform/limits/)
- [Bindings de Workers AI](https://developers.cloudflare.com/workers-ai/configuration/bindings/) y [API REST](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- Changelog: [lanzamiento de Clef (1-oct-2026)](https://developers.cloudflare.com/changelog/post/2026-10-01-clef-workers-ai/), [Clef-omni y bajada de Clef-flash (9-oct-2026)](https://developers.cloudflare.com/changelog/post/2026-10-09-clef-omni-workers-ai/) y [lanzamiento de Clairic (19-oct-2026)](https://developers.cloudflare.com/changelog/post/2026-10-19-clairic-workers-ai/)
- [Terraform: `cloudflare_workers_script`](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/workers_script)
- Pesos abiertos: [Clef](https://huggingface.co/Cloudflare/clef) y [Clef-flash](https://huggingface.co/Cloudflare/clef-flash) en Hugging Face

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** [AI Gateway: control y caché de las llamadas a modelos](/blog/cloudflare-ai-gateway-guia).

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Queues: mensajes y tareas en segundo plano](/blog/cloudflare-queues-guia)
- [Workflows: procesos duraderos paso a paso](/blog/cloudflare-workflows-guia)
