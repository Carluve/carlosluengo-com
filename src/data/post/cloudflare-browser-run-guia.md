---
publishDate: 2026-06-09T09:00:00Z
draft: false
image: 'media:blog/cloudflare-browser-run-guia/portada.png'
title: 'Browser Run: navegadores sin interfaz en el borde'
excerpt: 'Serie Cloudflare, parte 23. Qué es Browser Run (antes Browser Rendering), cuándo usar Quick Actions y cuándo una sesión con Puppeteer o Playwright, cómo generar PDFs y capturas desde un Worker sin abrir un proxy a todo internet, y qué cuesta.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'browser run'
  - 'workers'
  - 'puppeteer'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 23 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Hay tareas que solo sabe hacer un navegador de verdad: ejecutar el JavaScript de una página y sacar una captura o un PDF. Mantener Chrome en un servidor propio es incómodo. Browser Run te da ese Chrome en la red de Cloudflare, y lo usas con una petición HTTP o desde un [Worker](/blog/cloudflare-workers-guia).

## Qué es

Browser Run es el servicio de navegadores sin interfaz (*headless*) de Cloudflare. Hasta el 15 de abril de 2026 se llamaba **Browser Rendering**. Verás el nombre antiguo en algunas rutas de la API, en el SDK (`client.browserRendering`) y en ejemplos.

Tiene dos formas de uso:

- **Quick Actions.** Una petición, un resultado. Le pasas una URL o un HTML y te devuelve una captura, un PDF, el HTML renderizado, Markdown, enlaces, elementos concretos o datos estructurados extraídos con IA. Funcionan por API REST o desde un Worker con `env.BROWSER.quickAction()`.
- **Browser Sessions.** Controlas el navegador paso a paso con Puppeteer, Playwright o el protocolo CDP: rellenar formularios, hacer clic, navegar entre páginas. Desde un Worker usas los *forks* de Cloudflare (`@cloudflare/puppeteer` y `@cloudflare/playwright`). Desde fuera, te conectas por WebSocket al endpoint CDP.

Desde abril de 2026 también hay **Live View** (ver y tocar una sesión en directo), **Human in the Loop** (que una persona resuelva un login y devuelva el control al script) y **Session Recordings** (grabar la sesión para verla después, con `recording: true` al lanzar el navegador).

**Planes.** Browser Run depende del plan de **Workers**, no del plan de la zona. Funciona en Workers Free y en Workers Paid, con límites distintos (al final del post).

## Casos de uso

- **PDFs a partir de HTML.** Facturas, certificados, informes. Generas el HTML tú y Browser Run lo imprime.
- **Capturas de tus propias páginas.** Miniaturas para redes o pruebas visuales antes de publicar.
- **Contenido para IA.** `/markdown` y `/json` convierten una página en texto limpio o en un objeto con tu esquema.
- **Agentes que navegan.** Un agente con Playwright MCP o con un cliente CDP usa Browser Run como navegador remoto.
- **Pruebas de extremo a extremo** con Playwright, sin mantener Chrome en tu CI.

Un aviso: Browser Run se identifica siempre como bot. Añade cabeceras que no puedes quitar (`cf-brapi-request-id`, `cf-brapi-devtools`) y firma las peticiones con Web Bot Auth. Úsalo con tus sitios o con los que te lo permitan, no para saltarte protecciones.

## Arquitectura

![Dos caminos hacia Browser Run: Quick Actions por API REST o por binding desde un Worker, y Browser Sessions con Puppeteer, Playwright o CDP; ambos usan un Chrome sin interfaz en la red de Cloudflare que visita la web de destino. Debajo, tabla de límites de Workers Free y Workers Paid](media:blog/cloudflare-browser-run-guia/00-arquitectura.png)

1. **Tu código** llega por uno de dos caminos: la API REST (`api.cloudflare.com/client/v4/accounts/{account_id}/browser-run/...`, con un token) o un **binding** `browser` en un Worker (sin token).
2. Cloudflare te asigna un **Chrome sin interfaz** en su red.
3. Ese Chrome **visita la web de destino** como un navegador normal, con las cabeceras de identificación de Browser Run.
4. Con una Quick Action recibes el resultado y el navegador se cierra. Con una sesión, el navegador sigue vivo hasta que llamas a `browser.close()` o pasan **60 segundos sin actividad**. Con `keep_alive` puedes alargar esa espera hasta **20 minutos**.

Todo se factura por **tiempo de navegador**. En las sesiones también cuentan los **navegadores simultáneos**.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Prueba en el Playground

Desde julio de 2026, el panel de Browser Run tiene un **Playground**: pones una URL o un HTML, eliges la acción y ves el resultado sin escribir código. Con **Show Code** te da la misma petición en cURL, TypeScript, Python o como llamada al binding.

![Resumen de Browser Run: pestañas Runs, Live Sessions, Playground y Script Studio, con métricas de sesiones y horas de navegador a cero](media:blog/cloudflare-browser-run-guia/01-panel.png)

