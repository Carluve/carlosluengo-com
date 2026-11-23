---
publishDate: 2026-07-28T09:00:00Z
draft: false
image: 'media:blog/cloudflare-seguridad-cliente-guia/portada.png'
title: 'Seguridad del lado del cliente en Cloudflare: scripts, cookies y PCI DSS 4.0'
excerpt: 'Serie Cloudflare, parte 30. Qué hace la seguridad del lado del cliente (antes Page Shield), cómo vigila los scripts que carga el navegador de tus visitantes, qué incluye el plan Free, qué necesitas para los requisitos 6.4.3 y 11.6.1 de PCI DSS 4.0 y cómo montar tu propio receptor de informes CSP.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'seguridad'
  - 'csp'
  - 'pci dss'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 30 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

El [WAF](/blog/cloudflare-waf-guia), la [protección DDoS](/blog/cloudflare-ddos-guia) y la [gestión de bots](/blog/cloudflare-bots-guia) miran lo que llega a tu origen. Pero parte de tu web se ejecuta en el navegador de cada visitante: tu JavaScript, la analítica, el chat, la pasarela de pago. Si alguien compromete uno de esos scripts, puede leer lo que el usuario teclea sin que tu origen note nada.

## Qué es

La **seguridad del lado del cliente** (*client-side security*) es el producto de Cloudflare que vigila esos recursos. Hasta marzo de 2026 se llamaba **Page Shield**; las antiguas *policies* ahora se llaman **reglas de seguridad de contenido** (*content security rules*). La API y Terraform siguen usando el nombre antiguo (`page_shield`).

Tiene cuatro piezas:

- **Monitor de scripts.** Inventario de los scripts que cargan tus páginas, propios y de terceros.
- **Monitor de conexiones.** A qué dominios envían datos esos scripts.
- **Monitor de cookies.** Qué cookies aparecen en el tráfico HTTP, las ponga tu origen o el navegador.
- **Reglas de seguridad de contenido.** Una lista de recursos permitidos que Cloudflare convierte en cabeceras CSP (*Content Security Policy*) para registrar o bloquear lo que no esté en ella.

Además hay **alertas** y, con el complemento de pago **Client-Side Security Advanced**, detección de scripts maliciosos y de cambios en el código.

## Casos de uso

- **Saber qué se ejecuta en tu web.** Suelen aparecer scripts que nadie recuerda haber puesto.
- **Detectar ataques tipo Magecart**: código inyectado en la página de pago que copia la tarjeta y la envía a otro dominio.
- **Cumplir PCI DSS 4.0** (requisitos 6.4.3 y 11.6.1) si tienes una página de pago.
- **Desplegar una CSP sin romper la web**, probándola primero en modo *Log*.

## Arquitectura

![Flujo de la seguridad del lado del cliente: el origen responde con HTML, el borde de Cloudflare añade la cabecera content-security-policy-report-only a una muestra de respuestas (y content-security-policy si hay reglas), el navegador carga scripts propios y de terceros y envía informes de violación que alimentan el inventario de Client-side resources y las notificaciones; debajo, tabla de disponibilidad por plan y relación con PCI DSS 4.0](media:blog/cloudflare-seguridad-cliente-guia/00-arquitectura.png)

Cloudflare no ejecuta tus páginas: le pide al navegador que le cuente qué carga.

1. Tu origen responde con una página HTML.
2. El borde añade a **una muestra** de esas respuestas una cabecera `content-security-policy-report-only` como esta:

   ```
   content-security-policy-report-only: script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; report-uri https://csp-reporting.cloudflare.com/cdn-cgi/script_monitor/report?<QUERY_STRING>
   ```

3. La cabecera **no bloquea nada**, pero hace que el navegador envíe un informe de violación por cada script y cada conexión. Con ellos, Cloudflare construye el inventario. Las cookies las ve directamente en el tráfico HTTP.

Las **reglas de seguridad de contenido** usan el mismo mecanismo con tus directivas. Una regla en **Log** añade `content-security-policy-report-only`; en **Allow**, `content-security-policy`, que el navegador aplica. Van en todas las respuestas que cumplen la expresión de la regla, **sin muestreo**.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Activa el monitor de scripts

**Security › Settings**, filtra por **Client-side abuse** y activa **Continuous script monitoring**. Está disponible en todos los planes, Free incluido, desde septiembre de 2024.

![Web assets › Client-side resources: monitor de scripts de la zona, todavía sin scripts detectados](media:blog/cloudflare-seguridad-cliente-guia/01-panel.png)

