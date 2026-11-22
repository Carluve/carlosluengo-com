---
publishDate: 2026-02-03T09:00:00Z
draft: false
image: 'media:blog/cloudflare-waf-guia/portada.png'
title: 'WAF de Cloudflare: reglas gestionadas y reglas personalizadas'
excerpt: 'Serie Cloudflare, parte 5. Qué hace el WAF de Cloudflare, en qué orden se evalúan las reglas, qué te da el plan Free (y qué no), cómo escribir una regla propia contra los sondeos de WordPress, cómo activar las reglas gestionadas y cómo ver qué se está bloqueando.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'waf'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 5 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Con el tráfico pasando por Cloudflare ([DNS](/blog/cloudflare-dns-dnssec-guia)), cifrado ([SSL/TLS](/blog/cloudflare-ssl-tls-guia)) y cacheado ([CDN](/blog/cloudflare-cdn-cache-guia)), falta decidir qué peticiones **no** deberían llegar nunca a tu servidor. Para eso está el WAF.

## Qué es

El WAF (*Web Application Firewall*) de Cloudflare inspecciona cada petición HTTP que pasa por el proxy y decide si la deja pasar, la bloquea o le pide una prueba. Tiene tres capas que se complementan:

- **Reglas personalizadas (*custom rules*).** Las escribes tú con el lenguaje de reglas de Cloudflare: país, ruta, cabeceras, bots conocidos, IP… Son la herramienta del día a día.
- **Reglas de rate limiting.** Cortan a quien hace demasiadas peticiones en poco tiempo.
- **Reglas gestionadas (*managed rules*).** Firmas que mantiene Cloudflare contra vulnerabilidades conocidas (CVE, inyección SQL, XSS, RCE…). Se actualizan solas, a veces con reglas de emergencia el mismo día que se publica un fallo.

**Planes.** Todos los planes tienen reglas personalizadas (5 en Free, 20 en Pro, 100 en Business, 1.000 en Enterprise) y una regla de rate limiting en Free. En reglas gestionadas, Free tiene el **Free Managed Ruleset**, que cubre las vulnerabilidades más explotadas. El **Cloudflare Managed Ruleset** completo y el **OWASP Core Ruleset** son de Pro en adelante. Las expresiones regulares en reglas son de Business y Enterprise, y la acción **Log** solo de Enterprise.

## Casos de uso

- **Cerrar lo que no usas.** Una web que no es WordPress recibe igualmente cientos de peticiones a `/wp-login.php` y `/xmlrpc.php`. Una regla las corta en el borde.
- **Proteger el login y los formularios.** Rate limiting en `/login`, detección de contraseñas filtradas y un *challenge* para tráfico sospechoso.
- **Restringir por geografía o por red.** Pedir un *challenge* a países donde no tienes clientes o dejar el panel de administración solo para tu IP.
- **Parchear antes de parchear.** Cuando sale un CVE crítico en tu CMS o framework, las reglas gestionadas suelen bloquearlo antes de que tengas tiempo de actualizar.

## Arquitectura

![Orden de evaluación: petición, DDoS de capa 7, reglas personalizadas (5 en Free), rate limiting (1 en Free), reglas gestionadas (ruleset Free) y caché u origen; debajo, tabla de acciones: Block, Managed Challenge, JS/Interactive Challenge, Skip y Log](media:blog/cloudflare-waf-guia/00-arquitectura.png)

Cada petición con proxy atraviesa varias fases en el borde, en este orden simplificado:

1. **Protección DDoS de capa 7**, siempre activa y gratuita (tendrá su propio post).
2. **Reglas personalizadas**, en el orden en que las colocas. La primera que bloquea o pide un *challenge* corta la evaluación.
3. **Rate limiting**.
4. **Reglas gestionadas**.
5. Si la petición sobrevive, sigue hacia la **caché** y el **origen**.

Las acciones que puedes usar:

- **Block** devuelve un 403.
- **Managed Challenge** deja que Cloudflare elija la prueba según la petición; la mayoría de personas no ve nada.
- **Non-Interactive (JS) Challenge** e **Interactive Challenge** son pruebas más visibles.
- **Skip** deja pasar la petición saltándose las reglas o fases que elijas. Es lo que sustituye al antiguo *Allow*.
- **Log** solo registra, y es de Enterprise.

## Implementación paso a paso

Las capturas son de `carluve.dev`, una zona en plan **Free**. La regla del paso 2 la rellené para la captura y la cancelé sin desplegarla. Las IPs de la analítica no aparecen.

### 1. Mira qué tienes ya

En el panel nuevo, todo está en **Security › Security rules**: reglas personalizadas, rate limiting, reglas gestionadas y, desde octubre de 2026, reglas de respuesta.

