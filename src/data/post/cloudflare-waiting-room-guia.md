---
publishDate: 2026-08-25T09:00:00Z
draft: false
image: 'media:blog/cloudflare-waiting-room-guia/portada.png'
title: 'Waiting Room: sala de espera para picos de tráfico'
excerpt: 'Serie Cloudflare, parte 34. Cómo funciona la sala de espera de Cloudflare, qué significan total de usuarios activos y usuarios nuevos por minuto, cómo personalizar la página de cola, programar eventos y dejar pasar tráfico con reglas de bypass, y qué es solo de Enterprise.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'waiting room'
  - 'rendimiento'
  - 'disponibilidad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 34 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

La [caché](/blog/cloudflare-cdn-cache-guia) absorbe los picos de contenido estático, pero el carrito, el pago o la reserva no se cachean. Si diez mil personas llegan a la vez al *checkout*, Waiting Room las pone en cola para que entren a un ritmo que tu origen aguanta.

## Qué es

Waiting Room es una sala de espera virtual en el borde de Cloudflare. Mientras el tráfico es normal, nadie la ve. Cuando se acerca al límite que tú defines, los visitantes nuevos ven una página de espera con el tiempo estimado y entran cuando hay hueco.

La configuras con dos umbrales:

- **Total active users** (`total_active_users`). Cuántos usuarios quieres a la vez en las páginas protegidas. Tiene que ser mayor que 200. Cloudflare recomienda fijarlo en el **75 % de la capacidad** de tu origen.
- **New users per minute** (`new_users_per_minute`). A qué ritmo pueden entrar usuarios nuevos. Mayor que 200 y nunca más que el total de activos.

- **Session duration** (`session_duration`). Durante cuántos minutos sigue contando como activo alguien que ha dejado de hacer peticiones. Por defecto 5, entre 1 y 30.

Los dos umbrales son **objetivos**, no topes exactos: la sala puede encolar algo antes del límite o pasarse un poco en un pico brusco.

**Planes.** Waiting Room está en **Business y Enterprise**, con una sala por zona. Free y Pro no lo tienen. Casi todo lo avanzado (plantillas propias, eventos, reglas de bypass, varios métodos de cola) es **solo Enterprise** con el complemento **Waiting Room Advanced**.

## Casos de uso

- **Lanzamientos y rebajas.** La salida de un producto, unas entradas o un Black Friday. Todo el mundo llega en el mismo minuto.
- **Trámites con plazo.** Una inscripción o una cita previa que abre a una hora concreta.
- **Proteger el paso caro.** El pago o la búsqueda que consulta la base de datos. Pones la sala solo en esa ruta y el resto de la web va libre.
- **Freno de emergencia.** **Queue-all** manda a la cola a todos los visitantes nuevos mientras arreglas algo. Quien ya estaba dentro sigue hasta que caduca su sesión.

## Arquitectura

![Flujo de Waiting Room: el visitante llega al centro de datos de Cloudflare, pasa por DDoS, WAF y bots, y el Worker de Waiting Room decide con los umbrales y el estado global si lo deja pasar al origen o lo manda a la página de espera, que se refresca cada 20 segundos; debajo, tabla con total de usuarios activos, usuarios nuevos por minuto y duración de sesión](media:blog/cloudflare-waiting-room-guia/00-arquitectura.png)

1. La petición llega al **centro de datos más cercano**. DDoS, WAF y bots actúan antes; los Workers, después.
2. Waiting Room funciona sobre **Workers**. Cada centro de datos tiene un estado de la sala que se actualiza con datos globales cada pocos segundos, propagados con **Durable Objects**. Con ese estado y tus umbrales, cada centro recibe un número de huecos.
3. Si hay hueco, la petición sigue hacia la caché y el origen. El visitante recibe la cookie **`__cfwaitingroom`**, cifrada, que lo marca como activo.
4. Si no hay hueco, ve la **página de espera**. El navegador la refresca cada **20 segundos** y la cola es **FIFO**: sale primero quien llegó antes.
5. Quien ya ha entrado puede volver dentro de su sesión sin hacer cola otra vez.

Detalles que conviene saber antes de activarla:

- **Sin cookies no se entra.** Mientras la sala encola, quien bloquea cookies no puede acceder a esa ruta.
- **Recargar no hace perder el sitio.** Cerrar la pestaña sí: el puesto se guarda 5 minutos desde el último refresco.
- **Rate limiting.** Tus reglas de [rate limiting](/blog/cloudflare-rate-limiting-guia) tienen que permitir al menos una petición cada 20 segundos. Si no, bloquearás a la gente que espera.
- **Bots.** Los bots no suelen guardar cookies, así que cuentan como muchos usuarios y gastan huecos. Fíltralos antes con la [gestión de bots](/blog/cloudflare-bots-guia).

## Implementación paso a paso

Waiting Room no existe en Free: en `carluve.dev` solo se ve dónde está. La captura es de una zona en plan Free, donde el panel pide pasar a Business.

### 1. Encuéntralo en el panel