En **Configurations**, **Data processing** decide si se registra solo el host de cada conexión (por defecto) o la URI completa. Con la URI completa, un ID de sesión que vaya en ella queda en claro en el panel: déjalo en *host only*. Con Advanced puedes enviar los informes a tu propio hostname (**Reporting endpoint**).

Por el muestreo, una web con poco tráfico tarda más en llenar el inventario.

### 2. Revisa el inventario

**Security › Web assets › Client-side resources**. En Free y Pro solo verás **Scripts**. En Business y Enterprise aparecen también **Connections** y **Cookies**, con la página donde se vio cada recurso por primera vez y las diez más recientes.

Un recurso con menos de tres informes es **Infrequent**; con más, **Active**; tras siete días sin aparecer, **Inactive**, y se borra a los 30. Busca dominios que no sean tuyos ni de tus proveedores.

### 3. Configura alertas

Las alertas se crean a nivel de cuenta: **Notifications › Add**, producto **Client-side security (formerly Page Shield)**.

Los tipos disponibles dependen del plan:

| Alerta | Cuándo salta | Necesita |
|---|---|---|
| New Resources Alert | Recursos nuevos en tu dominio (resumen diario) | Business o superior |
| New Domain Alert | Recursos de un dominio nuevo (cada hora) | Business o superior |
| New Code Change Detection Alert | Cambia el código de un script ya conocido (diaria) | Advanced |
| New Malicious Script / URL / Domain Alert | Un recurso se clasifica como malicioso | Advanced |

Con un filtro de zonas (Advanced), las alertas saltan al momento. En Free no hay alertas; el receptor de informes de más abajo es una alternativa casera.

### 4. Reglas de seguridad de contenido (Advanced)

**Security › Security rules › Create › Content security rules**. Defines:

- **Cuándo aplica** (*If incoming requests match*): por ejemplo, la ruta `/checkout`.
- **Qué directivas permites** (*Allow these directives*): scripts, conexiones, valor por defecto… **Refresh suggestions** propone orígenes a partir de lo que ha visto el monitor.
- **Qué hace** (*Then take action*): **Log** registra las violaciones sin bloquear; **Allow** aplica la lista y bloquea lo demás.

Cloudflare recomienda dejar la regla en **Log al menos siete días** antes de pasarla a **Allow**, cambiar una regla cada vez y probar en Chrome, Firefox, Safari y Edge. Si algo se rompe, vuelve a **Log**.

Ojo con las CSP duplicadas: si tu origen ya envía una, o una Transform Rule la **añade** (*Add*), el navegador aplica todas y gana la más restrictiva. Tras una URL Rewrite Rule, usa `raw.http.request.uri.path` para la ruta original.

### Lo mismo, como código

Activar el monitor con la API (permiso *Page Shield* o *Zone Settings Write* en el token):

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/page_shield" \
  --request PUT \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{ "enabled": true }'
