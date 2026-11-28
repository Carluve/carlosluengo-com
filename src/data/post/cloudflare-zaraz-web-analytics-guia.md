---
publishDate: 2026-11-27T09:00:00Z
draft: false
image: 'media:blog/cloudflare-zaraz-web-analytics-guia/portada.png'
title: 'Zaraz y Web Analytics en Cloudflare: analítica sin cookies y etiquetas de terceros en el borde'
excerpt: 'Serie Cloudflare, parte 50. Cómo medir visitas y Core Web Vitals con Web Analytics sin cookies, cómo sacar Google Analytics y otros píxeles del navegador con Zaraz, cómo montar el gestor de consentimiento y cuánto cuesta cada cosa.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'zaraz'
  - 'web analytics'
  - 'privacidad'
  - 'rendimiento'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 50 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Cerramos la serie dentro del navegador. Tu tráfico ya pasa por Cloudflare ([DNS](/blog/cloudflare-dns-dnssec-guia)), se sirve desde la caché ([CDN](/blog/cloudflare-cdn-cache-guia)) y está protegido ([WAF](/blog/cloudflare-waf-guia)). Falta saber quién la visita, qué tal le carga y qué hacer con los scripts de terceros que la frenan.

## Qué es

**Web Analytics** es la analítica de Cloudflare basada en un *beacon* de JavaScript (`beacon.min.js`). Mide visitas, páginas vistas, tiempo de carga y Core Web Vitals (LCP, INP y CLS) con datos de usuarios reales. No usa cookies ni `localStorage` y no identifica a personas por IP ni por *user agent*. Es gratis y funciona aunque tu web no pase por el proxy de Cloudflare.

**Zaraz** es un gestor de etiquetas (*tag manager*) que ejecuta las herramientas de terceros (Google Analytics 4, píxeles de anuncios, HTML personalizado) en el borde de Cloudflare en vez de en el navegador. La página solo carga un script pequeño que envía los eventos al borde. Incluye un gestor de consentimiento (CMP) para el RGPD.

## Casos de uso

- **Analítica sin cookies.** Si solo necesitas visitas, referentes y páginas más vistas, Web Analytics puede bastarte.
- **Saber por qué una página va lenta.** El informe de Core Web Vitals te dice qué elemento empeora el LCP, el INP o el CLS, y desde octubre de 2026 desglosa LCP e INP en sus fases.
- **Quitar peso del navegador.** Mover GA4 o un píxel a Zaraz saca sus scripts de la página y descarga el hilo principal, que es lo que penaliza el INP.
- **Consentimiento en un solo sitio.** El CMP de Zaraz no carga una herramienta hasta que el visitante acepta su finalidad.
- **Eventos desde el servidor.** La HTTP Events API recibe eventos de tu backend o tu app (una compra, un alta).

## Arquitectura

![Flujo de Web Analytics y Zaraz: el visitante pide la página, el borde de Cloudflare inyecta beacon.min.js y el script de Zaraz; el beacon manda métricas a /cdn-cgi/rum y Zaraz manda eventos al borde, que comprueba el consentimiento y llama a GA4, píxeles y webhooks desde el servidor; debajo, tabla comparativa de ambos productos](media:blog/cloudflare-zaraz-web-analytics-guia/00-arquitectura.png)

Con la zona **con proxy** (nube naranja), el flujo es este:

1. El visitante pide una página HTML. Al pasar por el borde, Cloudflare **inyecta** dos scripts si los tienes activos: el *beacon* de Web Analytics y el de Zaraz (`/cdn-cgi/zaraz/i.js`).
2. El *beacon* mide la carga con las APIs de rendimiento del navegador y envía los datos a `https://tu-dominio/cdn-cgi/rum`. Las Core Web Vitals se envían cuando la pestaña pasa a oculta por primera vez.
3. El script de Zaraz manda al borde cada evento: la página vista automática, tus `zaraz.track()` y los disparadores (clics, formularios, temporizadores).
4. En el borde, Zaraz aplica el consentimiento, los ajustes de privacidad y las acciones de cada herramienta, y hace las peticiones a terceros **desde el servidor**.

Sin proxy, Web Analytics funciona pegando el *snippet* a mano (envía a `cloudflareinsights.com`) y Zaraz necesita un subdominio con proxy desde el que cargar `i.js`.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Activa Web Analytics

En el panel de la cuenta, **Web Analytics › Add a site**. Si la zona tiene proxy, eliges el hostname en el desplegable y pulsas **Done**. La instalación automática queda activada.

![Zaraz (Web tag management): herramientas del lado del servidor, gestión del consentimiento, disparadores y variables, y catálogo de herramientas para añadir](media:blog/cloudflare-zaraz-web-analytics-guia/01-panel.png)

En **Manage site** puedes cambiar el modo:

- **Enable**: inyección automática en todas las páginas de la zona.
- **Enable, excluding visitor data in the EU**: no inyecta el *beacon* a visitantes de la UE.
- **Enable with JS Snippet installation**: lo pegas tú.
- **Disable**.

