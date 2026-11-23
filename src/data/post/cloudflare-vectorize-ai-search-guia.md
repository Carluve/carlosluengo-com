---
publishDate: 2026-11-17T09:00:00Z
draft: false
image: 'media:blog/cloudflare-vectorize-ai-search-guia/portada.png'
title: 'Vectorize y AI Search: búsqueda semántica y RAG en Cloudflare'
excerpt: 'Serie Cloudflare, parte 46. Qué es Vectorize (índices, dimensiones, métricas, upsert, consultas y filtros por metadatos), qué es AI Search, el antiguo AutoRAG, cómo indexar tu web sin escribir el pipeline y cuánto cuesta cada uno.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'vectorize'
  - 'ai search'
  - 'rag'
  - 'inteligencia artificial'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 46 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Un modelo de lenguaje no conoce tus documentos. Para que responda con ellos hay que encontrar los fragmentos relevantes y pasárselos en el prompt. Eso es RAG (*retrieval-augmented generation*). Cloudflare te da dos formas de hacerlo: montarlo tú con **Vectorize** o dejar que lo monte **AI Search**.

## Qué es

**Vectorize** es la base de datos vectorial de Cloudflare. Guardas vectores (listas de números que representan el significado de un texto o una imagen) y le preguntas cuáles se parecen más a otro vector. Los genera un modelo de *embeddings*, por ejemplo de Workers AI. Está disponible en Workers Free y en Workers Paid.

**AI Search** es el servicio gestionado que hace todo por ti: lee tus contenidos, los convierte a Markdown, los trocea, genera los embeddings, los indexa y responde. Hasta septiembre de 2025 se llamaba **AutoRAG**. Está en disponibilidad general desde el 1 de octubre de 2026.

Con Vectorize decides tú el modelo, el troceado y los metadatos: más control y más código. Con AI Search conectas una fuente (tu web, un bucket de R2, una base D1 o ficheros que subes) y consultas. Por defecto hace **búsqueda híbrida**: vectorial y por palabras clave (BM25).

## Casos de uso

- **Buscador de tu web** que entiende "publicar sin abrir puertos" aunque la página diga "Tunnel".
- **Asistente de soporte** que responde con tus artículos y cita la fuente.
- **Datos por cliente**: un namespace o un filtro por cliente, para que nadie recupere documentos ajenos.

## Arquitectura

![Dos caminos para hacer RAG en Cloudflare: arriba, con Vectorize, tu Worker genera embeddings con Workers AI, hace upsert y consulta el índice; abajo, con AI Search, una web, un bucket de R2, una base D1 o ficheros subidos pasan por conversión a Markdown, troceado, embeddings e índice híbrido, y tu Worker llama a search o chatCompletions; debajo, tabla comparativa](media:blog/cloudflare-vectorize-ai-search-guia/00-arquitectura.png)

**Con Vectorize**, todo pasa en tu Worker:

1. Generas el embedding de cada documento y lo guardas con `upsert()`, con un ID y metadatos.
2. Para buscar, generas el de la pregunta **con el mismo modelo** y llamas a `query()`.
3. Recibes los IDs más cercanos y recuperas el texto (de los metadatos, D1 o R2).

Un índice tiene dos parámetros **fijos**: las **dimensiones** (las de tu modelo, hasta 1.536) y la **métrica** (`cosine`, `euclidean` o `dot-product`). Si cambias de modelo, creas otro índice.

**Con AI Search**, la indexación es automática: una fuente externa se sincroniza cada 24 horas por defecto (mínimo, 15 minutos) y un fichero subido se indexa al recibirlo. `search()` devuelve fragmentos con puntuación y `chatCompletions()` además genera la respuesta.

## Implementación paso a paso

Primero un buscador mínimo con Vectorize; después AI Search sobre la web de `carluve.dev`. La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Crea el índice de Vectorize

Con Wrangler. El ejemplo usa `@cf/google/embeddinggemma-2`, un modelo multilingüe de Workers AI que produce vectores de **768 dimensiones**:

```bash
npx wrangler vectorize create blog-semantico --dimensions=768 --metric=cosine
npx wrangler vectorize create-metadata-index blog-semantico --property-name=categoria --type=string
```

