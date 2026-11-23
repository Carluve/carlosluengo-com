---
publishDate: 2026-11-10T09:00:00Z
draft: false
image: 'media:blog/cloudflare-ai-gateway-guia/portada.png'
title: 'AI Gateway: control y caché de las llamadas a modelos'
excerpt: 'Serie Cloudflare, parte 45. Qué es AI Gateway, cómo poner un proxy delante de OpenAI, Anthropic o Workers AI, cómo activar caché, rate limiting, reintentos, Guardrails y DLP, cómo guardar tus claves con BYOK, qué es Unified Billing y cuánto cuesta.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'ai gateway'
  - 'ia'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 45 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Cuando tu aplicación llama a modelos de IA, surgen tres preguntas: cuánto gastas, qué envías y qué pasa si el proveedor se cae. AI Gateway responde a las tres y, si ya usas [Workers](/blog/cloudflare-workers-guia), se activa con una línea de código.

## Qué es

AI Gateway es un **proxy entre tu aplicación y los proveedores de modelos** (OpenAI, Anthropic, Google, Workers AI y más). Tu código llama a Cloudflare en lugar de al proveedor. Por el camino puedes:

- **Ver**: analítica y logs de cada llamada.
- **Ahorrar**: caché, *rate limiting* y límites de gasto.
- **Resistir fallos**: reintentos, timeouts, alias de modelos y rutas dinámicas.
- **Proteger**: Guardrails, DLP y claves guardadas en Cloudflare (BYOK).
- **Pagar en un sitio**: Unified Billing, con créditos de Cloudflare.

Está **disponible en todos los planes**.

Hay tres formas de entrar:

1. **API REST unificada** en `api.cloudflare.com/client/v4/accounts/{account_id}/ai/...`: `/ai/run` (cualquier modelo), `/ai/v1/chat/completions` (SDK de OpenAI), `/ai/v1/responses` y `/ai/v1/messages` (SDK de Anthropic). Es la recomendada para integraciones nuevas.
2. **Endpoints por proveedor** en `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/{provider}`, con el esquema original de cada proveedor.
3. **El binding `env.AI`** desde un Worker, ya autenticado.

## Casos de uso

- **Chatbot con preguntas repetidas.** Las de un menú cerrado se sirven desde caché, sin pagar tokens.
- **Que un bucle no dispare la factura.** Un *rate limit* y un límite de gasto lo cortan con un 429.
- **Saber quién gasta qué.** Metadatos por petición (`team`, `user`) para filtrar logs y analítica.
- **Cambiar de modelo sin desplegar.** Con un alias como `custom/soporte`, el modelo se cambia en el panel, con *fallback* si uno falla.
- **Que no salgan datos personales.** DLP revisa prompts y respuestas.

## Arquitectura

![Flujo de AI Gateway: tu app o Worker envía la petición al gateway, que aplica autenticación, rate limiting y límites de gasto, Guardrails y DLP, caché, y enrutado con reintentos y fallback hacia OpenAI, Anthropic, Google o Workers AI; logs y analítica recogen cada llamada. Debajo, tabla de cabeceras cf-aig más útiles](media:blog/cloudflare-ai-gateway-guia/00-arquitectura.png)

Cada petición pasa por el gateway que elijas, o por `default`, que se crea solo con la primera petición autenticada. En orden simplificado:

1. **Autenticación.** Los gateways nuevos la exigen y, una vez activa, no se puede quitar. Con la API REST va en `Authorization`; en los endpoints `gateway.ai.cloudflare.com`, en `cf-aig-authorization`.
2. **Límites.** Rate limiting y límites de gasto.
3. **Caché.** Si hay coincidencia exacta, la respuesta sale de Cloudflare con `cf-aig-cache-status: HIT`.
4. **Inspección.** Guardrails y DLP revisan el prompt. Los aciertos de caché no pasan otra vez por DLP.
5. **Enrutado y proveedor.** Modelo directo, alias o ruta dinámica, con reintentos y timeouts. La credencial se elige en este orden: la clave de la petición, la guardada con BYOK (alias `default`) y, si no hay ninguna, Unified Billing.
6. **Vuelta.** Guardrails y DLP pueden revisar la respuesta. Todo queda en logs y analítica.

La clave de caché es un SHA-256 de proveedor, endpoint, modelo, cabecera de autenticación y **cuerpo completo**. Un espacio de más en el prompt crea otra entrada.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Crea el gateway

En el panel, **AI › AI Gateway › Create Gateway**. Pon un nombre (máximo 64 caracteres) y elige cómo se factura Workers AI a través de este gateway:

- **Standard billing**: la factura normal de Cloudflare al final del ciclo.
- **Unified billing**: descuenta en tiempo real de tus créditos prepago de AI Gateway.

![Formulario Create new gateway: identificador de ejemplo asistente-web y opciones de registro de peticiones, caché, límite de peticiones, límites de gasto y reintentos](media:blog/cloudflare-ai-gateway-guia/01-panel.png)

El gateway nace con autenticación y logs activados, y con caché y rate limiting apagados.