Lo que ejecutas en el Playground también consume tiempo de navegador.

### 2. Un token para la API REST

Si vas a llamar a la API desde fuera de Cloudflare, crea un token personalizado con el permiso **Account › Browser Run › Edit**. Limítalo a tu cuenta y, si puedes, a las IPs de tu servidor. Desde un Worker con binding no necesitas token.

Guarda el token en una variable de entorno, nunca en el código:

```bash
export CF_ACCOUNT_ID="tu_account_id"
export CF_API_TOKEN="el_token_que_acabas_de_crear"

curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/browser-run/screenshot" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com", "screenshotOptions": {"fullPage": true}}' \
  --output captura.png
```

La pantalla por defecto es de 1920×1080; cámbiala con `viewport`. Si usas `quality`, pon también `"type": "jpeg"`: con PNG devuelve un 400.

### 3. PDFs desde un Worker, sin abrir un proxy

El error típico es un Worker que recibe `?url=` y lo pasa tal cual a Browser Run. Eso es un proxy abierto: cualquiera gasta tu tiempo de navegador visitando lo que quiera. Este Worker hace lo contrario: recibe datos, construye el HTML él mismo y lo convierte en PDF.

Configuración (`wrangler.jsonc`):

```jsonc
{
  "name": "facturas-pdf",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-23",
  "browser": { "binding": "BROWSER" }
}
```

El método `quickAction()` exige una `compatibility_date` de `2026-03-24` o posterior. La clave de acceso va como secreto: `npx wrangler secret put API_KEY`.

```ts
interface Env {
  BROWSER: BrowserRun;
  API_KEY: string;
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("Usa POST", { status: 405 });
    }
    if (req.headers.get("x-api-key") !== env.API_KEY) {
      return new Response("No autorizado", { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response("JSON no válido", { status: 400 });
    }

    const { cliente, importe } = (body ?? {}) as Record<string, unknown>;
    if (typeof cliente !== "string" || cliente.length === 0 || cliente.length > 200) {
      return new Response("Falta 'cliente' (texto, máx. 200)", { status: 400 });
    }
    if (typeof importe !== "number" || !Number.isFinite(importe) || importe < 0) {
      return new Response("Falta 'importe' (número >= 0)", { status: 400 });
    }

    const html = `<!doctype html><meta charset="utf-8">
      <style>body{font-family:sans-serif;margin:40px}</style>
      <h1>Factura</h1>
      <p>Cliente: ${escapar(cliente)}</p>
      <p>Importe: ${importe.toFixed(2)} €</p>`;

    const pdf = await env.BROWSER.quickAction("pdf", { html });
    if (!pdf.ok) {
      return new Response("No se pudo generar el PDF", { status: 502 });
    }
    return new Response(pdf.body, {
      headers: { "content-type": "application/pdf" },
    });
  },
};
```

Tú construyes el HTML, escapas lo que manda el usuario y validas antes de gastar tiempo de navegador. Si prefieres no gestionar una clave, pon el Worker detrás de [Access](/blog/cloudflare-access-guia).

### 4. Una sesión con Puppeteer

Cuando necesitas varios pasos (iniciar sesión, hacer clic, esperar), usa una sesión. Instala `@cloudflare/puppeteer` y usa el mismo binding:

```ts
import puppeteer from "@cloudflare/puppeteer";

const PERMITIDAS = new Set(["/", "/blog", "/contacto"]);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const ruta = new URL(req.url).searchParams.get("ruta");
    if (!ruta || !PERMITIDAS.has(ruta)) {
      return new Response("Ruta no permitida", { status: 400 });
    }

    const browser = await puppeteer.launch(env.BROWSER, { keep_alive: 120_000 });
    try {
      const page = await browser.newPage();
      await page.goto(`https://www.example.com${ruta}`, { waitUntil: "networkidle0" });
      const titulo = await page.title();
      return Response.json({ ruta, titulo });
    } finally {
      await browser.close();
    }
  },
};
```

El dominio es fijo y las rutas salen de una lista cerrada. El `try/finally` cierra el navegador aunque algo falle; sin él, el navegador sigue facturando hasta que se cierra por inactividad. `keep_alive` va en milisegundos.

Si abres muchas sesiones seguidas, **reutilízalas**: `puppeteer.sessions()` lista las abiertas y `puppeteer.connect(env.BROWSER, sessionId)` se conecta a una. En ese caso, cierra con `browser.disconnect()` y no con `close()`, que cierra el navegador para todos los clientes conectados. Aísla cada petición en su propio contexto de navegador.

### Lo mismo, como código

Browser Run no tiene recursos que crear: ni *buckets* ni bases de datos. Todo se declara en la configuración del Worker (el bloque `browser` de arriba) y en el token. Para extraer datos con IA, `/json` acepta un `prompt` y, opcionalmente, un esquema:

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/browser-run/json" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com/blog",
    "prompt": "Lista los títulos de los artículos",
    "response_format": { "type": "json_schema", "json_schema": {
      "type": "object",
      "properties": { "titulos": { "type": "array", "items": { "type": "string" } } },
      "required": ["titulos"]
    }}
  }'
```

