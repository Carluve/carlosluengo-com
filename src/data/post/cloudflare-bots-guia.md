---
publishDate: 2026-02-24T09:00:00Z
draft: false
image: 'media:blog/cloudflare-bots-guia/portada.png'
title: 'Bots en Cloudflare: Bot Fight Mode, Super Bot Fight Mode y bots verificados'
excerpt: 'Serie Cloudflare, parte 8. Qué hace Bot Fight Mode en el plan Free (y por qué no admite excepciones), qué añade Super Bot Fight Mode, cómo funcionan la puntuación de bot y los bots verificados, cómo decidir qué crawlers de IA entran y cómo dejar pasar tu propia automatización.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'bots'
  - 'seguridad'
  - 'ia'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 8 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

El [WAF](/blog/cloudflare-waf-guia) frena las peticiones que tienen pinta de ataque. Pero buena parte del tráfico molesto no ataca nada: son scrapers, comprobadores de credenciales, navegadores sin cabeza y crawlers de IA que leen tu web entera. Cada petición parece normal. Lo raro es quién la hace. De eso se encargan las soluciones de bots de Cloudflare.

## Qué es

Cloudflare tiene tres productos de bots, uno por nivel de plan. Usan la misma tecnología de detección, pero te dejan hacer cosas muy distintas con ella:

- **Bot Fight Mode** (plan Free). Un interruptor. Detecta tráfico que coincide con patrones de bots conocidos y le pone un *challenge* que obliga al cliente a hacer cálculos costosos. No se puede ajustar ni crear excepciones.
- **Super Bot Fight Mode** (Pro, Business y Enterprise sin el complemento). Eliges qué hacer con cada grupo de tráfico (permitir, bloquear o pedir un *challenge*), proteges también los ficheros estáticos y puedes crear excepciones con reglas del WAF.
- **Bot Management** (**solo Enterprise**, como complemento). Da a cada petición una **puntuación de bot** de 1 a 99 y tú decides qué hacer con ella en tus reglas, ruta a ruta.

Alrededor de esos tres hay piezas que están en todos los planes:

- **Bots verificados.** Bots que Cloudflare ha comprobado que dicen quiénes son y se portan bien: Googlebot, Bingbot, monitores de disponibilidad, previsualizaciones de enlaces…
- **Políticas para crawlers y agentes de IA.** Decides por comportamiento (búsqueda, agente o entrenamiento) qué tráfico de IA dejas entrar.
- **`robots.txt` gestionado**, **AI Labyrinth** y **AI Crawl Control**, para expresar tus preferencias a los crawlers de IA y hacerlas cumplir.

## Casos de uso

- **Un blog o una web pequeña en Free.** Activar Bot Fight Mode corta los bots más simples (desde proveedores de *hosting* y navegadores sin cabeza) sin escribir ninguna regla.
- **Una tienda online.** Super Bot Fight Mode para bloquear lo claramente automatizado y una excepción para el procesador de pagos que te llama por *webhook*.
- **Login y alta de usuarios.** Con Bot Management, una regla más dura solo en `/login` que en el resto de la web.
- **Contenido que no quieres que entrene modelos.** Bloquear el entrenamiento y permitir la búsqueda, para seguir apareciendo en buscadores.
- **Tu propia automatización.** Monitorización, *scripts* de despliegue o pruebas que no deberían recibir un *challenge*.

## Arquitectura

![Recorrido de una petición: reglas personalizadas (donde vive la regla de AI Crawl Control y donde se crean las excepciones con Skip), rate limiting, reglas gestionadas y Super Bot Fight Mode antes del origen; aparte, Bot Fight Mode fuera del motor de reglas y sin excepciones; debajo, tabla de grupos de puntuación de bot](media:blog/cloudflare-bots-guia/00-arquitectura.png)

Las funciones de seguridad que usan el motor de reglas (*Ruleset Engine*) se ejecutan en fases, siempre en este orden:

1. **Protección DDoS de capa 7.**
2. **Reglas personalizadas** (`http_request_firewall_custom`). Aquí van tus excepciones con *Skip* y aquí crea AI Crawl Control su regla de bloqueo.
3. **Rate limiting** (`http_ratelimit`).
4. **Reglas gestionadas** (`http_request_firewall_managed`).
5. **Super Bot Fight Mode** (`http_request_sbfm`).