### 2. Ajusta caché, rate limiting y reintentos

Entra en el gateway › **Settings**:

- **Cache Responses**: actívalo y elige el TTL por defecto. El mínimo es 60 segundos y el máximo, un mes.
- **Rate-limiting**: número de peticiones, periodo y técnica. Con **fixed**, la ventana va por bloques de reloj (12:00–12:10, 12:10–12:20). Con **sliding**, cuenta los últimos N minutos. Al pasarse, el gateway responde **429**.
- **Retry Requests**: hasta 5 reintentos, con un retraso base de 0,1 a 60 segundos y *backoff* constante, lineal o exponencial.
- **Require provider credentials**: impide que una petición a un proveedor de terceros sin clave acabe pagándose con tus créditos de Unified Billing.

En **Settings › Spend limits** fijas presupuestos en dólares por ventana de tiempo, por proveedor, por modelo o por un metadato como `user_id`. El recuento es eventualmente consistente: una ráfaga simultánea puede pasarse un poco.

### 3. Activa Guardrails

En el gateway, **Guardrails** › activa el interruptor. Con **Change › Configure specific categories** decides, para prompts y respuestas, si cada una se marca (**Flag**), se bloquea (**Block**) o se ignora (**Ignore**).

Por debajo usa `@cf/meta/llama-guard-3-8b` para las categorías de contenido peligroso (`S1` a `S14`) y `@cf/meta/prompt-guard-2-86m` para la inyección de prompts (`P1`). Un bloqueo devuelve el código `2016` si fue el prompt y `2017` si fue la respuesta.

En los endpoints del gateway, las respuestas en *streaming* se acumulan para evaluarlas y llegan de golpe.

**DLP** se configura en el mismo gateway, con perfiles compartidos con Cloudflare One. Sin suscripción de Zero Trust tienes dos perfiles predefinidos: información financiera y números de identificación nacional. Si bloquea, devuelve un 400.

### 4. Guarda las claves de proveedor (BYOK)

No pongas la clave de OpenAI o Anthropic en tu código. En el gateway, **Provider Keys** › **Add API Key**. La clave se guarda en Secrets Store y el gateway la añade a cada petición. Para rotarla no hace falta desplegar.

Puedes tener varias claves por proveedor, cada una con su alias. Con `cf-aig-byok-alias` eliges una, pero solo en los endpoints por proveedor. En la API REST unificada y en el binding solo cuenta `default`.

La alternativa es **Unified Billing**: compras créditos (**Credits Available › Manage**, solo con tarjeta) y llamas a modelos de terceros sin claves propias.

### Lo mismo, como código

Un Worker que responde preguntas a través del gateway y valida la entrada y la salida. La configuración de Wrangler:

```jsonc
{
  "name": "pregunta-ia",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "ai": { "binding": "AI" }
}
```

El código:

```ts
interface Env {
  AI: Ai;
}

const GATEWAY = "blog-demo";
const MODELO = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/preguntar") {
      return json({ error: "No encontrado" }, 404);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "El cuerpo debe ser JSON válido" }, 400);
    }

    const pregunta =
      body !== null && typeof body === "object"
        ? (body as Record<string, unknown>).pregunta
        : undefined;
    if (typeof pregunta !== "string" || !pregunta.trim() || pregunta.length > 2000) {
      return json({ error: "Falta 'pregunta' (texto de 1 a 2000 caracteres)" }, 400);
    }

    try {
      const salida = await env.AI.run(
        MODELO,
        {
          messages: [
            { role: "system", content: "Responde en español, en tres frases como máximo." },
            { role: "user", content: pregunta.trim() },
          ],
          max_tokens: 300,
        },
        { gateway: { id: GATEWAY, metadata: { app: "pregunta-ia" } } },
      );

      const texto =
        salida !== null && typeof salida === "object"
          ? (salida as Record<string, unknown>).response
          : undefined;
      if (typeof texto !== "string") {
        return json({ error: "Respuesta inesperada del modelo" }, 502);
      }
      return json({ respuesta: texto });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("2016")) return json({ error: "Pregunta bloqueada por Guardrails" }, 422);
      if (msg.includes("2017")) return json({ error: "Respuesta bloqueada por Guardrails" }, 502);
      console.error("Error de AI Gateway:", msg);
      return json({ error: "No se pudo obtener respuesta" }, 502);
    }
  },
} satisfies ExportedHandler<Env>;
```

Notas:

- El binding ya va autenticado: no hay tokens en el código.
- Este endpoint es público. En producción, protégelo con [Turnstile](/blog/cloudflare-turnstile-guia) o con una regla de [rate limiting](/blog/cloudflare-rate-limiting-guia) para que nadie gaste tus tokens.

Y el gateway con Terraform (proveedor v5, recurso `cloudflare_ai_gateway`):

```hcl
resource "cloudflare_ai_gateway" "blog_demo" {
  account_id                 = var.account_id
  id                         = "blog-demo"
  authentication             = true
  collect_logs               = true
  cache_ttl                  = 3600
  cache_invalidate_on_update = true
  rate_limiting_limit        = 100
  rate_limiting_interval     = 60
  rate_limiting_technique    = "sliding"
  retry_max_attempts         = 3
  retry_delay                = 500 # milisegundos
  retry_backoff              = "exponential"
}
```