Por defecto usa un modelo de Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), que se factura aparte. Trata la respuesta como datos externos: comprueba que `result.titulos` es un array de textos antes de usarlo.

## Cómo comprobarlo

Toda respuesta de Quick Actions trae la cabecera `X-Browser-Ms-Used` con los milisegundos de navegador consumidos:

```bash
curl -s -D - -o /dev/null -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/browser-run/markdown" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com"}' | grep -i x-browser-ms-used
```

En local, `npx wrangler dev` usa un Chrome de tu máquina para Puppeteer, Playwright y `quickAction()`. La excepción es `/json`: devuelve datos de relleno porque Workers AI no funciona en local. Añade `"remote": true` al binding para usar el servicio real.

En el panel, **Browser Run › Runs** lista cada sesión y cada Quick Action con su estado y duración. Si ves sesiones cerradas por `BrowserIdle` en lugar de `NormalClosure`, tu código no está llamando a `browser.close()`. Desde código, `puppeteer.history()` da la misma información.

Si una petición devuelve **429**, has superado un límite. La cabecera `Retry-After` dice cuánto esperar.

## Límites y precios

| | Workers Free | Workers Paid |
|---|---|---|
| Tiempo de navegador | 10 min/día | 10 h/mes incluidas, luego 0,09 $/h |
| Navegadores simultáneos (sesiones) | 3 | 10 incluidos (media mensual), luego 2 $ por navegador; tope por defecto 200 |
| Navegadores nuevos (sesiones) | 1 cada 20 s | 3 por segundo |
| Peticiones (Quick Actions) | 1 cada 10 s | 30 por segundo |
| Inactividad antes de cerrar | 60 s (hasta 20 min con `keep_alive`) | 60 s (hasta 20 min con `keep_alive`) |
| `/crawl` | 5 trabajos/día, 100 páginas por trabajo | — |

- Los navegadores simultáneos se calculan con el **pico de cada día**, promediado en el mes. Un pico puntual no dispara la factura.
- El tiempo se suma por día en segundos y se redondea a horas al final del ciclo (30 minutos o más suben a la hora siguiente).
- Una Quick Action que falla con `waitForTimeout` no se cobra.
- No hay duración máxima de sesión mientras haya actividad, pero las sesiones se cierran cuando Cloudflare despliega una versión nueva del servicio.
- En Free, el límite diario se reinicia a las 00:00 UTC. Si acabas de pasar a Paid y sigues viendo el límite de 10 minutos, vuelve a desplegar el Worker.
- **Solo Enterprise:** dejar pasar Browser Run en tu propia zona con una regla del [WAF](/blog/cloudflare-waf-guia) que use el campo *Bot Detection ID*, porque es un campo de Bot Management.

## Documentación oficial

- [Browser Run: visión general](https://developers.cloudflare.com/browser-run/) y [primeros pasos](https://developers.cloudflare.com/browser-run/get-started/)
- [Quick Actions](https://developers.cloudflare.com/browser-run/quick-actions/): [captura](https://developers.cloudflare.com/browser-run/quick-actions/screenshot-endpoint/), [PDF](https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/), [Markdown](https://developers.cloudflare.com/browser-run/quick-actions/markdown-endpoint/) y [JSON](https://developers.cloudflare.com/browser-run/quick-actions/json-endpoint/)
- [Puppeteer](https://developers.cloudflare.com/browser-run/puppeteer/), [Playwright](https://developers.cloudflare.com/browser-run/playwright/) y [reutilizar sesiones](https://developers.cloudflare.com/browser-run/features/reuse-sessions/)
- [Binding en Wrangler](https://developers.cloudflare.com/browser-run/reference/wrangler/) y [API del binding](https://developers.cloudflare.com/browser-run/reference/browser-binding-api/)
- [Cabeceras automáticas e identificación como bot](https://developers.cloudflare.com/browser-run/reference/automatic-request-headers/)
- [Límites](https://developers.cloudflare.com/browser-run/limits/), [precios](https://developers.cloudflare.com/browser-run/pricing/) y [preguntas frecuentes](https://developers.cloudflare.com/browser-run/faq/)
- [Changelog de Browser Run](https://developers.cloudflare.com/browser-run/changelog/): [cambio de nombre](https://developers.cloudflare.com/changelog/post/2026-04-15-br-rename/), [endpoint CDP](https://developers.cloudflare.com/changelog/post/2026-04-10-browser-rendering-cdp-endpoint/) y [Playground](https://developers.cloudflare.com/changelog/post/2026-07-31-br-dashboard-playground/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Email Routing y Email Service: recibir y enviar correo.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Workflows: procesos duraderos paso a paso](/blog/cloudflare-workflows-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