Si una regla bloquea o pide un *challenge*, la petición no llega a las fases siguientes. Por eso una regla personalizada puede hacer una excepción a Super Bot Fight Mode: va antes.

**Bot Fight Mode es la excepción.** No usa el motor de reglas, va por su propio camino. Por eso las acciones *Skip*, *Bypass* y *Allow* de las reglas no le afectan.

Los grupos de puntuación son estos:

| Grupo | Puntuación |
|---|---|
| Not computed | 0: no se evaluó (no significa que sea humano) |
| Automated (*definitely automated*) | 1 |
| Likely automated | 2 a 29 |
| Likely human | 30 a 99 |
| Verified bot | bots buenos conocidos, aparte de la puntuación |

Super Bot Fight Mode usa esos grupos fijos. La puntuación exacta para escribir tus propios umbrales es **solo Enterprise**.

## Implementación paso a paso

Las capturas son de `carluve.dev`, una zona en plan **Free**. En Free no aparece la configuración de Super Bot Fight Mode; esa parte la explico con la documentación oficial.

### 1. Activa Bot Fight Mode (Free)

Todo lo de bots está en **Security › Settings**, filtrando por **Bot traffic**. Ahí están las políticas de IA, AI Labyrinth y la detección de bots.

![Security › Settings, sección Bot traffic de una zona Free: AI Crawler and Agent access policies, AI Labyrinth, Bot management siempre activo y Challenge passage](media:blog/cloudflare-bots-guia/01-ajustes-bots.png)

Activar **Bot fight mode** es un clic. Antes, ten claro lo que implica:

- **Protege todo el dominio.** No puedes limitarlo a unas rutas.
- **Puede poner *challenges* a tu API o a tu app móvil.** Un cliente de API no resuelve un *challenge*.
- **No admite excepciones.** Ni con reglas personalizadas ni con Page Rules. Lo único que lo evita es una **regla de IP Access** que coincida antes con la petición (por ejemplo, *Allow* para la IP de tu monitorización).
- **Activa JavaScript Detections**, y en Free no se puede desactivar. Si tu web tiene una política CSP, tiene que permitir lo que hay bajo `/cdn-cgi/challenge-platform/`. Si usas *nonces*, Cloudflare los lee de la cabecera CSP y los añade a su script. Con un *nonce* puesto en una etiqueta `<meta>` no funciona.

### 2. Decide qué hacer con los crawlers de IA

En la misma página, **AI Crawler and Agent access policies** separa el tráfico de IA por comportamiento:

- **Search**: indexa tu contenido para responder preguntas después.
- **Agent**: actúa en tiempo real en nombre de una persona (el *fetch* de un chat, un agente que navega).
- **Training**: se lleva tu contenido para entrenar o ajustar un modelo. Incluye los crawlers mixtos que sirven a la vez para búsqueda y entrenamiento.

Para cada uno eliges **Block**, **Block on pages with ads**, **Allow (do not block)** o, solo para Training, **Disallow**. Cada política se aplica a los bots verificados con ese comportamiento y a los no verificados que coinciden con él. Los agentes personales más comunes heredan la política de Agent, y puedes ajustarlos uno a uno.

![Políticas de acceso para crawlers y agentes de IA: Search, Training y Agents en Allow, la lista de agentes personales y el interruptor Enable Bot Preference Sync activado](media:blog/cloudflare-bots-guia/02-politicas-ia.png)

Con **Enable Bot Preference Sync** activado, Cloudflare traduce esas políticas a tu `robots.txt`:

- Si ya tienes un `robots.txt` (responde 200), Cloudflare **antepone** su bloque gestionado al tuyo. Si no tienes, crea uno.
- Solo añade contenido cuando al menos una política está en Block, Block on pages with ads o, en Training, Disallow. Si todo está permitido, tu `robots.txt` se sirve tal cual.
- Con **Disallow** en Training y la sincronización activa, además de escribirlo en `robots.txt`, Cloudflare **bloquea en el borde** a los crawlers de entrenamiento. Los crawlers mixtos quedan fuera de ese bloqueo.