Está en la zona, en **Traffic › Waiting Room**. En una zona Free o Pro verás que la función no está disponible en tu plan.

![Waiting Room en una zona del plan Free: el panel pide pasar a Business para usarla](media:blog/cloudflare-waiting-room-guia/01-panel.png)

### 2. Crea la sala

**Traffic › Waiting Room › Create**. El asistente tiene tres pasos: ajustes, personalización y revisión.

En **Settings**:

- **Name.** Solo letras, números, guiones y guiones bajos.
- **Hostname y Path.** Sin `https://` y sin comodines. La ruta **distingue mayúsculas** y cubre todas sus subrutas: `/tienda` también protege `/tienda/pago`. Si `/Tienda` y `/tienda` son la misma página en tu servidor, la sala solo cubre una de ellas.
- **Total active users** y **New users per minute**, con los criterios de arriba.
- **Session duration.** Lo que tarda alguien en completar la compra. Si es larga, quien ya se fue ocupa huecos.

Después, el asistente pregunta por **Turnstile**. En Business el widget solo puede ser invisible y su fallo solo se registra. Los modos visibles y la acción **infinite queue**, que deja a los bots en una cola sin fin, son solo Enterprise.

### 3. Página de espera

En **Customization** eliges la página por defecto o una propia:

- **Página por defecto.** Sin marca, en el idioma que elijas (hay español, `es-ES`).
- **Plantilla propia** (solo Enterprise). HTML con variables [Mustache](https://mustache.github.io/) como `{{waitTime}}` o `{{#queueIsFull}}`. Puedes subir un fichero de hasta 1 MB. Dos avisos: `{{waitTimeFormatted}}` sale siempre en inglés, así que en español usa `{{waitTime}}`; y no sirvas imágenes desde el mismo hostname de la sala, porque quedarían atrapadas en la cola.

En este paso eliges también el **Queuing status code**: 200 por defecto, o 202 o 429. En **Review**, **Preview waiting room** te enseña la página en modo cola y en modo Queue-all antes de guardar.

Al guardar, la sala queda **activada**. Solo encolará cuando el tráfico se acerque a los umbrales.

### 4. Eventos programados (solo Enterprise)

Un evento cambia la sala durante un intervalo (umbrales, método de cola, plantilla). Se crea con **Schedule event**:

- **Prequeue.** Desde esta hora todo el mundo espera, aunque haya sitio. Tiene que empezar al menos **5 minutos** antes del evento.
- **Shuffle at event start.** Al abrir, baraja a quienes esperaban.
- Máximo **5 eventos** por sala y sin solaparse. El evento tiene que durar al menos 1 minuto.
- Si cambias el total de usuarios activos, tienes que cambiar también los nuevos por minuto, y al revés.

### 5. Reglas de bypass (solo Enterprise)

Desde la sala, **Manage rules › Create new bypass rule**. Usan el lenguaje de reglas del [WAF](/blog/cloudflare-waf-guia) con la acción `bypass_waiting_room`: para tu IP de administración, una subruta o los `.js` y `.css` de la plantilla.

Ese tráfico no cuenta como activo y la sala no le afecta, ni siquiera en Queue-all. Úsalas solo para tráfico que no pueda tumbar tu origen. No admiten `cf.threat_score`, `cf.bot_management.*` ni campos de respuesta.

Para los buscadores no hace falta una regla: **SEO Crawler Bypassing**, disponible en Business, deja pasar siempre a los rastreadores verificados.

## Lo mismo, como código

Con el proveedor de Terraform (v5). El token necesita *Waiting Rooms Write*.

```hcl
resource "cloudflare_waiting_room" "tienda" {
  zone_id                   = var.zone_id
  name                      = "tienda_rebajas"
  host                      = "www.example.com"
  path                      = "/tienda"
  total_active_users        = 1000
  new_users_per_minute      = 400
  session_duration          = 5
  default_template_language = "es-ES"
  queueing_status_code      = 202
}

# Rastreadores verificados nunca hacen cola (Business y Enterprise)
resource "cloudflare_waiting_room_settings" "zona" {
  zone_id                      = var.zone_id
  search_engine_crawler_bypass = true
}
```

Las reglas de bypass necesitan Enterprise con Waiting Room Advanced. El recurso gestiona la lista entera de reglas de la sala:

```hcl
resource "cloudflare_waiting_room_rules" "tienda" {
  zone_id         = var.zone_id
  waiting_room_id = cloudflare_waiting_room.tienda.id
  rules = [{
    description = "Estáticos de la plantilla"
    expression  = "ends_with(http.request.uri.path, \".css\") or ends_with(http.request.uri.path, \".js\")"
    action      = "bypass_waiting_room"
    enabled     = true
  }]
}
```

Si tu cliente es una app o una SPA, con Enterprise puedes activar `json_response_enabled`. La sala responde entonces con JSON en vez de HTML, pero solo si la cabecera es exactamente `Accept: application/json`. El cliente tiene que guardar la cookie, reintentar cada `refreshIntervalSeconds` y no fiarse de la respuesta sin comprobarla:

```js
// Navegador, mismo origen: fetch envía y guarda __cfwaitingroom solo.
export async function comprobarCola(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const tipo = res.headers.get("content-type") ?? "";
  if (!tipo.includes("application/json")) {
    return { enCola: false, respuesta: res }; // ha llegado al origen
  }

  let datos;
  try {
    datos = await res.json();
  } catch {
    throw new Error("Respuesta JSON no válida");
  }

  const sala = datos?.cfWaitingRoom;
  if (!sala || typeof sala !== "object") {
    return { enCola: false, respuesta: res }; // JSON de tu API, no de la sala
  }

  const minutos = sala.waitTimeKnown === true && Number.isFinite(sala.waitTime) ? sala.waitTime : null;
  const segundos = Number.isFinite(sala.refreshIntervalSeconds) && sala.refreshIntervalSeconds > 0
    ? sala.refreshIntervalSeconds
    : 20;

  return { enCola: sala.inWaitingRoom === true, minutos, reintentarEn: segundos * 1000 };
}
```

## Cómo comprobarlo

En el panel, la columna **Status** de la sala dice **Not queueing**, **Queueing**, **Disabled** o **Queue-all**. Por la API:

```bash
: "${CLOUDFLARE_API_TOKEN:?Falta el token}" "${ZONE_ID:?Falta ZONE_ID}" "${WAITING_ROOM_ID:?Falta WAITING_ROOM_ID}"

curl -sf "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/waiting_rooms/$WAITING_ROOM_ID/status" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result'
```

La respuesta indica `queueing` o `not_queueing`. Las cifras de activos y en cola son **estimaciones con 20 a 50 segundos de retraso**.

Para probarla de verdad, haz una prueba de carga de **2 o 3 minutos** (JMeter, loader.io o un script) donde cada usuario guarde su cookie: sin ella, cada petición cuenta como un usuario nuevo. Después revisa **Waiting Room Analytics**, con 30 días de datos.

Para un ensayo rápido, activa **Queue-all** en una ruta de pruebas y visítala: tienes que ver la página de espera.

## Límites y precios

Waiting Room es de **Business y Enterprise**. Lo que solo tiene Enterprise con Waiting Room Advanced:

| Función | Solo Enterprise (Advanced) |
|---|---|
| Más de una sala por zona | ✓ |
| Plantilla HTML propia | ✓ |
| Métodos de cola Random, Reject y Passthrough | ✓ |
| Varios hostnames y rutas por sala | ✓ |
| Eventos programados y prequeue | ✓ |
| Reglas de bypass | ✓ |
| Respuesta JSON para apps | ✓ |
| Desactivar la renovación de sesión | ✓ |
| Revocar sesiones desde el origen | ✓ |
| Turnstile visible e *infinite queue* para bots | ✓ |

- **Session duration**: de 1 a 30 minutos, 5 por defecto. Los dos umbrales, por encima de 200.
- Los clientes Enterprise pueden probarlo sin contrato como servicio de prueba.

## Documentación oficial

- [Waiting Room](https://developers.cloudflare.com/waiting-room/), [cómo funciona](https://developers.cloudflare.com/waiting-room/about/) y [disponibilidad por plan](https://developers.cloudflare.com/waiting-room/plans/)
- [Primeros pasos](https://developers.cloudflare.com/waiting-room/get-started/) y [crear una sala](https://developers.cloudflare.com/waiting-room/how-to/create-waiting-room/)
- [Ajustes de configuración](https://developers.cloudflare.com/waiting-room/reference/configuration-settings/) y [buenas prácticas](https://developers.cloudflare.com/waiting-room/reference/best-practices/)
- [Personalizar la página](https://developers.cloudflare.com/waiting-room/how-to/customize-waiting-room/) y [respuesta JSON](https://developers.cloudflare.com/waiting-room/how-to/json-response/)
- [Eventos programados](https://developers.cloudflare.com/waiting-room/additional-options/create-events/) y [reglas de bypass](https://developers.cloudflare.com/waiting-room/additional-options/waiting-room-rules/bypass-rules/)
- [Cookie de la sala](https://developers.cloudflare.com/waiting-room/reference/waiting-room-cookie/) y [estado de la sala](https://developers.cloudflare.com/waiting-room/how-to/monitor-waiting-room/)
- [Probar una sala](https://developers.cloudflare.com/waiting-room/additional-options/test-waiting-room/), [analítica](https://developers.cloudflare.com/waiting-room/waiting-room-analytics/) y [preguntas frecuentes](https://developers.cloudflare.com/waiting-room/troubleshooting/)
- [Terraform: cloudflare_waiting_room](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/waiting_room) y [cloudflare_waiting_room_rules](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/waiting_room_rules)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Rules: redirecciones, Transform Rules y Snippets.

## También te puede interesar

- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [Rate limiting en Cloudflare: limitar peticiones sin bloquear a tus usuarios](/blog/cloudflare-rate-limiting-guia)
- [Turnstile: el CAPTCHA sin CAPTCHA, del widget a la verificación en el servidor](/blog/cloudflare-turnstile-guia)