El índice de metadatos se crea **antes** de insertar: los vectores anteriores no entran en él hasta que los vuelvas a subir. Puedes crear hasta 10 por índice.

En `wrangler.jsonc`:

```jsonc
{
  "vectorize": [{ "binding": "VECTORIZE", "index_name": "blog-semantico" }],
  "ai": { "binding": "AI" }
}
```

El token que protege `/indexar` va como secreto:

```bash
npx wrangler secret put ADMIN_TOKEN
```

### 2. Indexa y consulta desde un Worker

```ts
interface Env { AI: Ai; VECTORIZE: Vectorize; ADMIN_TOKEN: string }
interface Doc { id: string; titulo: string; texto: string; categoria: string }

const MODELO = "@cf/google/embeddinggemma-2";
const enc = new TextEncoder();

function esDoc(d: unknown): d is Doc {
  if (typeof d !== "object" || d === null) return false;
  const o = d as Record<string, unknown>;
  return typeof o.id === "string" && o.id.length > 0 && enc.encode(o.id).length <= 64
    && typeof o.titulo === "string" && o.titulo.length <= 200
    && typeof o.texto === "string" && o.texto.length > 0 && o.texto.length <= 20000
    && typeof o.categoria === "string" && o.categoria.length <= 64;
}

async function embeber(env: Env, textos: string[]): Promise<number[][]> {
  const r = (await env.AI.run(MODELO, { input: textos })) as { data?: { embedding?: unknown }[] };
  const v = r?.data?.map((d) => d.embedding);
  if (!v || v.length !== textos.length || !v.every((x) => Array.isArray(x) && x.length === 768)) {
    throw new Error("Respuesta de embeddings inesperada");
  }
  return v as number[][];
}

function autorizado(req: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const a = enc.encode(req.headers.get("Authorization") ?? "");
  const b = enc.encode(`Bearer ${env.ADMIN_TOKEN}`);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/indexar" && req.method === "POST") {
        if (!autorizado(req, env)) return new Response("No autorizado", { status: 401 });
        let body: unknown;
        try { body = await req.json(); } catch { return new Response("JSON no válido", { status: 400 }); }
        if (!Array.isArray(body) || body.length === 0 || body.length > 100 || !body.every(esDoc)) {
          return new Response("Se espera una lista de 1 a 100 documentos válidos", { status: 400 });
        }
        const docs = body as Doc[];
        const valores = await embeber(env, docs.map((d) => `title: ${d.titulo} | text: ${d.texto}`));
        const r = await env.VECTORIZE.upsert(docs.map((d, i) => ({
          id: d.id, values: valores[i], metadata: { titulo: d.titulo, categoria: d.categoria },
        })));
        return Response.json({ mutationId: r.mutationId });
      }

      if (url.pathname === "/buscar" && req.method === "GET") {
        const q = url.searchParams.get("q")?.trim();
        if (!q || q.length > 500) return new Response("Falta ?q= (máximo 500 caracteres)", { status: 400 });
        const categoria = url.searchParams.get("categoria")?.trim();
        const [vector] = await embeber(env, [`task: search result | query: ${q}`]);
        const r = await env.VECTORIZE.query(vector, {
          topK: 5,
          returnMetadata: "all",
          ...(categoria ? { filter: { categoria } } : {}),
        });
        return Response.json(r.matches.map((m) => ({ id: m.id, score: m.score, ...m.metadata })));
      }

      return new Response("No encontrado", { status: 404 });
    } catch {
      return new Response("Error al generar o consultar los vectores", { status: 502 });
    }
  },
} satisfies ExportedHandler<Env>;
```

Detalles que importan:

- **`insert()` o `upsert()`.** Con un ID existente, `insert()` conserva el antiguo y `upsert()` lo sustituye entero.
- **Las escrituras son asíncronas**: devuelven un `mutationId` y tardan unos segundos en verse. Agrúpalas: hasta 1.000 vectores por lote desde un Worker y 5.000 por la API HTTP.
- **El filtro se aplica antes del `topK`.** Admite `$eq`, `$ne`, `$in`, `$nin` y rangos. Para separar clientes, mejor un **namespace**.
- Los prefijos `title: … | text: …` y `task: search result | query: …` son los que recomienda EmbeddingGemma 2.

