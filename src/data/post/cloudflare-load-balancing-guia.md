---
publishDate: 2026-08-04T09:00:00Z
draft: false
image: 'media:blog/cloudflare-load-balancing-guia/portada.png'
title: 'Load Balancing en Cloudflare: conmutación por error entre orígenes'
excerpt: 'Serie Cloudflare, parte 31. Cómo funciona Load Balancing de Cloudflare: load balancers, pools, endpoints y monitores, las políticas de steering, la afinidad de sesión, cómo montar un failover entre dos orígenes en el panel y con Terraform, y cuánto cuesta.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'load balancing'
  - 'alta disponibilidad'
  - 'failover'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 31 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

La [caché](/blog/cloudflare-cdn-cache-guia) aguanta mucho, pero no todo. Si tu único servidor se cae, las peticiones que no están en caché fallan. Load Balancing reparte el tráfico entre varios orígenes y deja de enviar peticiones a los que no responden.

## Qué es

Load Balancing es un **complemento de pago** que se monta con cuatro piezas:

- **Endpoint.** Cada destino que puede recibir tráfico: una IP, un nombre de host o, con una red virtual de [Tunnel](/blog/cloudflare-tunnel-guia), una IP privada. En la API se siguen llamando `origins`.
- **Pool.** Un grupo de endpoints, por ejemplo todos los servidores de un centro de datos. Dentro del pool, cada endpoint tiene un **peso** (1 por defecto).
- **Monitor.** Una comprobación de salud (HTTP, HTTPS o TCP) que Cloudflare lanza contra cada endpoint del pool cada cierto intervalo.
- **Load balancer.** Va asociado a un nombre de host de tu zona. Decide a qué pool va cada petición según la **política de steering**, y solo elige entre pools sanos.

Monitores y pools son de la **cuenta**; el load balancer, de la **zona**. Desde junio de 2025 todo está en la página **Load Balancing** de la cuenta.

## Casos de uso

- **Failover activo-pasivo.** Un servidor principal y uno de reserva. Si el principal deja de pasar el monitor, el tráfico se va al de reserva sin tocar el DNS a mano.
- **Varios orígenes activos.** Varios servidores en un pool, con pesos.
- **Usuarios en varios continentes.** Un pool por región; cada visitante va al más cercano o al más rápido.
- **Migraciones.** Mover pesos poco a poco de un proveedor a otro.

## Arquitectura

![Flujo de Load Balancing: el visitante llega al load balancer, que aplica reglas personalizadas, política de steering y afinidad de sesión; envía el tráfico al pool primario con dos endpoints y, si cae, al pool de respaldo; los monitores sondean ambos pools; debajo, tabla con las seis políticas de steering, su valor en la API y lo que necesita cada una](media:blog/cloudflare-load-balancing-guia/00-arquitectura.png)

Un load balancer público crea un **registro LB** para su nombre de host, que gana a cualquier registro DNS con el mismo nombre. Si lo desactivas, vuelven a servirse tus registros `A`, `AAAA` o `CNAME`.

El load balancer funciona en dos modos:

- **Con proxy (nube naranja).** Cloudflare elige un endpoint sano en cada petición, oculta las IPs de tus orígenes y aplica caché y WAF. El failover es más rápido y es el único modo con afinidad de sesión.
- **Solo DNS (nube gris).** Cloudflare responde con la IP de un endpoint sano. El failover depende de que los resolvers respeten el TTL.

### Salud

Por cada región que eliges en el pool, Cloudflare lanza sondas desde **tres centros de datos**. Una región está sana si lo está la mayoría de sus centros; un endpoint está sano si lo está la mayoría de regiones. Un pool está sano mientras tenga al menos tantos endpoints sanos como su **Health Threshold**. Si no hay ningún monitor asociado, el load balancer envía todo al primer pool.

Ojo con los **reintentos**: cuando una sonda supera el timeout, los reintentos se lanzan en el acto, sin esperar al siguiente intervalo. Con 2 reintentos y 5 s de timeout, un endpoint que no responde se marca como caído en unos 15 s.

