---
publishDate: 2026-09-15T09:00:00Z
draft: false
image: 'media:blog/cloudflare-ai-crawl-control-guia/portada.png'
title: 'AI Crawl Control: qué crawlers de IA leen tu web y cómo cobrarles'
excerpt: 'Serie Cloudflare, parte 37. Qué crawlers de IA visitan tu web, cómo permitir o bloquear cada uno, cómo vigilar quién se salta tu robots.txt, en qué punto está el pago por rastreo (HTTP 402) y qué es Web Bot Auth.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'ia'
  - 'bots'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 37 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En la [parte 8](/blog/cloudflare-bots-guia) vimos las políticas generales para el tráfico de IA. Este post baja a cada crawler: quién entra, quién ignora tu `robots.txt` y, si quieres, cuánto le cobras.

## Qué es

**AI Crawl Control** (antes **AI Audit**) es el panel de Cloudflare para el tráfico de crawlers de IA. Funciona en cualquier zona con proxy y en todos los planes, sin configurar nada. Hace cuatro cosas:

- **Ver** qué crawlers de IA piden tu contenido, qué rutas leen y cuánto consumen.
- **Decidir** por crawler: **Allow** o **Block**. El bloqueo se aplica con una regla del [WAF](/blog/cloudflare-waf-guia).
- **Vigilar tu `robots.txt`**: si existe, si lleva Content Signals y qué crawlers piden rutas que tienes prohibidas.
- **Cobrar** (*pay per crawl*): el crawler recibe un `402 Payment Required` con el precio y, si acepta pagar, la página. Está en **beta privada**.

**Detección.** En Free, AI Crawl Control reconoce a los crawlers por su *User-Agent*. Ve los conocidos que se identifican, no a los que se disfrazan. Con Bot Management (Enterprise) usa además los *detection IDs*, que Cloudflare verifica.

## Casos de uso

- **Saber qué pasa** antes de bloquear nada: quién entra, qué lee y cuánto consume.
- **Quedarte con la IA que te trae visitas.** Permites los crawlers de búsqueda y asistentes que citan y enlazan, y bloqueas los que solo entrenan modelos.
- **Señalar a quien se salta tu `robots.txt`** y decidir si bloquearlo.
- **Negociar**: en planes de pago, el bloqueo puede devolver un `402` con tu contacto.
- **Monetizar** contenido con valor con pay per crawl, si entras en la beta.

## Arquitectura

![Recorrido de un crawler de IA: identificación, regla WAF de AI Crawl Control, soluciones de bots, pay per crawl y origen, con una tabla de acciones Allow, Block y Charge](media:blog/cloudflare-ai-crawl-control-guia/00-arquitectura.png)

1. **Identificación.** Cloudflare decide si la petición viene de un crawler de IA conocido: por *User-Agent*, por *detection ID* con Bot Management o por una firma criptográfica **Web Bot Auth**.
2. **Reglas personalizadas del WAF.** Si bloqueas uno o más crawlers, AI Crawl Control crea **una sola** regla personalizada llamada *AI Crawl Control* con todos ellos. Ocupa un hueco de tus reglas (cinco en Free). Si todo está en Allow, no usa ninguna.
3. **Soluciones de bots**: las políticas de IA y Bot Fight Mode de la [parte 8](/blog/cloudflare-bots-guia).
4. **Pay per crawl**, al final. Por eso un bloqueo del WAF gana siempre: un crawler bloqueado por país o por otra regla no entra aunque quiera pagar.

Cuidado con el orden: la regla *AI Crawl Control* se añade **al final** de tus reglas personalizadas. Una regla anterior con *Skip*, una Redirect Rule o una Transform Rule puede dejar pasar a un crawler bloqueado. Si quieres que mande, súbela. Y al revés: un crawler en **Allow** puede seguir bloqueado por una regla tuya anterior.

### Pay per crawl, por dentro

A un crawler en **Charge**, Cloudflare le responde:

```txt
HTTP/2 402
crawler-price: USD 0.01
```

El crawler repite la petición con `crawler-exact-price` (el precio exacto) o `crawler-max-price` (lo máximo que está dispuesto a pagar), firmada con Web Bot Auth y con esa cabecera dentro de la firma. Si todo cuadra, recibe un `200` con `crawler-charged: USD 0.01`. Cloudflare actúa como *Merchant of Record* y paga al dueño del sitio a través de Stripe.

Reglas del juego:

- Un único precio por zona, igual para todos los crawlers en Charge. Mínimo: 0,001 USD por petición.
- Solo se cobran respuestas correctas, nunca los errores. Volver a pedir la misma página se cobra otra vez.
- `/robots.txt`, `/sitemap.xml`, `/security.txt`, `/.well-known/security.txt` y `/crawlers.json` son siempre gratis.
- Con **precio dinámico**, tu origen o un Worker devuelve `crawler-price` por página. Con una Configuration Rule (**Disable Pay Per Crawl**) dejas secciones gratis.