### 3. Crea una instancia de AI Search sobre tu web

**AI › AI Search › Create Instance.** Le das un nombre (`blog`) y eliges la fuente. Para una web, el dominio tiene que estar **en la misma cuenta de Cloudflare**.

![AI Search: namespace default, uso (consultas, tokens de ingesta y almacenamiento) y el esquema de instancias dentro de un namespace](media:blog/cloudflare-vectorize-ai-search-guia/01-panel.png)

Con **Website**, las **Parser options** deciden qué entra: *Sitemap* (por defecto) o *Discover* para encontrar páginas, filtros de ruta (comparan la URL completa: `**/blog/**`, no `/blog/**`) y selectores CSS para saltarte menús y pies.

Tu [WAF](/blog/cloudflare-waf-guia) y tus [reglas de bots](/blog/cloudflare-bots-guia) también se aplican al rastreador (`Cloudflare-AI-Search`). Si son estrictas, añade una excepción.

Ya creada, en **Settings** ajustas la sincronización y la recuperación.

### 4. Consulta AI Search desde un Worker

El binding apunta a un namespace y da acceso a sus instancias. Si no indicas otro, las instancias van a `default`:

```jsonc
{
  "ai_search_namespaces": [{ "binding": "AI_SEARCH", "namespace": "default", "remote": true }]
}
```

`remote: true` permite usar `wrangler dev`: AI Search no se ejecuta en local.

```ts
interface Env { AI_SEARCH: AiSearchNamespace }

export default {
  async fetch(req, env): Promise<Response> {
    const q = new URL(req.url).searchParams.get("q")?.trim();
    if (!q || q.length > 500) return new Response("Falta ?q= (máximo 500 caracteres)", { status: 400 });
    try {
      const r = await env.AI_SEARCH.get("blog").chatCompletions({
        messages: [
          { role: "system", content: "Responde en español y solo con la información recuperada." },
          { role: "user", content: q },
        ],
        ai_search_options: { retrieval: { max_num_results: 5 } },
      });
      const respuesta = r?.choices?.[0]?.message?.content;
      const fuentes = Array.isArray(r?.chunks) ? r.chunks.map((c) => c?.item?.key).filter(Boolean) : [];
      return Response.json({ respuesta: typeof respuesta === "string" ? respuesta : "", fuentes });
    } catch {
      return new Response("Error en la búsqueda", { status: 502 });
    }
  },
} satisfies ExportedHandler<Env>;
```

Para recibir solo los fragmentos, usa `search()` (por defecto, hasta 10 con puntuación mínima de 0,4). Cada consulta cuenta: antes de abrir el endpoint al público, ponle [rate limiting](/blog/cloudflare-rate-limiting-guia).

### Lo mismo, como código

La documentación de Vectorize no incluye un recurso de Terraform. Usa Wrangler o `POST /accounts/{account_id}/vectorize/v2/indexes`. AI Search sí lo tiene (proveedor v5.29.0 o posterior):

```hcl
resource "cloudflare_ai_search_instance" "blog" {
  account_id      = var.account_id
  id              = "blog"
  namespace       = "default"
  type            = "web-crawler"
  source          = "example.com"
  max_num_results = 5
}
```

Cambiar `id`, `namespace` o `type` **destruye la instancia** y borra todo lo indexado. Revisa el `terraform plan`. Además, `indexing_options` se sustituye entero en cada cambio: lo que omitas vuelve a su valor por defecto.

## Cómo comprobarlo

Vectorize, con el Worker desplegado (unos segundos después del `upsert()`):

```bash
curl "https://buscador.example.workers.dev/buscar?q=publicar%20sin%20abrir%20puertos"
```