Entre sondas, **Adaptive Routing** cubre los huecos. Con proxy, si un endpoint devuelve un 521, 522, 523, 525 o 526, Cloudflare reintenta esa petición una vez contra otro endpoint sano del pool. Con **Failover across pools** activado, el reintento puede ir a otro pool.

### Políticas de steering

- **Off** (`off`): failover puro. Usa el primer pool sano en el orden de la lista.
- **Random** (`random`): un pool al azar, en proporción a los pesos que fijes con la API.
- **Geo** (`geo`): asignas pools a regiones de Cloudflare o a países. Asignarlos por centro de datos (PoP) es solo de Enterprise y solo por API.
- **Dynamic** (`dynamic_latency`): elige el pool con menor latencia según los monitores. Necesita que el pool compruebe la salud desde **All Regions** (o **All Data Centers**, solo Enterprise) y unos 10 minutos para tener datos.
- **Proximity** (`proximity`): el pool más cercano por coordenadas GPS. Tienes que dar latitud y longitud a **todos** los pools.
- **Least Outstanding Requests** (`least_outstanding_requests`): combina los pesos con las peticiones en curso de cada pool. Con solo DNS cuenta las peticiones en curso como cero, así que úsalo con proxy.

Dentro de cada pool hay una segunda decisión, la **Endpoint Steering**: Random (por pesos), Hash (por IP del cliente) o Least Outstanding Requests.

### Afinidad de sesión

Solo con proxy. Hay tres tipos:

- **Cookie** (`cookie`): Cloudflare pone la cookie `__cflb` y el cliente vuelve al mismo endpoint mientras siga sano. Dura 23 horas por defecto (entre 1.800 y 604.800 segundos).
- **Cookie con IP de respaldo** (`ip_cookie`): igual, pero la primera elección es estable según la IP del cliente.
- **Cabecera HTTP** (`header`): la sesión se ata a las cabeceras que elijas. Caduca tras 1.800 s sin uso por defecto (entre 30 y 3.600).

Con **Zero-downtime failover** decides qué pasa si el endpoint fijado cae: `none` (por defecto, el error llega al usuario), `temporary` (va a otro mientras se recupera) o `sticky` (la cookie se reescribe hacia el nuevo endpoint).

## Implementación paso a paso

El ejemplo: un failover activo-pasivo para `app.example.com`, con un pool primario de dos servidores y un pool de respaldo con uno. La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Prepara una ruta de salud en cada origen

El monitor necesita una URL que diga la verdad. No uses la portada: puede devolver 200 aunque la base de datos esté caída. Crea una ruta `/health` que compruebe tus dependencias con un timeout corto y responda `200 ok` o `503 fail`, con `Cache-Control: no-store`.