Recuerda que `robots.txt` es voluntario: expresa tu preferencia, no impide nada. Para hacerla cumplir están el bloqueo en el borde y AI Crawl Control.

**AI Labyrinth**, también en esta página, añade enlaces invisibles con `nofollow` a tus páginas. Los crawlers que no respetan las instrucciones los siguen y acaban en un laberinto de contenido generado. No afecta al SEO ni a lo que ve una persona.

### 3. Mira qué crawlers de IA te visitan

**AI Crawl Control** (en el menú de la zona) lista los crawlers de IA que piden tu contenido: quién es, de qué operador, en qué categoría, cuántas peticiones y cuántas veces se han saltado tu `robots.txt`. Para cada uno puedes elegir **Allow** o **Block**.


Ten en cuenta tres cosas:

- **En Free detecta por *User-Agent*.** Ve los crawlers conocidos que se identifican. En planes superiores usa además los identificadores de detección de Bot Management.
- **Bloquear crea una regla personalizada** llamada *AI Crawl Control* en **Security › Security rules**. Es una sola regla para todos los crawlers bloqueados, pero ocupa un hueco de tus reglas personalizadas (en Free tienes cinco).
- **Esa regla se añade al final** de tus reglas personalizadas. Si una regla anterior hace *Skip*, o una Redirect Rule o Transform Rule cambia la petición, un crawler bloqueado puede colarse. Arrastra la regla de AI Crawl Control arriba si quieres que mande.

En planes de pago puedes cambiar la respuesta al bloquear: `403 Forbidden` o `402 Payment Required`, con un texto propio.

### 4. Super Bot Fight Mode (Pro y superiores)

Si subes de plan, primero **apaga Bot Fight Mode** y luego activa **Super Bot fight mode** en el mismo sitio. Cada grupo tiene su ajuste:

- **Definitely automated** (puntuación 1): Allow, Block o Managed Challenge.
- **Likely automated** (2 a 29): igual, pero desde Business. En Pro no aparece.
- **Verified bots**: Allow o Block.
- **Static resource protection**: aplica las acciones también a imágenes, CSS, JS, fuentes, PDF… y a todo lo que hay bajo `/.well-known/`. Puede bloquear bots buenos, como los clientes de correo que descargan imágenes. Solo tiene efecto si al menos uno de los tres grupos no está en Allow.
- **JavaScript detections**: aquí sí es opcional.
- **Optimize for WordPress**: deja pasar las peticiones *loopback* que WordPress se hace a sí mismo.

Un aviso de la documentación: si usas **Cloudflare Tunnel**, deja **Definitely automated** en **Allow**. Si no, el túnel puede fallar con `websocket: bad handshake`.

### 5. Excluye tu propia automatización

Es lo que cambia de verdad entre Free y los planes de pago.

**En Free**, Bot Fight Mode no admite *Skip*. Si tu monitorización recibe *challenges*, crea una regla de IP Access con *Allow* para su IP, apaga Bot Fight Mode o pasa a un plan con Super Bot Fight Mode.

**Con Super Bot Fight Mode**, crea una regla personalizada con la acción **Skip** y marca **All Super Bot Fight Mode rules**. La petición se salta esa fase y sigue por el resto de controles de seguridad.

```
(ip.src in {203.0.113.10 203.0.113.11})
```

Algunas pautas:

- **Identifica tu automatización por IP** u otro dato que no se pueda falsificar fácilmente. Un *User-Agent* lo puede copiar cualquiera.
- **Coloca la regla de Skip arriba.** Las reglas se evalúan en orden.
- **Deja activado *Log matching requests*.** Es el valor por defecto y te deja ver en los eventos qué peticiones se saltaron la protección.
- **No bloquees a los bots buenos sin querer.** En cualquier plan, el campo `cf.client.bot` (*Known Bots* en el editor) indica si la petición viene de un bot verificado. Úsalo en tus reglas propias:

```
(ip.src.country in {"US" "MX"} and not cf.client.bot)
```

Con *Managed Challenge*, esa regla pide una prueba al tráfico de esos países, salvo a Googlebot, Bingbot y el resto de bots verificados.