### Web Bot Auth

El *User-Agent* se puede falsificar. Con **Web Bot Auth** el bot firma cada petición con una clave Ed25519 (cabeceras `Signature`, `Signature-Input` y `Signature-Agent`) y publica sus claves públicas en `/.well-known/http-message-signatures-directory`. Cloudflare verifica la firma en el borde.

Es obligatorio para pagar en pay per crawl. Desde el 1 de julio de 2026 ya no existe la categoría aparte de *signed agents*: los agentes que firman con Web Bot Auth son **bots verificados** con la etiqueta *intermediary* (los que maneja cualquier usuario final, como un agente de navegador). Los de un único operador llevan la etiqueta *direct*.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Revisa el resumen y tu robots.txt

**AI Crawl Control** está en el menú de la zona. Se abre en **Overview**: volumen, códigos de estado, rutas más pedidas y crawlers agrupados por empresa. En Free la ventana máxima es de 24 horas.

Después, la pestaña **Directives** (antes *Robots.txt*):

- Una tarjeta indica si el `robots.txt` gestionado está activo. Se activa desde **Security › Settings**, como vimos en la [parte 8](/blog/cloudflare-bots-guia).
- La tabla de disponibilidad muestra el código de estado de cada `robots.txt` y si lleva **Content Signals**.
- La tabla de **violaciones** lista crawlers que pidieron rutas que tu `robots.txt` prohíbe. Compara con tu `robots.txt` **actual**: Si añades un `Disallow` hoy, las peticiones antiguas a esa ruta salen como violaciones.
- **Check readiness score** evalúa tu web para agentes de IA con isitagentready.com.

![AI Crawl Control › Security: rastreadores de IA y de buscadores con categoría, bytes transferidos, peticiones permitidas y fallidas y el interruptor para bloquear cada uno](media:blog/cloudflare-ai-crawl-control-guia/01-panel.png)

### 2. Permite o bloquea crawler a crawler

En la pestaña **Crawlers**, cada fila es un crawler con su operador, peticiones y datos transferidos. En la columna **Action** eliges **Allow** o **Block**. Puedes filtrar por nombre, operador o categoría (crawler de IA, asistente, búsqueda…).

Pautas:

- **No bloquees buscadores por accidente.** Usa la columna de categoría. Bloquear o cobrar a un crawler de búsqueda puede hundir tu SEO.
- **Distingue entrenamiento de asistentes.** `GPTBot` o `CCBot` entrenan modelos; `ChatGPT-User` o `Claude-User` leen una página porque alguien lo pidió.
- **Mira la regla que se crea** en **Security › Security rules**. Desde marzo de 2026 puedes ampliarla en el WAF (excepciones por ruta, más *User-Agents*) y AI Crawl Control conserva esos cambios, aunque no los muestra en su panel.
- **En planes de pago**, en **Settings › Block response** eliges `403 Forbidden` o `402 Payment Required` y escribes el cuerpo de la respuesta.

### 3. Pay per crawl (si entras en la beta)

Es beta privada: se pide acceso con el formulario de Cloudflare o, si eres Enterprise, a tu equipo de cuentas. Una vez dentro:

1. Un administrador de la cuenta va a **Manage Account › Configurations › Pay Per Crawl** y pone **Visible** los dominios. Eso solo enseña los controles, no cambia la seguridad.
2. En la zona, **AI Crawl Control › Payments**, activas pay per crawl y fijas el precio por defecto.
3. En **Crawlers**, pones **Charge** a los que quieras cobrar.
4. Conectas Stripe para los pagos. El saldo acumulado todavía no se ve en el panel.

### 4. Si el bot eres tú: regístralo con Web Bot Auth

Si tienes un crawler o agente propio y quieres que sea verificado (o pagar en pay per crawl), en **Manage Account › Configurations › Bot Submission Form** eliges el tipo de bot, el método **Request Signature** y la URL de tu directorio de claves. Puedes probar tus firmas contra `https://crawltest.com/cdn-cgi/web-bot-auth`: responde `200` si la clave es conocida y la firma vale, `401` si la clave no está registrada o la firma falla y `400` si el mensaje está mal formado.

### Lo mismo, como código

El bloqueo de AI Crawl Control es una regla personalizada del WAF. Si gestionas esa fase con Terraform (proveedor v5), escribe tú la regla, por ejemplo con una excepción para `/prensa/`:

```hcl
resource "cloudflare_ruleset" "waf_custom" {
  zone_id = var.zone_id
  name    = "Reglas personalizadas"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules = [{
    ref         = "bloquear_crawlers_entrenamiento"
    description = "Crawlers de entrenamiento fuera, salvo /prensa/"
    expression  = "(http.user_agent contains \"GPTBot\" or http.user_agent contains \"CCBot\" or http.user_agent contains \"Bytespider\") and not starts_with(http.request.uri.path, \"/prensa/\")"
    action      = "block"
  }]
}
```