No devuelvas detalles internos en esa respuesta. Asegúrate de que tu cortafuegos no bloquee ni limite las [IPs de Cloudflare](https://www.cloudflare.com/ips/). Las sondas llevan el user-agent `Cloudflare-Traffic-Manager`.

### 2. Activa el complemento

En el panel de la cuenta, **Load Balancing**. La primera vez hay que activarlo y elegir las opciones del plan; la cuenta necesita un perfil de facturación.

![Página Load Balancing de una zona: cuota incluida (balanceadores, pools y endpoints) y la lista de balanceadores todavía vacía](media:blog/cloudflare-load-balancing-guia/01-panel.png)

### 3. Crea el monitor

**Load Balancing › Monitors › Create monitor**:

- **Type**: HTTPS. **Path**: `/health`.
- En **Advanced health monitor settings**: **Interval** 60 s, **Timeout** 5 s, **Retries** 2, **Expected Code(s)** 200 y **Response Body** `ok`.
- Una cabecera **Host** con tu dominio, como recomienda Cloudflare.

Por API puedes fijar además `consecutive_up` y `consecutive_down`: cuántas veces seguidas tiene que pasar o fallar un endpoint antes de cambiar de estado.

### 4. Crea los dos pools

**Load Balancing › Pools › Create pool**. Para el primario:

- Nombre `primario` y dos endpoints con sus direcciones, peso 1 cada uno.
- **Health Threshold** 1: el pool sigue sano mientras quede un endpoint vivo.
- **Monitor**: el del paso anterior.
- **Health Monitor Regions**: una o dos regiones cercanas. Cada región suma tres sondas por intervalo.
- **Pool Notifications**: crea una alerta de salud para enterarte de cada caída.

Repite con `respaldo` y su único endpoint.

### 5. Crea el load balancer

**Load Balancing › Create load balancer › Public load balancer**, y elige la zona:

1. **Hostname**: `app`. Deja la nube naranja. Activa **Session Affinity** si tu aplicación guarda la sesión en memoria del servidor, y **Adaptive Routing** con **Failover across pools**.
2. **Add a Pool**: `primario` arriba y `respaldo` debajo. El orden es la prioridad de failover. Marca `respaldo` como **fallback pool**, el que se usa si todos los demás están caídos.
3. **Monitors**: revisa que los dos pools tienen el monitor.
4. **Traffic Steering**: **Off**.
5. **Review**: **Save as Draft** si quieres revisarlo antes, o **Save and Deploy**.

Prueba primero en un subdominio: el registro LB tapa cualquier registro DNS con el mismo nombre.

### Lo mismo, como código

Con el proveedor de Terraform (v5). El token va en la variable de entorno `CLOUDFLARE_API_TOKEN`, nunca en el código, y necesita los permisos *Load Balancing: Monitors and Pools Write* (cuenta) y *Load Balancers Write* (zona).

```hcl
resource "cloudflare_load_balancer_monitor" "salud" {
  account_id     = var.account_id
  type           = "https"
  method         = "GET"
  path           = "/health"
  expected_codes = "200"
  expected_body  = "ok"
  interval       = 60
  timeout        = 5
  retries        = 2
  header = {
    Host = ["app.example.com"]
  }
}

resource "cloudflare_load_balancer_pool" "primario" {
  account_id      = var.account_id
  name            = "primario"
  monitor         = cloudflare_load_balancer_monitor.salud.id
  minimum_origins = 1
  check_regions   = ["WEU", "EEU"]
  origins = [
    { name = "app-1", address = "203.0.113.10", weight = 1 },
    { name = "app-2", address = "203.0.113.11", weight = 1 },
  ]
}

resource "cloudflare_load_balancer_pool" "respaldo" {
  account_id      = var.account_id
  name            = "respaldo"
  monitor         = cloudflare_load_balancer_monitor.salud.id
  minimum_origins = 1
  check_regions   = ["WEU"]
  origins = [
    { name = "reserva-1", address = "198.51.100.20", weight = 1 },
  ]
}

resource "cloudflare_load_balancer" "app" {
  zone_id         = var.zone_id
  name            = "app.example.com"
  proxied         = true
  steering_policy = "off"
  default_pools = [
    cloudflare_load_balancer_pool.primario.id,
    cloudflare_load_balancer_pool.respaldo.id,
  ]
  fallback_pool    = cloudflare_load_balancer_pool.respaldo.id
  session_affinity = "cookie"
  session_affinity_attributes = {
    zero_downtime_failover = "temporary"
  }
  adaptive_routing = {
    failover_across_pools = true
  }
}
```

`minimum_origins` es el Health Threshold del panel. Para las alertas, usa el servicio de Notificaciones: el campo `notification_email` del pool está obsoleto.

## Cómo comprobarlo

En el panel, **Load Balancing › Pools** muestra las columnas **Health** y **Endpoint Health**. Hasta el primer resultado del monitor, el estado es *unknown*.

Por API, el listado de pools trae el campo `healthy` de cada pool y endpoint:

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?Falta CLOUDFLARE_API_TOKEN}"
: "${ACCOUNT_ID:?Falta ACCOUNT_ID}"
[[ "$ACCOUNT_ID" =~ ^[0-9a-f]{32}$ ]] || { echo "ACCOUNT_ID no válido" >&2; exit 1; }