### 6. Bot Management (solo Enterprise)

Bot Management solo existe en zonas Enterprise con el complemento, y sustituye a Bot Fight Mode y Super Bot Fight Mode. No bloquea nada por su cuenta: calcula datos y tú escribes las reglas que actúan sobre ellos.

- **Puntuación de bot** (`cf.bot_management.score`), de 1 a 99. Por debajo de 30 suele ser tráfico de bots. Sale sobre todo de un modelo de *machine learning* que se reentrena a menudo: revisa de vez en cuando las reglas que dependen de ella.
- **Campos extra para tus reglas**: bot verificado, recurso estático, huellas TLS JA3/JA4, identificadores de detección, etiquetas, agentes firmados y la categoría del bot verificado (`cf.verified_bot_category`).
- **Los mismos datos en Workers**, en `request.cf.botManagement` (por ejemplo, `request.cf.botManagement.score`).
- **JavaScript Detections con efecto real.** El resultado queda en `cf.bot_management.js_detection.passed`, pero no se aplica solo: tienes que usarlo en una regla, con *Managed Challenge* y nunca en la primera página que visita alguien.

La plantilla de Cloudflare para lo claramente automatizado:

```
(cf.bot_management.score eq 1 and not cf.bot_management.verified_bot and not cf.bot_management.static_resource)
```

Y una regla solo para el login, que en Super Bot Fight Mode no se puede hacer:

```
(cf.bot_management.score lt 30 and not cf.bot_management.verified_bot and http.request.uri.path eq "/login")
```

Un detalle que da muchos falsos positivos: las peticiones sin cabecera `User-Agent` reciben puntuación 1 directamente. Pasa con algunos proxies corporativos que la quitan.

### Lo mismo, como código

La configuración de bots de la zona vive en `/zones/{zone_id}/bot_management` (`GET` para leerla, `PUT` para cambiarla). Con el proveedor de Terraform (v5), el recurso es `cloudflare_bot_management`. Para la zona Free de este post:

```hcl
resource "cloudflare_bot_management" "bots" {
  zone_id                     = var.zone_id
  fight_mode                  = true       # Bot Fight Mode
  crawler_protection          = "enabled"  # AI Labyrinth
  ai_training                 = "disallow" # política Training
  bot_preference_sync_enabled = true       # escribirlo en robots.txt
}
```

En Pro o superior, Super Bot Fight Mode se configura en el mismo recurso:

```hcl
resource "cloudflare_bot_management" "bots" {
  zone_id                         = var.zone_id
  fight_mode                      = false
  sbfm_definitely_automated       = "managed_challenge"
  sbfm_verified_bots              = "allow"
  sbfm_static_resource_protection = false
  enable_js                       = true
  optimize_wordpress              = true
}
```

Y la excepción para tu monitorización, como regla personalizada que salta la fase de Super Bot Fight Mode:

```hcl
resource "cloudflare_ruleset" "waf_custom" {
  zone_id = var.zone_id
  name    = "Reglas personalizadas"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules = [{
    ref         = "skip_sbfm_monitorizacion"
    description = "Monitorización: saltar Super Bot Fight Mode"
    expression  = "(ip.src in {203.0.113.10 203.0.113.11})"
    action      = "skip"
    action_parameters = {
      phases = ["http_request_sbfm"]
    }
    logging = {
      enabled = true
    }
  }]
}
```

El token necesita *Bot Management Write* para el primer recurso y *Zone WAF: Edit* para el segundo. Igual que en el [post del WAF](/blog/cloudflare-waf-guia): el `cloudflare_ruleset` asume que controla **todas** las reglas de esa fase, incluida la que crea AI Crawl Control. Impórtalas antes o las perderás.

Otro aviso de la documentación: las reglas de Super Bot Fight Mode **ya no se pueden modificar con la API de Rulesets**. Usa el endpoint de `bot_management`.

## Cómo comprobarlo

Con Bot Preference Sync activo y alguna política en bloqueo, tu `robots.txt` tiene que empezar por el bloque de Cloudflare. No hace falta purgar la caché; aparece en unos segundos:

```bash
curl -s https://www.example.com/robots.txt | grep -i "Cloudflare Managed"
# BEGIN Cloudflare Managed content
```

Con JavaScript Detections activo, el HTML de tus páginas debería llevar un script que apunta a `/cdn-cgi/challenge-platform/`:

```bash
curl -s https://www.example.com/ | grep -o '/cdn-cgi/challenge-platform/[^"]*' | head -1
```

Si tu origen responde con `Cache-Control: no-transform`, Cloudflare no lo inyecta.

En el panel, **Security › Analytics › Events** lista cada acción. El campo **Service** dice qué producto actuó: *Bot Fight Mode*, *Super Bot Fight Mode*, la regla de AI Crawl Control o *AI Labyrinth* (que no bloquea, solo registra que sirvió el laberinto y si alguien entró).


En Pro, **Security › Analytics › Bot analysis** muestra un informe de las últimas 24 horas con el reparto del tráfico por grupos. En Business y Enterprise hay una analítica de bots completa dentro de Security Analytics.

## Límites y precios

| Función | Disponibilidad |
|---|---|
| Bot Fight Mode | Plan Free |
| Políticas de IA (Search, Agent, Training) | Todos los planes |
| `robots.txt` gestionado y AI Labyrinth | Todos los planes |
| AI Crawl Control | Todos los planes (en Free, detección por *User-Agent*) |
| Respuesta propia al bloquear crawlers (403/402) | Planes de pago |
| Campo `cf.client.bot` en reglas | Todos los planes |
| Super Bot Fight Mode: Definitely automated, bots verificados, estáticos, WordPress | Pro y superiores |
| Super Bot Fight Mode: Likely automated | Business y superiores |
| Puntuación de bot 1–99, JA3/JA4, IDs de detección | **Solo Enterprise** (Bot Management) |
| Aplicar JavaScript Detections en reglas | **Solo Enterprise** (Bot Management) |

- **Bot Fight Mode y Super Bot Fight Mode son gratis** dentro de su plan. Bot Management es un complemento de Enterprise que añade el equipo de cuentas.
- **Los ajustes de bots no gastan reglas personalizadas.** La regla que crea AI Crawl Control al bloquear sí.
- **Pay per crawl** (cobrar a los crawlers de IA por acceso) sigue en beta privada.
- **Para que tu bot sea verificado**, se solicita desde el panel de la cuenta (formulario de BotBase) y tiene que identificarse con [Web Bot Auth](https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/) o con validación por IP. El directorio público de bots verificados está en [Cloudflare Radar](https://radar.cloudflare.com/bots/directory).

## Documentación oficial

- [Soluciones de bots: visión general](https://developers.cloudflare.com/bots/) y [comparativa por plan](https://developers.cloudflare.com/bots/plans/)
- [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/) y [Super Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/super-bot-fight-mode/)
- [Bot Management](https://developers.cloudflare.com/bots/get-started/bot-management/), [puntuación de bot](https://developers.cloudflare.com/bots/concepts/bot-score/) y [variables](https://developers.cloudflare.com/bots/reference/bot-management-variables/)
- [Bots verificados](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/)
- [JavaScript Detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/) y [protección de recursos estáticos](https://developers.cloudflare.com/bots/additional-configurations/static-resources/)
- [Políticas para crawlers y agentes de IA](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/), [`robots.txt` gestionado](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) y [AI Labyrinth](https://developers.cloudflare.com/bots/additional-configurations/ai-labyrinth/)
- [AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/) y [su relación con el WAF](https://developers.cloudflare.com/ai-crawl-control/configuration/ai-crawl-control-with-waf/)
- [Orden de ejecución de las funciones de seguridad](https://developers.cloudflare.com/waf/feature-interoperability/) y [opciones de Skip](https://developers.cloudflare.com/waf/custom-rules/skip/options/)
- [Falsos positivos de Bot Fight Mode y Super Bot Fight Mode](https://developers.cloudflare.com/bots/troubleshooting/false-positives/)
- [API de Bot Management](https://developers.cloudflare.com/api/resources/bot_management/)
- [Changelog de bots](https://developers.cloudflare.com/bots/changelog/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Rate limiting: limitar peticiones sin bloquear a tus usuarios.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
