---
publishDate: 2026-08-11T09:00:00Z
draft: false
image: 'media:blog/cloudflare-argo-guia/portada.png'
title: 'Argo Smart Routing: el camino más rápido hasta tu origen'
excerpt: 'Serie Cloudflare, parte 32. Qué hace Argo Smart Routing, cómo encaja con Tiered Cache dentro de Smart Shield, cómo se activa, cómo medir si te compensa y cómo se factura el tráfico que pasa por él.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'argo'
  - 'smart shield'
  - 'rendimiento'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 32 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

La caché ([parte 4](/blog/cloudflare-cdn-cache-guia)) resuelve lo que se puede guardar. Pero tu HTML personalizado, tu API o el carrito de la compra no se cachean: cada petición tiene que llegar a tu servidor. Si el servidor está en Fráncfort y el visitante en Sídney, ese viaje pesa. Argo Smart Routing intenta acortarlo.

## Qué es

Argo Smart Routing elige, en tiempo real, el camino más rápido entre Cloudflare y tu origen. Internet no siempre usa la ruta más rápida y hay tramos congestionados. Cloudflare mide en cada momento qué caminos de su red van más rápido. Con Argo, la petición viaja por su red hasta el centro de datos mejor conectado con tu servidor y sale de ahí.

Según la documentación, la mejora media es de un **30 %** en latencia. Se nota más cuanto más lejos está el visitante del origen.

Tres cosas que conviene saber antes de seguir:

- **Ahora es parte de Smart Shield.** Smart Shield es el paquete de protección del origen. El paquete base incluye Smart Tiered Cache y reutilización de conexiones, y es gratis. **Smart Shield + Argo** añade Argo Smart Routing y es de pago.
- **Se factura por tráfico.** Pagas por los GB que viajan entre Cloudflare y tu origen. El primer GB está incluido.
- **El tráfico de ataques no cuenta.** Lo que mitigan la protección DDoS, el WAF u otros mecanismos no entra en la factura de Argo.

**Planes.** Free, Pro y Business pueden contratar Smart Shield + Argo como complemento. Solo en Enterprise: el paquete **Smart Shield Advanced** (añade Regional Tiered Cache y Cache Reserve) y la opción de probar Argo como servicio sin contrato, sin cargos por uso.

## Casos de uso

- **Contenido dinámico con público lejano.** Una tienda con el servidor en Europa y clientes en América o Asia. El HTML del carrito y la API de pago no se cachean; Argo acorta cada ida y vuelta.
- **APIs y aplicaciones.** Peticiones `POST`, sesiones, respuestas personalizadas. Todo lo que siempre va al origen.
- **Un origen único sin réplicas.** Si no puedes desplegar servidores en varias regiones, Argo acerca tu origen al resto del mundo.

Cuándo **no** compensa: casi todo tu tráfico sale de caché, tus visitantes están cerca del origen (una web local en España con el servidor en Madrid) o tu sitio son Workers sin un servidor detrás.

## Arquitectura

![Recorrido de una petición con Smart Shield + Argo: visitante, centro de datos cercano, nivel superior de Tiered Cache y origen; sin Argo la petición sale a Internet por la ruta pública, con Argo viaja por la red de Cloudflare hasta el centro mejor conectado; debajo, tabla de qué hace cada pieza y qué se factura](media:blog/cloudflare-argo-guia/00-arquitectura.png)

1. La petición llega al **centro de datos más cercano** al visitante (nivel inferior).
2. Si el contenido es **cacheable** y no está, se pregunta al **nivel superior** que eligió Smart Tiered Cache: el centro con menos latencia hacia tu origen. Solo los niveles superiores hablan con el origen.
3. Si el contenido es **dinámico** (no cacheable), Argo calcula el camino más rápido hasta el origen por la red de Cloudflare.
4. Entre los niveles superiores y tu origen, la **reutilización de conexiones** agrupa muchas peticiones en una sola conexión. Según la documentación, reduce de media un 30 % las conexiones al origen.

Las dos piezas se complementan. **Tiered Cache reduce cuántas peticiones llegan al origen. Argo acelera las que sí llegan.** Y como Argo cobra por GB entre Cloudflare y el origen, cada acierto de caché es tráfico que no pagas. Antes de activar Argo, sube tu tasa de aciertos.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Comprueba los requisitos