resp=$(curl -sS "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/load_balancers/pools" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")

if ! echo "$resp" | jq -e '.success == true' >/dev/null; then
  echo "$resp" | jq '.errors' >&2
  exit 1
fi

echo "$resp" | jq '.result[] | {pool: .name, healthy, endpoints: [.origins[]? | {name, healthy}]}'
```

Para probar el failover de verdad, haz que `/health` devuelva 503 en los dos servidores del primario. Pasado un intervalo, las peticiones deben llegar al respaldo. Con afinidad por cookie, la respuesta trae una cabecera `Set-Cookie` con `__cflb`.

En planes de pago, **Load Balancing Analytics** muestra las peticiones por pool y cada cambio de salud. Solo cuenta peticiones no cacheadas, así que no cuadra con otras analíticas.

## Límites y precios

- **Precio.** Desde **5 $ al mes**. La factura desglosa pools, endpoints, intervalos y regiones de sondeo; lo que cabe en lo incluido sale a 0 $. Incluye las primeras 500.000 consultas DNS; a partir de ahí se cobra por uso.
- **Cupos fuera de Enterprise.** 20 load balancers, 20 pools y 20 endpoints. Monitores: 1,5 veces el número de pools. Intervalo de monitor: hasta 3.600 s.

| Solo en Enterprise | |
|---|---|
| Intervalo mínimo de monitor de 10 s | ✓ |
| Monitores ICMP Ping, UDP-ICMP y SMTP | ✓ |
| Sondeo desde All Data Centers | ✓ |
| Steering por centro de datos (PoP) | ✓ |
| Afinidad por cabecera con hasta 5 cabeceras (1 en el resto) | ✓ |
| Monitor Groups (varios monitores como uno, por API) | ✓ |
| Cupos de load balancers, pools y endpoints a medida | ✓ |

Novedades de 2026 que conviene conocer:

- **Regional health** (agosto): cada región decide la salud del pool con sus propias sondas. Se activa con `health_sources = ["regional", "global"]`.
- **Pool sets** (agosto): por API, asocian ubicaciones a pools. Son lo recomendado frente a `region_pools` y `country_pools`.

## Documentación oficial

- [Load Balancing](https://developers.cloudflare.com/load-balancing/) y [componentes](https://developers.cloudflare.com/load-balancing/understand-basics/load-balancing-components/)
- [Activar Load Balancing](https://developers.cloudflare.com/load-balancing/get-started/enable-load-balancing/) y [guía rápida](https://developers.cloudflare.com/load-balancing/get-started/quickstart/)
- [Monitores](https://developers.cloudflare.com/load-balancing/monitors/), [crearlos](https://developers.cloudflare.com/load-balancing/monitors/create-monitor/) y [cómo se decide la salud](https://developers.cloudflare.com/load-balancing/understand-basics/health-details/)
- [Pools](https://developers.cloudflare.com/load-balancing/pools/create-pool/) y [Endpoint Steering](https://developers.cloudflare.com/load-balancing/understand-basics/traffic-steering/origin-level-steering/)
- [Políticas de steering](https://developers.cloudflare.com/load-balancing/understand-basics/traffic-steering/steering-policies/)
- [Afinidad de sesión](https://developers.cloudflare.com/load-balancing/understand-basics/session-affinity/) y [Adaptive Routing](https://developers.cloudflare.com/load-balancing/understand-basics/adaptive-routing/)
- [Con proxy o solo DNS](https://developers.cloudflare.com/load-balancing/understand-basics/proxy-modes/) y [registros DNS del load balancer](https://developers.cloudflare.com/load-balancing/load-balancers/dns-records/)
- [Límites](https://developers.cloudflare.com/load-balancing/reference/limitations/) y [analíticas](https://developers.cloudflare.com/load-balancing/reference/load-balancing-analytics/)
- [Terraform: tutorial de Load Balancing](https://developers.cloudflare.com/terraform/tutorial/use-load-balancing/)
- [Changelog de Load Balancing](https://developers.cloudflare.com/load-balancing/changelog/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** [Argo Smart Routing](/blog/cloudflare-argo-guia), el camino más rápido hasta tu origen.

## También te puede interesar

- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [Cloudflare Tunnel: publicar un servicio sin abrir puertos](/blog/cloudflare-tunnel-guia)