Si la web no pasa por Cloudflare, escribe el hostname, copia el *snippet* y pégalo antes de `</body>`:

```html
<script
  type="module"
  src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token": "TU_SITE_TOKEN"}'
></script>
```

El token de sitio no es secreto (va en el HTML), pero solo vale para su dominio: el *beacon* valida el hostname.

Tres cosas que rompen la inyección automática:

- Una cabecera `Cache-Control: public, no-transform` en el origen: Cloudflare no puede modificar el HTML.
- HTML no válido (sin `<head>`, por ejemplo).
- Una CSP que no permita el script. Añade `https://static.cloudflareinsights.com/beacon.min.js` a `script-src` y `'self'` a `connect-src` (o `cloudflareinsights.com` si lo instalas a mano).

### 2. Añade una herramienta a Zaraz

Zaraz está en la cuenta, en **Tag management › Tag setup**, y se configura por zona. Eliges la zona, pulsas **Add new tool** y escoges del catálogo.

Cada herramienta pide sus datos (el ID de medición en GA4, por ejemplo) y sus **acciones**. Si admite acciones automáticas, marcas **Pageviews**, **Events** o **E-commerce**. Si no, creas acciones y **disparadores**:

| Tipo de regla | Para qué |
|---|---|
| Match rule | Comparar una variable (nombre del evento, ruta, cookie) con un texto |
| Click listener | Clics por selector CSS o XPath |
| Form submission | Envíos de un formulario, con validación opcional |
| Timer | Disparar tras un intervalo |

Si un disparador usa la ruta u otra propiedad de la página, añade la regla `Event Name` igual a `Pageview`; si no, saltará con todos los eventos de esa página.

En **Settings** están los ajustes de privacidad (quitar parámetros de la URL, recortar IPs, limpiar el *user agent*) y la **Debug Key**, que es privada.

### 3. Activa el consentimiento

**Tag management › Consent › Enable Consent Management**. Escribe el texto legal del modal, crea las **finalidades** (*purposes*) y asigna cada herramienta a una.

Lo importante:

- **Una herramienta nueva no tiene finalidad y se carga sin consentimiento.** Revisa esta página cada vez que añadas una.
- Las finalidades sin herramientas no aparecen en el modal.
- Los eventos pendientes se envían si el visitante acepta. La elección va en una cookie propia (`cf_consent` por defecto).
- Hay un modo opcional compatible con IAB TCF (CMP ID 433) y soporte de Google Consent Mode v2.

Cloudflare no asigna finalidades por ti. Que la configuración cumpla el RGPD es responsabilidad tuya.

### Lo mismo, como código

**Eventos desde el navegador.** Un botón registra una descarga y otro reabre el modal de consentimiento. Antes se comprueba que Zaraz esté cargado:

```html
<button id="descargar" data-archivo="guia.pdf">Descargar la guía</button>
<button id="privacidad">Preferencias de privacidad</button>

<script>
  document.getElementById("descargar").addEventListener("click", (e) => {
    const archivo = e.currentTarget.dataset.archivo;
    if (typeof archivo !== "string" || archivo.length === 0 || archivo.length > 100) return;
    if (window.zaraz && typeof zaraz.track === "function") {
      zaraz.track("descarga", { archivo });
    }
  });

  document.getElementById("privacidad").addEventListener("click", () => {
    if (window.zaraz && typeof zaraz.showConsentModal === "function") {
      zaraz.showConsentModal();
    }
  });
</script>
```

En Zaraz, crea un disparador *Match rule* con `Event Name` igual a `descarga` y, en la acción, `{{ client.archivo }}` para usar la propiedad.

**Eventos desde el servidor.** Primero activa la HTTP Events API en **Settings › Endpoints** con una ruta difícil de adivinar: la documentación no describe autenticación para este endpoint, así que cualquiera que conozca la ruta puede enviarle eventos. Este manejador usa la API Fetch estándar. Recibe el alta del formulario, valida el cuerpo y manda el evento a Zaraz:

```js
// La ruta va en una variable de entorno, no en el código.
const ZARAZ_URL = process.env.ZARAZ_EVENTS_URL; // p. ej. https://www.example.com/<ruta-secreta>
const PLANES = new Set(["free", "pro"]);

export async function handleAlta(request) {
  if (request.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON no válido" }, { status: 400 });
  }

  const plan = body?.plan;
  if (typeof plan !== "string" || !PLANES.has(plan)) {
    return Response.json({ error: "Plan no válido" }, { status: 400 });
  }

  // ... guarda el alta en tu base de datos ...

  if (!ZARAZ_URL) {
    return Response.json({ ok: true, analitica: "desactivada" });
  }

  try {
    const r = await fetch(ZARAZ_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        events: [{ client: { __zarazTrack: "alta", plan } }],
      }),
    });
    if (!r.ok) console.error("Zaraz respondió", r.status);
  } catch (err) {
    console.error("No se pudo enviar el evento a Zaraz", err);
  }

  return Response.json({ ok: true });
}
```