- Los registros DNS que quieras acelerar tienen que estar **con proxy** (nube naranja). Lo que va en *DNS only* no pasa por Smart Shield.
- Necesitas un **perfil de facturación** en la cuenta. Si no lo tienes, el panel te lo pide al activar.

### 2. Elige el paquete en Smart Shield

En la zona, ve a **Speed › Smart Shield**. Verás los paquetes disponibles para tu plan.

![Página Argo Smart Routing de una zona: beneficios, precio por uso y botón Enable, sin activar](media:blog/cloudflare-argo-guia/01-panel.png)

- **Get started for free** activa el paquete base: Smart Tiered Cache y reutilización de conexiones. Hazlo aunque no vayas a contratar Argo.
- En **Smart Shield + Argo**, elige el paquete y pulsa **Continue**. El asistente te guía y te pide confirmar la facturación.

Antes de confirmar, revisa la tarifa por GB que muestra el panel.

### 3. Pon un aviso de gasto

Argo se factura por uso, y un pico de tráfico o una descarga muy popular sin caché puede disparar la factura. Crea un aviso:

1. A nivel de cuenta, ve a **Notifications** y pulsa **Add**.
2. En **Usage Based Billing**, pulsa **Select**.
3. Pon un nombre, elige **Argo Smart Routing** como producto y fija el umbral. Para Argo, el umbral es **Notify when total bytes of traffic exceeds**.
4. Añade el correo y guarda.

Todos los planes pueden mandar estos avisos por correo o por *webhook*. PagerDuty es de Business en adelante.

### 4. Revisa Tiered Cache

En **Caching › Tiered Cache** comprueba que **Smart Tiered Cache** está activo. Si tu origen está en AWS, Google Cloud, Azure u Oracle Cloud, indica la región. Si el origen usa IP *anycast* o regionales, Smart Tiered Cache no puede deducir dónde está midiendo latencias. Lo expliqué en la [parte 4](/blog/cloudflare-cdn-cache-guia).

### Lo mismo, como código

Por API, con un token que tenga el permiso **Zone Settings Write**. La cuenta ya tiene que tener perfil de facturación. El script no lleva secretos dentro y se para si falta algo:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Lee el token y la zona del entorno; nunca los escribas en el script.
: "${CLOUDFLARE_API_TOKEN:?Falta CLOUDFLARE_API_TOKEN}"
: "${ZONE_ID:?Falta ZONE_ID}"

VALOR="${1:-}"
if [[ "$VALOR" != "on" && "$VALOR" != "off" ]]; then
  echo "Uso: $0 on|off" >&2
  exit 1
fi

API="https://api.cloudflare.com/client/v4/zones/$ZONE_ID/argo/smart_routing"

# Cambia el ajuste
respuesta=$(curl -sS --fail-with-body --request PATCH "$API" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json "{\"value\": \"$VALOR\"}")

# Comprueba que la API dice success antes de seguir
if [[ "$(jq -r '.success' <<<"$respuesta")" != "true" ]]; then
  echo "La API ha rechazado el cambio:" >&2
  jq '.errors' <<<"$respuesta" >&2
  exit 1
fi

# Lee el valor actual para confirmarlo
curl -sS --fail-with-body "$API" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | jq '{value: .result.value, editable: .result.editable}'
```

Con Terraform (proveedor v5), Argo y Smart Tiered Cache:

```hcl
resource "cloudflare_argo_smart_routing" "argo" {
  zone_id = var.zone_id
  value   = "on"
}