```

El inventario se lee con `GET /zones/$ZONE_ID/page_shield/scripts`.

Una regla de seguridad de contenido con el proveedor de Terraform v5 (requiere Advanced). Empieza en `log`:

```hcl
resource "cloudflare_page_shield_policy" "checkout" {
  zone_id     = var.zone_id
  description = "CSP de la página de pago"
  action      = "log" # pásala a "allow" tras validarla
  enabled     = true
  expression  = "starts_with(http.request.uri.path, \"/checkout\")"
  value       = "script-src 'self' js.stripe.com; connect-src 'self' api.stripe.com"
}
```

El valor es una CSP normal. Los dominios de Stripe son solo un ejemplo: pon los que indique la documentación de tu proveedor de pago.

#### Sin Advanced: tu propio receptor de informes

Pon una CSP *report-only* en tu origen y recoge los informes con un Worker. El navegador envía un `POST` con `Content-Type: application/csp-report` y un JSON con la clave `csp-report`. Cualquiera puede enviar basura a ese endpoint, así que el Worker lo valida todo:

```js
const MAX_BYTES = 16 * 1024;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/csp-report") return new Response("Not found", { status: 404 });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("application/csp-report") && !type.startsWith("application/json")) {
      return new Response("Unsupported media type", { status: 415 });
    }

    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BYTES) return new Response("Payload too large", { status: 413 });
      body = JSON.parse(text);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const report = body && typeof body === "object" ? body["csp-report"] : null;
    if (!report || typeof report !== "object") {
      return new Response("Missing csp-report", { status: 400 });
    }

    const pick = (v) => (typeof v === "string" ? v.slice(0, 500) : null);
    const entry = {
      documentUri: pick(report["document-uri"]),
      directive: pick(report["violated-directive"]),
      blockedUri: pick(report["blocked-uri"]),
    };
    if (!entry.directive) return new Response("Invalid report", { status: 400 });

    console.log(JSON.stringify({ type: "csp-violation", ...entry }));
    return new Response(null, { status: 204 });
  },
};
```

Activa los logs del Worker (`"observability": { "enabled": true }` en `wrangler.jsonc`) y busca `csp-violation`. Recortar los campos evita que te llenen los logs.

## Cómo comprobarlo

Con `curl` ves la cabecera, pero no genera informes: no ejecuta scripts.

```bash
curl -sI https://www.example.com/ | grep -i content-security-policy
```

Como va en una muestra, quizá tengas que repetir la petición. Cloudflare también puede omitirla en tráfico que considera automatizado.

En el navegador, abre las herramientas de desarrollo, pestaña **Network**, recarga y busca `content-security-policy-report-only` en la respuesta HTML. Los avisos *[Report Only] Refused to execute inline script* de la consola son normales. Si la cabecera no aparece nunca, revisa que el registro DNS esté «con proxy» y que ninguna Transform Rule toque las cabeceras CSP.

## Límites y precios

| | Free y Pro | Business y Enterprise | Advanced |
|---|---|---|---|
| Monitor de scripts | ✓ | ✓ | ✓ |
| Conexiones, cookies, página de origen | — | ✓ | ✓ |
| Alertas de recursos y dominios nuevos | — | ✓ | ✓ |
| Detección de scripts y conexiones maliciosas | — | — | ✓ |
| Detección de cambios de código | — | — | ✓ |
| Campos avanzados de cookies y exportar CSV | — | — | ✓ |
| Reglas de seguridad de contenido | 0 | 0 | 5 |
| Trabajos de Logpush | 0 | 0 | 4 |

- **Advanced** es el antiguo complemento de Page Shield. Enterprise sin él equivale a Business.
- La detección maliciosa puntúa cada versión de un script de 1 (malicioso) a 99 (limpio); por debajo de 10, es malicioso. Solo analiza scripts de hasta 300 KB.
- Desactivar el monitor **no** desactiva las reglas de seguridad de contenido.

**PCI DSS 4.0.** Añadió dos requisitos para los scripts que se ejecutan en el navegador en las páginas de pago:

| Requisito | Qué pide | Qué aporta Cloudflare |
|---|---|---|
| **6.4.3** | Inventario de todos los scripts de la página de pago, con autorización e integridad comprobadas | Monitor de scripts, reglas de seguridad de contenido como lista autorizada |
| **11.6.1** | Detectar y alertar de cambios no autorizados en las cabeceras HTTP de seguridad y en el contenido de la página de pago | Detección de cambios de código y alertas |

Según la documentación de Cloudflare, **para estos requisitos necesitas Advanced**. El monitor del plan Free da visibilidad, pero no detecta cambios ni aplica reglas. Tu QSA tiene la última palabra.

## Documentación oficial

- [Seguridad del lado del cliente: visión general y disponibilidad](https://developers.cloudflare.com/client-side-security/) y [primeros pasos](https://developers.cloudflare.com/client-side-security/get-started/)
- [Cómo funciona](https://developers.cloudflare.com/client-side-security/how-it-works/) y [la cabecera CSP](https://developers.cloudflare.com/client-side-security/reference/csp-header/)
- [Monitorizar recursos y cookies](https://developers.cloudflare.com/client-side-security/detection/monitor-connections-scripts/) y [estados de los scripts](https://developers.cloudflare.com/client-side-security/reference/script-statuses/)
- [Detección de scripts maliciosos](https://developers.cloudflare.com/client-side-security/how-it-works/malicious-script-detection/)
- [Tipos de alerta](https://developers.cloudflare.com/client-side-security/alerts/alert-types/)
- [Reglas de seguridad de contenido](https://developers.cloudflare.com/client-side-security/rules/), [crearlas en el panel](https://developers.cloudflare.com/client-side-security/rules/create-dashboard/) y [desplegarlas en producción](https://developers.cloudflare.com/client-side-security/best-practices/deploy-rules-in-production/)
- [Ajustes](https://developers.cloudflare.com/client-side-security/reference/settings/), [API](https://developers.cloudflare.com/client-side-security/reference/api/) y [solución de problemas](https://developers.cloudflare.com/client-side-security/troubleshooting/)
- [PCI DSS y seguridad del lado del cliente](https://developers.cloudflare.com/client-side-security/reference/pci-dss/)
- [Notas de versión](https://developers.cloudflare.com/client-side-security/release-notes/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Load Balancing: conmutación por error entre orígenes.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [SSL/TLS en Cloudflare: certificados de borde, Origin CA y modos de cifrado](/blog/cloudflare-ssl-tls-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