![Security › Security rules en una zona Free: Custom rules 0/5, Rate limiting rules 1/1 con la regla Leaked credential check en Block, Managed rules con botón Upgrade plan](media:blog/cloudflare-waf-guia/01-reglas.png)

Lo que dice la captura de una zona Free:

- **Custom rules 0/5**: cinco reglas propias disponibles, ninguna creada.
- **Rate limiting rules 1/1**: la única regla de rate limiting ya está ocupada por **Leaked credential check**, que bloquea los intentos de inicio de sesión con contraseñas filtradas. En Free hay que elegir entre esa o una tuya.
- **Managed rules**: el Cloudflare Managed Ruleset completo pide subir de plan.

### 2. Escribe una regla personalizada

**Security rules › Create rule › Custom rules**. El ejemplo: bloquear los sondeos a rutas de WordPress en una web que no es WordPress.

```
(http.request.uri.path contains "/wp-login.php")
or (http.request.uri.path contains "/xmlrpc.php")
```

Antes de desplegar, el panel calcula **cuántas peticiones de los últimos 30 días habrían coincidido**. En esta zona fueron **670**, el 0,4 % de todo el tráfico. Ninguna era legítima: aquí no hay WordPress.

![Formulario New custom rule: nombre «Bloquear sondeos de WordPress», la expresión con wp-login.php y xmlrpc.php, 670 peticiones coincidentes en 30 días (0,4 % del tráfico) y el desplegable de acciones: Managed Challenge, Block, Non-Interactive Challenge, Skip e Interactive Challenge](media:blog/cloudflare-waf-guia/02-regla-personalizada.png)

Algunas pautas:

- **Empieza con Managed Challenge** si no estás seguro, mira los eventos unos días y luego pasa a **Block**. Fuera de Enterprise no existe *Log*.
- **No bloquees a los buenos bots sin querer.** Si una regla puede afectar a buscadores, añade `and not cf.client.bot`.
- **Olvídate de `cf.threat_score`**: desde 2025 vale siempre 0. Las reglas basadas en él ya no hacen nada.
- Las reglas se evalúan **en orden**. Coloca las de Skip (tu IP, tu monitorización) arriba.
- El botón **Create rule with AI** escribe la expresión a partir de una descripción en lenguaje natural. Revísala siempre antes de desplegar.

### 3. Reglas gestionadas

En **Security › Settings** está el ruleset gestionado de la zona. En Free aparece como **siempre activo**: es el Free Managed Ruleset y no se puede desactivar.

![Security › Settings: Cloudflare managed ruleset siempre activo, con las etiquetas Web application exploits, DDoS attacks y Bot traffic](media:blog/cloudflare-waf-guia/03-ruleset-gestionado.png)

Es más útil de lo que parece. El 21 de octubre de 2026, Cloudflare añadió siete reglas de emergencia al ruleset Free (y las mismas al de pago) para bloquear patrones de ejecución anómalos. Al día siguiente las asoció a CVE-2026-109618 y CVE-2026-109619. Los clientes Free quedaron protegidos sin tocar nada.

En Pro y superiores puedes desplegar además el **Cloudflare Managed Ruleset** y el **OWASP Core Ruleset**, y ajustarlos:

- **Excepciones**: saltarse reglas concretas para una ruta (por ejemplo, un editor de contenidos que envía HTML).
- **Overrides**: cambiar la acción de una regla o de una categoría, o desactivarla.
- **OWASP**: nivel de paranoia (PL1 a PL4, por defecto PL1) y umbral de puntuación (Low ≥ 60, Medium ≥ 40 por defecto, High ≥ 25).

### Lo mismo, como código

Con el proveedor de Terraform (v5), la regla personalizada:

```hcl
resource "cloudflare_ruleset" "waf_custom" {
  zone_id = var.zone_id
  name    = "Reglas personalizadas"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules = [{
    ref         = "bloquear_wordpress"
    description = "Bloquear sondeos de WordPress"
    expression  = "(http.request.uri.path contains \"/wp-login.php\") or (http.request.uri.path contains \"/xmlrpc.php\")"
    action      = "block"
  }]
}
```

Y en Pro o superior, el Cloudflare Managed Ruleset (su ID es fijo y público):

```hcl
resource "cloudflare_ruleset" "waf_managed" {
  zone_id = var.zone_id
  name    = "Reglas gestionadas"
  kind    = "zone"
  phase   = "http_request_firewall_managed"
  rules = [{
    ref        = "cf_managed"
    expression = "true"
    action     = "execute"
    action_parameters = {
      id = "efb7b8c949ac4650a09736fc376e9aee" # Cloudflare Managed Ruleset
    }
  }]
}
```