resource "cloudflare_tiered_cache" "smart" {
  zone_id = var.zone_id
  value   = "on"
}
```

`zone_id` va en una variable, no en el código. Si la zona no tiene Argo contratado o la cuenta no tiene perfil de facturación, el `apply` fallará; contrátalo primero en el panel.

## Cómo comprobarlo

**1. Que está activo.** El `GET` del script anterior devuelve `"value": "on"`.

**2. La analítica de Argo.** En la zona, **Analytics › Performance**. La sección **Origin Performance (Argo)** mide el tiempo hasta el primer byte (TTFB) entre tu origen y Cloudflare, y tiene dos vistas:

- **Origin Response Time**: un histograma. Las barras azules son el TTFB sin Argo; las naranjas, el TTFB de las peticiones en las que Argo encontró una ruta mejor.
- **Geography**: un mapa con la mejora en cada centro de datos. Un valor negativo significa que desde ahí Argo no habría ayudado, así que esas peticiones fueron por la ruta directa.

El detalle solo aparece si Argo ha enrutado al menos **500 peticiones al origen en las últimas 48 horas**. Si acabas de activarlo o tienes poco tráfico dinámico, la página saldrá vacía.

**3. Tu propia medida.** Mide el TTFB de una URL dinámica (que dé `DYNAMIC` o `BYPASS` en `cf-cache-status`) antes y después, desde una máquina lejos del origen:

```bash
URL="https://www.example.com/api/estado"

for i in $(seq 1 10); do
  curl -s -o /dev/null \
    -w "%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n" \
    "$URL"
done
```

Compara medianas, no una sola petición. El TTFB incluye lo que tarda tu servidor en generar la respuesta, y eso Argo no lo arregla.

**4. En los logs.** Si exportas los logs HTTP con Logpush, el campo `SmartRouteColoID` indica qué centro de datos se conectó al origen cuando la petición usó Argo, y `UpperTierColoID` el nivel superior de Tiered Cache.

## Límites y precios

| | Free, Pro, Business | Enterprise |
|---|---|---|
| Smart Shield (Smart Tiered Cache y reutilización de conexiones) | ✓ | ✓ |
| Smart Shield + Argo (de pago) | ✓ | ✓ |
| Smart Shield Advanced (Regional Tiered Cache y Cache Reserve) | — | ✓ |
| Probar Argo sin contrato ni cargos por uso | — | ✓ |

- **Precio.** El paquete Smart Shield + Argo parte de **5 $ al mes** según la página de planes de Cloudflare, más el tráfico: los GB transferidos entre Cloudflare y tu origen, con el **primer GB incluido**. La tarifa por GB vigente la ves en el panel al contratarlo.
- **Lo que no pagas.** El tráfico mitigado por DDoS, WAF u otras protecciones no se factura.
- **Cómo bajar la factura.** Sube la tasa de aciertos de caché con TTL más largas y cabeceras `Cache-Control` correctas. Cada respuesta servida desde caché no viaja al origen, así que no cuenta para Argo.
- **Orígenes privados.** Argo no funciona con orígenes privados conectados por Cloudflare WAN.

**¿Merece la pena?** Haz la cuenta con tus datos. Mira en la analítica cuántos GB van al origen cada mes, multiplícalo por la tarifa del panel y compáralo con lo que vale para ti la mejora de TTFB en los países lejanos. Si tus usuarios están cerca del servidor o casi todo sale de caché, quédate con el Smart Shield gratuito.

## Documentación oficial

- [Argo Smart Routing](https://developers.cloudflare.com/argo-smart-routing/) y [cómo activarlo](https://developers.cloudflare.com/argo-smart-routing/get-started/)
- [Analítica de Argo](https://developers.cloudflare.com/argo-smart-routing/analytics/)
- [Smart Shield](https://developers.cloudflare.com/smart-shield/), [paquetes y disponibilidad](https://developers.cloudflare.com/smart-shield/get-started/) y [diagrama de red](https://developers.cloudflare.com/smart-shield/concepts/network-diagram/)
- [Reutilización de conexiones](https://developers.cloudflare.com/smart-shield/concepts/connection-reuse/) y [Smart Tiered Cache](https://developers.cloudflare.com/smart-shield/configuration/smart-tiered-cache/)
- [Facturación por uso y avisos](https://developers.cloudflare.com/billing/understand/usage-based-billing/) y [cómo se acumulan los cargos](https://developers.cloudflare.com/billing/understand/how-charges-accrue/)
- [API: ajuste de Argo Smart Routing](https://developers.cloudflare.com/api/resources/argo/subresources/smart_routing/methods/edit/)
- [Campos del dataset HTTP requests de Logpush](https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/zone/http_requests/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Images, transformación y optimización de imágenes.

## También te puede interesar

- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [Cloudflare Tunnel: publicar un servicio sin abrir puertos](/blog/cloudflare-tunnel-guia)