AI Search, por la API REST (token con **AI Search: Edit** y **AI Search: Run**, en una variable de entorno):

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/ai-search/namespaces/default/instances/blog/search" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"¿Cómo publico un servicio sin abrir puertos?"}]}'
```

En el panel, **Playground** prueba **Search** y **Chat**, y **Jobs** muestra cada sincronización. Para forzar una: `npx wrangler ai-search jobs create blog` (máximo una cada 30 segundos).

## Límites y precios

**Vectorize** (Workers Free / Workers Paid):

| | Free | Paid |
|---|---|---|
| Índices por cuenta | 100 | 50.000 por defecto |
| Vectores por índice | 20 millones | 20 millones |
| Dimensiones por vector | 1.536 | 1.536 |
| Metadatos por vector | 10 KiB | 10 KiB |
| `topK` máximo | 100 (50 con valores o metadatos) | Igual |
| Dimensiones consultadas incluidas/mes | 30 millones | 50 millones |
| Dimensiones almacenadas incluidas | 5 millones | 10 millones |

En Paid, el exceso cuesta **0,01 $ por millón de dimensiones consultadas** y **0,05 $ por cada 100 millones almacenadas**. No se cobra CPU ni transferencia. Las dimensiones consultadas son (vectores almacenados + consultas) × dimensiones.

**AI Search** empieza a facturar el **1 de diciembre de 2026**. Cada cuenta incluye al mes 5 millones de tokens de ingesta, 10 GB-mes de almacenamiento, 1.000 consultas semánticas y 1.000 de texto completo. Por encima:

| Concepto | Precio |
|---|---|
| Ingesta | 0,75 $ por millón de tokens |
| Imágenes y OCR | 0,50 $ adicionales por millón de tokens |
| Almacenamiento | 2,00 $ por GB-mes |
| Consultas semánticas, vectoriales o híbridas | 0,75 $ por 1.000 |
| Consultas de texto completo | 0,10 $ por 1.000 |

- Los embeddings y el *reranking* van incluidos. La **generación** de `chatCompletions()`, la reescritura de consultas y los resúmenes de ficheros se facturan aparte como Workers AI (o el proveedor externo que uses).
- Con R2 pagas tu bucket y, aparte, el Markdown que guarda AI Search.
- En Workers Free, el rastreo de webs está limitado a **500 páginas al día**. Otros límites: 100.000 ficheros por instancia en Free y 1 millón en Paid (500.000 con búsqueda híbrida), PDF de hasta 10 MiB con OCR y 4 MiB sin él.

## Documentación oficial

- [Vectorize: visión general](https://developers.cloudflare.com/vectorize/) y [primeros pasos con Workers AI](https://developers.cloudflare.com/vectorize/get-started/embeddings/)
- [Crear índices](https://developers.cloudflare.com/vectorize/best-practices/create-indexes/), [insertar vectores](https://developers.cloudflare.com/vectorize/best-practices/insert-vectors/) y [consultar](https://developers.cloudflare.com/vectorize/best-practices/query-vectors/)
- [Filtrado por metadatos](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/) y [API del binding](https://developers.cloudflare.com/vectorize/reference/client-api/)
- [Límites](https://developers.cloudflare.com/vectorize/platform/limits/) y [precios de Vectorize](https://developers.cloudflare.com/vectorize/platform/pricing/)
- [AI Search: cómo funciona](https://developers.cloudflare.com/ai-search/concepts/how-ai-search-works/), [fuente web](https://developers.cloudflare.com/ai-search/configuration/data-source/website/) y [sincronización](https://developers.cloudflare.com/ai-search/configuration/indexing/syncing/)
- [Binding de Workers](https://developers.cloudflare.com/ai-search/api/search/workers-binding/), [API REST](https://developers.cloudflare.com/ai-search/api/search/rest-api/) y [Terraform](https://developers.cloudflare.com/ai-search/api/instances/terraform/)
- [Límites y precios de AI Search](https://developers.cloudflare.com/ai-search/platform/limits-pricing/)
- Changelog: [AutoRAG pasa a ser AI Search](https://developers.cloudflare.com/changelog/post/2025-09-25-ai-search-more-models/), [disponibilidad general](https://developers.cloudflare.com/changelog/post/2026-10-01-ai-search-generally-available/), [facturación desde el 1 de diciembre y sincronización cada 24 h](https://developers.cloudflare.com/changelog/post/2026-11-02-billing-postponed-default-sync-interval/), y [20 millones de vectores por índice](https://developers.cloudflare.com/changelog/post/2026-08-04-index-capacity-20-million/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Agents SDK: agentes con estado.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [D1: la base de datos SQL sin servidor de Cloudflare](/blog/cloudflare-d1-guia)