Solo envías valores de una lista cerrada, nunca el email. Y si falla la analítica, el alta no falla.

**Web Analytics con Terraform** (proveedor v5). El token necesita *Account Settings: Write*:

```hcl
resource "cloudflare_web_analytics_site" "web" {
  account_id   = var.account_id
  zone_tag     = var.zone_id
  auto_install = true
}
```

Para un sitio sin proxy, cambia `zone_tag` y `auto_install` por `host = "www.example.com"` y pega el `snippet` que devuelve el recurso. Con la API es `POST /accounts/{account_id}/rum/site_info`, con los mismos campos.

## Cómo comprobarlo

**Web Analytics.** Con la inyección automática, el HTML que sirve Cloudflare tiene que incluir el *beacon*:

```bash
curl -s https://www.example.com/ | grep -o 'static.cloudflareinsights.com/beacon.min.js'
```

En la pestaña Red del navegador debe aparecer un `POST` a `/cdn-cgi/rum`. Los datos tardan unos minutos en llegar al panel; el filtro **Exclude Bots** deja solo tráfico real.

**Zaraz.** En la consola del navegador escribe `zaraz`. Si responde `zaraz is not defined`, no se ha cargado: revisa que la zona tenga proxy, que **Auto-inject script** esté activo, que el HTML tenga `<head>` y que haya al menos una herramienta activa. Para ver eventos, disparadores y acciones en directo, copia la Debug Key de **Settings** y ejecuta en la consola:

```js
zaraz.debug("TU_DEBUG_KEY");
```

Se abre el depurador. Para salir, `zaraz.debug()`. En **Tag management › Monitoring** ves cargas, eventos, disparadores, acciones y los códigos de respuesta de las peticiones a terceros.

## Límites y precios

**Web Analytics** es gratis.

- Sitios **sin proxy**: hasta 10 por cuenta. Con proxy, sin límite.
- **Reglas** para medir solo ciertos hosts o rutas: no están en Free, que inyecta en todos los subdominios. En los planes de pago, el número de reglas depende del plan.
- Puedes consultar los datos de los **últimos seis meses**. Los primeros 7 días se guardan sin muestrear; después se agregan a alrededor del 10 %.
- Los bloqueadores de anuncios bloquean el *beacon*. La analítica del borde (pestaña Analytics de la zona) no depende de él.

**Zaraz** tiene todas las funciones en todos los planes. Se paga por **eventos**: una página vista, un `zaraz.track()` o similar.

| | Zaraz |
|---|---|
| Incluido | 1.000.000 de eventos al mes por cuenta |
| Zaraz Paid | 5 $ al mes por cada millón adicional |
| Sin Zaraz Paid | Avisos al 50, 80 y 90 %; al pasar del millón, Zaraz se desactiva hasta el siguiente ciclo |
| Logpush de eventos | Solo Enterprise |

En una SPA con **Single Page Application support** activo, cada cambio de ruta dispara una página vista. Vigila el consumo en **Monitoring**.

## Documentación oficial

- [Web Analytics](https://developers.cloudflare.com/web-analytics/), [puesta en marcha](https://developers.cloudflare.com/web-analytics/get-started/), [límites](https://developers.cloudflare.com/web-analytics/limits/) y [FAQ (CSP, muestreo, retención)](https://developers.cloudflare.com/web-analytics/faq/)
- [Core Web Vitals en Web Analytics](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/) y [desglose de LCP e INP (13-oct-2026)](https://developers.cloudflare.com/changelog/post/2026-10-13-core-web-vital-subparts/)
- [Zaraz](https://developers.cloudflare.com/zaraz/), [primeros pasos](https://developers.cloudflare.com/zaraz/get-started/) y [precios](https://developers.cloudflare.com/zaraz/pricing-info/)
- [Disparadores](https://developers.cloudflare.com/zaraz/reference/triggers/), [Web API: track](https://developers.cloudflare.com/zaraz/web-api/track/) y [modo depuración](https://developers.cloudflare.com/zaraz/web-api/debug-mode/)
- [Gestión del consentimiento](https://developers.cloudflare.com/zaraz/consent-management/), [Consent API](https://developers.cloudflare.com/zaraz/consent-management/api/) y [Google Consent Mode](https://developers.cloudflare.com/zaraz/advanced/google-consent-mode/)
- [HTTP Events API](https://developers.cloudflare.com/zaraz/http-events-api/) y [ajustes de Zaraz](https://developers.cloudflare.com/zaraz/reference/settings/)
- [Zaraz pasa a Tag Management en el panel (24-feb-2025)](https://developers.cloudflare.com/changelog/post/2025-02-24-zaraz-dash-placement/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Fin de la serie: resumen y por dónde seguir.

## También te puede interesar

- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