Elige panel o Terraform, no ambos: este recurso controla **todas** las reglas de la fase y borraría la regla *AI Crawl Control*. El token necesita *Zone WAF: Edit*.

Con precio dinámico, un [Worker](/blog/cloudflare-workers-guia) delante del origen pone precio por sección. La cabecera `cf-pay-per-crawl` le dice el modo:

```js
// Precio por prefijo de ruta. Lo que no encaje usa el precio por defecto de la zona.
const PRECIOS = [
  { prefijo: "/informes/", usd: 0.05 },
  { prefijo: "/blog/", usd: 0.01 },
];

export default {
  async fetch(request) {
    const respuesta = await fetch(request);

    // La cabecera puede no venir (tráfico humano, función desactivada).
    const modo = request.headers.get("cf-pay-per-crawl");
    if (!modo || !/\bpricing=in-band\b/.test(modo)) return respuesta;

    // Solo tiene sentido poner precio a respuestas correctas.
    if (!respuesta.ok) return respuesta;

    const { pathname } = new URL(request.url);
    const regla = PRECIOS.find((p) => pathname.startsWith(p.prefijo));
    if (!regla) return respuesta;

    const conPrecio = new Response(respuesta.body, respuesta);
    conPrecio.headers.set("crawler-price", `USD ${regla.usd.toFixed(2)}`);
    return conPrecio;
  },
};
```

La cabecera `crawler-price` solo llega al crawler cuando se le pide pagar. Los Snippets ven `cf-pay-per-crawl`, pero no sirven para fijar el precio.

## Cómo comprobarlo

Con un crawler en **Block**, simula su *User-Agent* (en Free la detección es por *User-Agent*):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -A "CCBot/2.0" https://www.example.com/
# 403
```

Con Bot Management la detección no se fía del *User-Agent* y esta prueba puede no reproducirse.

Los mismos datos salen por la API GraphQL. El token necesita *Zone Analytics: Read* y va en una variable de entorno, nunca en el script:

```bash
jq -n --arg zona "$ZONE_ID" '{
  query: "query ($zona: string) { viewer { zones(filter: {zoneTag: $zona}) { httpRequestsAdaptiveGroups(filter: {datetime_geq: \"2026-11-22T00:00:00Z\", datetime_leq: \"2026-11-23T00:00:00Z\", requestSource: \"eyeball\", userAgent_like: \"%GPTBot%\"}, limit: 100, orderBy: [count_DESC]) { count dimensions { clientRequestPath } } } } }",
  variables: { zona: $zona }
}' | curl -s https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @- | jq '.errors // .data.viewer.zones[0].httpRequestsAdaptiveGroups'
```

Devuelve las rutas que más pidió GPTBot ese día, o los errores si algo falla.

## Límites y precios

AI Crawl Control no tiene coste en ningún plan. Lo que cambia con Bot Management:

| | Resto de planes | Solo Enterprise (con Bot Management) |
|---|---|---|
| Detección | Por *User-Agent* | *Detection IDs* verificados |
| Ventana de analítica | Máximo 24 horas | Configurable |

- **Charge** (pay per crawl): beta privada, con acceso bajo solicitud.
- **Respuesta propia al bloquear** (403 o 402 con texto) y **referencias** desde plataformas de IA en la analítica: planes de pago.
- El bloqueo gasta **una** regla personalizada del WAF, sea cual sea el número de crawlers bloqueados.
- El rol **AI Crawl Control Read Only** da acceso de solo lectura a una zona.

## Documentación oficial

- [AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/) y [primeros pasos](https://developers.cloudflare.com/ai-crawl-control/get-started/)
- [Gestionar crawlers](https://developers.cloudflare.com/ai-crawl-control/features/manage-ai-crawlers/) y [analizar el tráfico de IA](https://developers.cloudflare.com/ai-crawl-control/features/analyze-ai-traffic/)
- [Directivas y robots.txt](https://developers.cloudflare.com/ai-crawl-control/features/track-robots-txt/) y [robots.txt gestionado](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)
- [AI Crawl Control con el WAF](https://developers.cloudflare.com/ai-crawl-control/configuration/ai-crawl-control-with-waf/)
- [Qué es pay per crawl](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/what-is-pay-per-crawl/), [fijar el precio](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/use-pay-per-crawl-as-site-owner/set-a-pay-per-crawl-price/), [configuración avanzada](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/use-pay-per-crawl-as-site-owner/advanced-configuration/) y [preguntas frecuentes](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/faq/)
- [Web Bot Auth](https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/) y [bots verificados](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/)
- [Referencia de crawlers](https://developers.cloudflare.com/ai-crawl-control/reference/bots/) y [API GraphQL](https://developers.cloudflare.com/ai-crawl-control/reference/graphql-api/)
- [Changelog de AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/changelog/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Browser Isolation, navegación aislada.

## También te puede interesar

- [Bots en Cloudflare: Bot Fight Mode, Super Bot Fight Mode y bots verificados](/blog/cloudflare-bots-guia)
- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