El token necesita el permiso *Zone WAF: Edit*. Ojo con un detalle: Terraform asume que controla **todas** las reglas de esa fase. Si ya tenías reglas creadas en el panel, impórtalas antes con `cf-terraforming` o las perderás.

Con la API pasa lo mismo: `PUT /zones/{zone_id}/rulesets/phases/http_request_firewall_custom/entrypoint` **sustituye la lista entera**. Para añadir una sola regla, usa `POST /zones/{zone_id}/rulesets/{ruleset_id}/rules`.

## Cómo comprobarlo

Con la regla activa, una petición a la ruta bloqueada tiene que devolver 403:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.example.com/wp-login.php
# 403
```

En el panel, **Security › Analytics** muestra cuánto tráfico mitiga Cloudflare, cuánto sirve desde caché y cuánto llega al origen. La pestaña **Events** lista cada evento con la regla que lo disparó.

![Security › Analytics de las últimas 24 horas: 6.620 peticiones, 80 mitigadas por Cloudflare, 2.220 servidas por Cloudflare y 4.320 por el origen](media:blog/cloudflare-waf-guia/04-analitica.png)

En las últimas 24 horas, esta zona Free recibió 6.620 peticiones y Cloudflare mitigó 80 sin ninguna regla propia: lo hicieron las reglas gestionadas y la protección por defecto. En Free, los eventos son una **muestra**; usa ventanas de tiempo cortas para ver más detalle. Los datos se guardan 31 días.

## Límites y precios

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Reglas personalizadas | 5 | 20 | 100 | 1.000 |
| Expresiones regulares | — | — | ✓ | ✓ |
| Acción Log | — | — | — | ✓ |
| Rate limiting | 1 (por IP, 10 s) | 2 | 5 | 100 |
| Free Managed Ruleset | ✓ | ✓ | ✓ | ✓ |
| Cloudflare Managed Ruleset y OWASP | — | ✓ | ✓ | ✓ |
| Contraseñas filtradas | Solo contraseña | ✓ | ✓ | ✓ (más campos) |
| WAF attack score | — | — | Solo la clase | Completo |
| Listas personalizadas | 1 | 10 | 10 | 1.000 |
| Reglas de respuesta | 3 | 3 | 3 | 3 |

- Las listas admiten hasta 10.000 elementos en total en Free, Pro y Business (500.000 en Enterprise).
- **Payload logging** (ver qué parte de la petición disparó una regla, cifrado con tu clave) es de Enterprise.
- Las **IP Access rules**, **Zone Lockdown** y **User Agent Blocking** siguen existiendo, pero Cloudflare recomienda hacer lo mismo con reglas personalizadas. Bloquear por país con IP Access rules es solo de Enterprise; con una regla personalizada lo puedes hacer en cualquier plan.

## Documentación oficial

- [WAF: visión general y disponibilidad por plan](https://developers.cloudflare.com/waf/)
- [Reglas personalizadas](https://developers.cloudflare.com/waf/custom-rules/) y [crearlas en el panel](https://developers.cloudflare.com/waf/custom-rules/create-dashboard/)
- [Reglas de rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Reglas gestionadas](https://developers.cloudflare.com/waf/managed-rules/), [excepciones](https://developers.cloudflare.com/waf/managed-rules/waf-exceptions/) y [OWASP Core Ruleset](https://developers.cloudflare.com/waf/managed-rules/reference/owasp-core-ruleset/concepts/)
- [Detección de credenciales filtradas](https://developers.cloudflare.com/waf/detections/leaked-credentials/) y [WAF attack score](https://developers.cloudflare.com/waf/detections/attack-score/)
- [Acciones del lenguaje de reglas](https://developers.cloudflare.com/ruleset-engine/rules-language/actions/)
- [Terraform: reglas personalizadas](https://developers.cloudflare.com/terraform/additional-configurations/waf-custom-rules/) y [rulesets gestionados](https://developers.cloudflare.com/terraform/additional-configurations/waf-managed-rulesets/)
- [Security Analytics](https://developers.cloudflare.com/waf/analytics/security-analytics/) y [Security Events](https://developers.cloudflare.com/waf/analytics/security-events/)
- [Changelog del WAF](https://developers.cloudflare.com/waf/change-log/changelog/) y [reglas de emergencia del 21-oct-2026 en el ruleset Free](https://developers.cloudflare.com/changelog/post/2026-10-21-emergency-waf-release-free/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Turnstile, el CAPTCHA sin CAPTCHA, del widget a la verificación en el servidor.

## También te puede interesar

- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [SSL/TLS en Cloudflare: certificados de borde, Origin CA y modos de cifrado](/blog/cloudflare-ssl-tls-guia)