El token necesita el permiso *AI Gateway Write*. Ojo con la API: `PUT /accounts/{account_id}/ai-gateway/gateways/{id}` **sustituye** la configuración entera. Si omites `guardrails` o `dlp`, se borran.

## Cómo comprobarlo

Con la caché activa, lanza la misma petición dos veces contra la API REST. El token necesita **Account › Workers AI › Read**. Con permisos solo de AI Gateway, devuelve `401`.

```bash
for i in 1 2; do
  curl -s -o /dev/null -D - \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/v1/chat/completions" \
    --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    --header "cf-aig-gateway-id: blog-demo" \
    --header "Content-Type: application/json" \
    --data '{"model":"@cf/meta/llama-3.3-70b-instruct-fp8-fast","messages":[{"role":"user","content":"¿Qué es un CDN? Una frase."}]}' \
    | grep -i '^cf-aig-cache-status'
done
# cf-aig-cache-status: MISS
# cf-aig-cache-status: HIT
```

Con modelos de Workers AI, la cabecera `cf-aig-gateway-id` es obligatoria.

Para el rate limiting, baja el límite a 2 por minuto y lanza tres peticiones: la tercera devuelve 429. En el panel, la analítica del gateway muestra peticiones, tokens, coste, errores y caché.

Si no quieres guardar el texto de un prompt, envía `cf-aig-collect-log-payload: false` (solo se guardan los metadatos) o `cf-aig-collect-log: false` (no se guarda nada).

## Límites y precios

| | Límite |
|---|---|
| Gateways por cuenta | 10 (Workers Free) · 20 (Workers Paid) |
| Nombre del gateway | 64 caracteres |
| Tamaño de petición cacheable | 25 MB |
| TTL de caché | De 60 segundos a 1 mes |
| Metadatos por petición | 5 |
| Reintentos | Hasta 5, con un retraso de hasta 60 s |
| Reglas de límite de gasto | 20 por gateway |
| Unified Billing | 200 peticiones por 60 s por gateway (no aplica a BYOK) |
| Trabajos de Logpush | 4 por cuenta, 1 MB por log |

Precios:

- **Gratis**: analítica, caché, rate limiting y DLP.
- **Logs**: si tu cuenta creó su primer gateway desde el 24 de septiembre de 2026, siguen los precios y la retención de Workers Logs. Si es anterior, usa Legacy Logs: 100.000 logs en total en Workers Free y 10 millones por gateway en Workers Paid.
- **Guardrails**: se factura como inferencia de Workers AI.
- **Unified Billing**: un 5 % sobre los créditos comprados (100 $ cuestan 105 $). El precio por token es el del proveedor, sin recargo.
- **Logpush**: se cobra con la tarifa de Logpush.

Nada de AI Gateway es exclusivo de Enterprise.

## Documentación oficial

- [AI Gateway: visión general](https://developers.cloudflare.com/ai-gateway/) y [primeros pasos](https://developers.cloudflare.com/ai-gateway/get-started/)
- [API REST unificada](https://developers.cloudflare.com/ai-gateway/usage/rest-api/) y [binding de Workers](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/)
- [Caché](https://developers.cloudflare.com/ai-gateway/features/caching/), [rate limiting](https://developers.cloudflare.com/ai-gateway/features/rate-limiting/) y [límites de gasto](https://developers.cloudflare.com/ai-gateway/features/spend-limits/)
- [Gestionar gateways y reintentos](https://developers.cloudflare.com/ai-gateway/configuration/manage-gateway/) y [timeouts y reintentos por petición](https://developers.cloudflare.com/ai-gateway/configuration/request-handling/)
- [Alias de modelos](https://developers.cloudflare.com/ai-gateway/features/routing/model-aliases/) y [rutas dinámicas](https://developers.cloudflare.com/ai-gateway/features/routing/dynamic-routing/)
- [Guardrails](https://developers.cloudflare.com/ai-gateway/features/guardrails/) y [DLP](https://developers.cloudflare.com/ai-gateway/features/dlp/)
- [Autenticación](https://developers.cloudflare.com/ai-gateway/configuration/authentication/), [BYOK](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/) y [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/)
- [Logs](https://developers.cloudflare.com/ai-gateway/observability/logging/) y [glosario de cabeceras](https://developers.cloudflare.com/ai-gateway/glossary/)
- [Límites](https://developers.cloudflare.com/ai-gateway/reference/limits/), [precios](https://developers.cloudflare.com/ai-gateway/reference/pricing/) y [changelog](https://developers.cloudflare.com/ai-gateway/changelog/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Vectorize y AI Search.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Rate limiting en Cloudflare: limitar peticiones sin bloquear a tus usuarios](/blog/cloudflare-rate-limiting-guia)
- [Workers KV: almacenamiento clave-valor en el borde](/blog/cloudflare-kv-guia)
