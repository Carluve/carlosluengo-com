---
publishDate: 2026-02-10T09:00:00Z
draft: false
image: 'media:blog/cloudflare-turnstile-guia/portada.png'
title: 'Turnstile: el CAPTCHA sin CAPTCHA, del widget a la verificación en el servidor'
excerpt: 'Serie Cloudflare, parte 6. Qué es Turnstile, en qué se diferencian sus tres modos, cómo poner el widget en un formulario, por qué sin Siteverify en el servidor no protege nada (con un ejemplo en Workers), cómo probarlo con claves de test y cómo combinarlo con el WAF mediante pre-clearance.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'turnstile'
  - 'bots'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 6 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

El [WAF](/blog/cloudflare-waf-guia) decide qué peticiones no deberían llegar a tu servidor. Pero un formulario de contacto o de registro recibe peticiones que, una a una, parecen legítimas. La pregunta ahí no es «¿esta petición es un ataque?», sino «¿hay una persona detrás?». Para eso está Turnstile.

## Qué es

Turnstile es la alternativa de Cloudflare al CAPTCHA. Pones un widget en tu página, el navegador del visitante resuelve en segundo plano una serie de pruebas (prueba de trabajo, comprobación de APIs del navegador, detección de rarezas propias de bots…) y, si las pasa, recibe un **token**. Tu servidor envía ese token a Cloudflare para comprobar que es válido. No hay semáforos ni letras torcidas.

Tres cosas que conviene saber desde el principio:

- **No necesita que tu web pase por Cloudflare.** Funciona en cualquier sitio, aunque el DNS esté en otro proveedor o la web esté detrás de otra CDN.
- **Se configura a nivel de cuenta, no de zona.** Cada widget tiene un nombre, una lista de hostnames, un modo, una **sitekey** (pública, va en el HTML) y una **secret key** (privada, solo en tu servidor).
- **El widget solo no protege nada.** La validación en el servidor con la API **Siteverify** es obligatoria. Un bot puede enviar cualquier cadena como token sin haber pasado ninguna prueba.

**Modos del widget:**

- **Managed** (el recomendado): Cloudflare decide. La mayoría de visitantes no tiene que hacer nada; si hay señales de riesgo, aparece una casilla para marcar. Nunca hay imágenes ni texto que descifrar.
- **Non-interactive**: el widget se ve, con un indicador de carga, pero el visitante nunca tiene que pulsar nada.
- **Invisible**: no se ve nada. Si lo usas, tu política de privacidad tiene que enlazar el [Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/) de Cloudflare.

**Planes.** Turnstile tiene un plan Free y uno Enterprise, independientes del plan de tus zonas. Son **solo Enterprise**: los widgets sin hostnames preconfigurados, los Ephemeral IDs, quitar la marca de Cloudflare (*offlabel*) y el Bot Fight Mode del widget.

## Casos de uso

- **Formularios de contacto y comentarios.** El caso clásico: cortar el spam sin hacer sufrir a quien escribe.
- **Registro e inicio de sesión.** Frenar la creación masiva de cuentas y el relleno de credenciales. Combina bien con el rate limiting y la detección de contraseñas filtradas del [WAF](/blog/cloudflare-waf-guia).
- **Acciones que cuestan dinero.** Envío de SMS o correos de verificación, búsquedas caras, descargas, votaciones.
- **Aplicaciones de una sola página (SPA).** Un *challenge* del WAF devuelve una página HTML, y eso rompe las llamadas `fetch` de tu aplicación. Con **pre-clearance**, el visitante resuelve Turnstile una vez y el WAF ya no le pide más pruebas durante un tiempo.

## Arquitectura

![Flujo de Turnstile: el navegador carga el widget, resuelve los retos con challenges.cloudflare.com y recibe un token; lo envía con el formulario a tu servidor o Worker, que lo valida en Siteverify con la secret key. Rama opcional: con pre-clearance, Turnstile deja además la cookie cf_clearance y el WAF de la zona no vuelve a pedir challenge. Debajo, tabla con los tres modos del widget](media:blog/cloudflare-turnstile-guia/00-arquitectura.png)

1. Tu página carga el script `api.js` desde `challenges.cloudflare.com` y pinta el widget con tu **sitekey**.
2. El navegador resuelve los retos. Si todo va bien, Turnstile genera un **token** y lo mete en un campo oculto del formulario, `cf-turnstile-response`.
3. El visitante envía el formulario. El token viaja con el resto de campos a **tu servidor**.
4. Tu servidor llama a **Siteverify** con la **secret key** y el token.
5. Siteverify responde con `success: true` o `false`, y con datos para comprobar: el `hostname` donde se resolvió el reto, el `action` que le pusiste al widget y la hora. Solo con `success: true` procesas el formulario.

Las reglas del token:

- **Caduca a los 300 segundos** (5 minutos). Si el visitante tarda más en enviar, Siteverify devuelve `timeout-or-duplicate` y hay que renovar el widget con `turnstile.reset()`.
- **Es de un solo uso.** Un token ya validado se rechaza. Ojo: la detección de reutilización tarda en propagarse por la red de Cloudflare. El objetivo publicado es rechazar al menos el 99 % de las repeticiones que lleguen cinco segundos o más después de la primera validación.
- **Mide como mucho 2.048 caracteres.**

## Implementación paso a paso

Las capturas son del panel de Cloudflare, con los nombres de los widgets, los hostnames y los datos de la cuenta tapados. Los contadores que se ven pueden no coincidir con los de Free (más abajo, en límites, están los de Free). El widget del paso 2 se rellenó para la captura y no llegó a crearse.

### 1. Mira la lista de widgets

En el panel, **Application security › Turnstile**. Cada fila es un widget con su número de hostnames, la región, la tasa de visitantes que probablemente son humanos (*Likely human*), el modo y si emite pre-clearance.

![Application security › Turnstile: lista de widgets con número de hostnames, región, tasa de probables humanos, modo y pre-clearance, los botones para añadir un widget a mano o con Spin, y el aviso naranja que sale cuando un widget no recibe llamadas a Siteverify](media:blog/cloudflare-turnstile-guia/01-widgets.png)

Fíjate en el aviso naranja: **«Siteverify isn't being called for…»**. El panel lo muestra cuando un widget genera tokens que nadie valida en el servidor. Un widget así se ve en el formulario, el visitante lo resuelve… y no protege nada, porque un bot puede saltárselo enviando un token inventado. Es el error más común con Turnstile, y está bien que el panel lo grite.

Hay dos formas de dar de alta un widget:

- **Add widget manually**: el formulario de los pasos siguientes.
- **Set up with Spin**: introduces los dominios, Cloudflare crea el widget y te da la sitekey, la secret key y un *prompt* para tu agente de código (Claude Code, Cursor, Codex…) que pone el widget en tus formularios y añade la llamada a Siteverify. El *prompt* lleva la sitekey, pero no la secret key. Spin es de disponibilidad general desde agosto de 2026 y también funciona desde Wrangler con `wrangler turnstile widget create`.

### 2. Crea el widget

**Add widget manually**. Lo primero: un nombre que te diga dónde se usa y los **hostnames** donde se permite el widget.

![Formulario Add Widget: campo Widget name con «Formulario de contacto» y bloque Hostname Management para escribir un hostname o elegir una de las zonas de la cuenta](media:blog/cloudflare-turnstile-guia/02-alta.png)

Sobre los hostnames:

- Escribe nombres de dominio completos: `example.com` o `www.example.com`. Sin `https://`, sin puerto, sin ruta y sin comodines.
- Un hostname **incluye todos sus subdominios**. `example.com` vale para `www.example.com` y `tienda.example.com`. Si añades `www.example.com`, no vale para `example.com`.
- Si el dominio es una zona de tu cuenta, lo puedes elegir de la lista. Para pre-clearance es obligatorio (paso 5).
- No pongas `localhost` en el widget de producción. Para desarrollo usa las claves de prueba (más abajo).

Un widget por formulario o por tipo de acción te da analíticas separadas. Si prefieres uno solo para todo, distingue los formularios con `data-action`.

### 3. Elige el modo y la región

Más abajo en el mismo formulario están la región, el modo y el pre-clearance.

![Parte inferior del formulario: Widget Mode con Managed marcado como recomendado, Non-interactive e Invisible, y el interruptor «Skip future security rule challenges for verified visitors», que es el pre-clearance, desactivado](media:blog/cloudflare-turnstile-guia/03-modos.png)

- **Widget region**: *Rest of World* o *China*. **No se puede cambiar después de crear el widget.** La región China usa otros dominios (`challenges.cloudflare-cn.com`) y hay que pedírsela al equipo de cuenta. Si no tienes visitantes en China continental, deja *Rest of World*.
- **Widget mode**: empieza con **Managed**. Si la casilla te molesta en un flujo concreto, prueba Non-interactive. Invisible, solo si has actualizado tu política de privacidad.
- **Skip future security rule challenges for verified visitors**: es el pre-clearance. Lo vemos en el paso 5.

Al pulsar **Create** obtienes la **sitekey** y la **secret key**. Guarda la secreta en tu gestor de secretos, nunca en el repositorio ni en el HTML.

### 4. Pon el widget en el formulario

La forma más sencilla es el **renderizado implícito**: cargas el script y pones un `div` con la clase `cf-turnstile` dentro del formulario.

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<form action="/contacto" method="POST">
  <input type="email" name="email" required />
  <textarea name="mensaje" required></textarea>

  <div class="cf-turnstile"
       data-sitekey="TU_SITEKEY"
       data-action="contacto"
       data-theme="auto"
       data-size="flexible"></div>

  <button type="submit">Enviar</button>
</form>
```

Turnstile añade por su cuenta un campo oculto `cf-turnstile-response` con el token, que viaja con el formulario.

Algunas pautas:

- **Carga `api.js` siempre desde su URL oficial.** No lo copies a tu servidor ni lo cachees: cuando Cloudflare lo actualice, Turnstile dejará de funcionar.
- **Si usas Content Security Policy**, añade `https://challenges.cloudflare.com` a `script-src` y `frame-src`. Si filtras el tráfico de salida de una red, desde julio de 2026 Turnstile también puede hacer peticiones a `hagen.challenges.cloudflare.com` y `brunhild.challenges.cloudflare.com`.
- **`data-action`** es una etiqueta libre (hasta 32 caracteres: letras, números, `_` y `-`) que Siteverify te devuelve. Sirve para comprobar que el token se generó en el formulario que esperas.
- **En una SPA** usa el **renderizado explícito**: cargas `api.js?render=explicit` y llamas a `turnstile.render()` cuando aparece el formulario. Si la página sigue abierta tras un envío, llama a `turnstile.reset(widgetId)` antes de permitir otro: cada token vale una sola vez.

### 5. (Opcional) Pre-clearance con el WAF

Si tu web está **con proxy** en Cloudflare, Turnstile puede dejar además una cookie `cf_clearance` al resolver el reto. Con esa cookie, el WAF de la zona no vuelve a pedirle un *challenge* al visitante durante un tiempo.

Para qué sirve: un *challenge* del WAF responde con una página HTML. Si la petición es un `fetch` de tu aplicación, esa página no se puede mostrar y la llamada falla. Con pre-clearance, el visitante resuelve Turnstile en una página normal y luego sus llamadas a la API pasan las reglas de *challenge* sin cortes.

Cómo se configura:

1. Al crear o editar el widget, activa **Skip future security rule challenges for verified visitors** y elige el nivel.
2. El hostname del widget tiene que ser **una zona de tu cuenta**, la misma que tiene la regla del WAF.
3. Si usas CSP, `connect-src` tiene que incluir `'self'`: Turnstile pide la cookie a una ruta `/cdn-cgi/` de tu propio dominio.

Los niveles, de menos a más:

| Nivel | Valor en la API | Se salta los challenges… |
|---|---|---|
| Non-interactive | `jschallenge` | Non-Interactive |
| Managed | `managed` | Non-Interactive y Managed |
| Interactive | `interactive` | Non-Interactive, Managed e Interactive |

La cookie dura lo que diga el **Challenge Passage** de la zona (**Security › Settings**): 30 minutos por defecto. Cloudflare recomienda entre 15 y 45. Y una aclaración importante: el pre-clearance **no sustituye** a Siteverify. El token sigue existiendo y hay que validarlo igual.

### 6. Valida el token en el servidor

Este es el paso que convierte el widget en protección. Un ejemplo con un Worker que recibe el formulario:

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/contacto") {
      return new Response("No encontrado", { status: 404 });
    }

    const form = await request.formData();
    const token = form.get("cf-turnstile-response");
    if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
      return new Response("Falta la verificación", { status: 400 });
    }

    let result;
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: token,
          remoteip: request.headers.get("CF-Connecting-IP") ?? "",
        }),
      });
      result = await r.json();
    } catch {
      return new Response("No se pudo verificar", { status: 503 });
    }

    if (
      !result.success ||
      result.action !== "contacto" ||
      result.hostname !== "www.example.com"
    ) {
      return new Response("Verificación fallida", { status: 403 });
    }

    // Aquí, y solo aquí, procesas el formulario.
    return new Response("Gracias, mensaje recibido");
  },
};
```

La secret key va como secreto del Worker, no en `wrangler.jsonc`:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

Pautas:

- **Comprueba `hostname` y `action`**, no solo `success`. Así un token generado en otro sitio o en otro formulario no te vale.
- **`remoteip` es opcional**, pero ayuda. En un Worker o en un hostname con proxy, la IP real del visitante está en `CF-Connecting-IP`.
- **Si reintentas la llamada a Siteverify** (por un error de red), manda el mismo `idempotency_key` (un UUID que generas tú) en todos los intentos. Es el mecanismo que ofrece Siteverify para reintentar con seguridad un token que es de un solo uso.
- **Si Siteverify falla, no dejes pasar la petición.** Fallar cerrado es la opción segura.

Los códigos de error que te vas a encontrar:

| Código | Qué significa |
|---|---|
| `missing-input-secret` / `invalid-input-secret` | Falta la secret key o no es válida |
| `missing-input-response` | No ha llegado el token |
| `invalid-input-response` | Token inválido, mal formado o caducado |
| `timeout-or-duplicate` | Token caducado (más de 5 minutos) o ya usado |
| `bad-request` | Petición mal formada |
| `internal-error` | Error de Cloudflare; reintenta |

### Lo mismo, como código

Con el proveedor de Terraform (v5), el widget:

```hcl
resource "cloudflare_turnstile_widget" "contacto" {
  account_id      = var.account_id
  name            = "Formulario de contacto"
  domains         = ["example.com"]
  mode            = "managed"   # "managed", "non-interactive" o "invisible"
  region          = "world"     # no se puede cambiar después
  clearance_level = "managed"   # pre-clearance; "no_clearance" para desactivarlo
}

output "turnstile_sitekey" {
  value = cloudflare_turnstile_widget.contacto.sitekey
}

output "turnstile_secret" {
  value     = cloudflare_turnstile_widget.contacto.secret
  sensitive = true
}
```

Fíjate en `non-interactive` con guion: es el valor de la API y del proveedor v5. Los ejemplos de la documentación de Turnstile para Terraform son de la v4 y usan `non_interactive`. El token de API necesita el permiso *Turnstile Sites Write* (o *Account Settings Write*).

Y la regla del WAF que aprovecha el pre-clearance: un Managed Challenge a los `POST` de la API, que el visitante con la cookie ya no verá:

```hcl
resource "cloudflare_ruleset" "waf_custom" {
  zone_id = var.zone_id
  name    = "Reglas personalizadas"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules = [{
    ref         = "challenge_api"
    description = "Challenge a los POST de la API"
    expression  = "(http.request.method eq \"POST\" and starts_with(http.request.uri.path, \"/api/\"))"
    action      = "managed_challenge"
  }]
}
```

Recuerda lo que vimos en el [post del WAF](/blog/cloudflare-waf-guia): este recurso controla **todas** las reglas personalizadas de la zona. Si ya tenías otras, inclúyelas en la misma lista.

Con la API, los widgets cuelgan de la cuenta:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/challenges/widgets" \
  --request POST \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{"name": "Formulario de contacto", "domains": ["example.com"], "mode": "managed"}'
```

Para rotar la secret key: `POST /accounts/{account_id}/challenges/widgets/{sitekey}/rotate_secret`. El parámetro `invalidate_immediately` decide si la clave antigua deja de valer en el acto (`true`) o no (`false`), para que te dé tiempo a desplegar la nueva.

## Cómo comprobarlo

**Con las claves de prueba.** Cloudflare publica sitekeys y secret keys ficticias que funcionan en cualquier dominio, también en `localhost`. Son las que debes usar en desarrollo y en tests automáticos (Playwright, Cypress y Selenium se detectan como bots).

| Sitekey | Comportamiento |
|---|---|
| `1x00000000000000000000AA` | Siempre pasa (visible) |
| `2x00000000000000000000AB` | Siempre falla (visible) |
| `1x00000000000000000000BB` | Siempre pasa (invisible) |
| `2x00000000000000000000BB` | Siempre falla (invisible) |
| `3x00000000000000000000FF` | Fuerza la casilla interactiva |

| Secret key | Comportamiento |
|---|---|
| `1x0000000000000000000000000000000AA` | Siempre valida |
| `2x0000000000000000000000000000000AA` | Siempre falla |
| `3x0000000000000000000000000000000AA` | Devuelve `timeout-or-duplicate` |

Las sitekeys de prueba generan el token `XXXX.DUMMY.TOKEN.XXXX`. Tus claves reales lo rechazan, así que en desarrollo cambia las dos. Puedes probar Siteverify directamente:

```bash
curl -s https://challenges.cloudflare.com/turnstile/v0/siteverify \
  -d secret=1x0000000000000000000000000000000AA \
  -d response=XXXX.DUMMY.TOKEN.XXXX
# {"success":true,"hostname":"example.com","error-codes":[],...}

curl -s https://challenges.cloudflare.com/turnstile/v0/siteverify \
  -d secret=2x0000000000000000000000000000000AA \
  -d response=XXXX.DUMMY.TOKEN.XXXX
# {"success":false,"error-codes":["invalid-input-response"],...}
```

Con una clave de prueba, el `hostname` es siempre `example.com` y la respuesta no trae `action`. Las comprobaciones de `hostname` y `action` de tu servidor pruébalas con las claves reales.

**Contra tu propio endpoint.** La prueba que importa: un envío **sin token** o con un token inventado tiene que fallar.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.example.com/contacto \
  -d email=bot@example.com -d mensaje=hola -d cf-turnstile-response=inventado
# 403
```

Si esto devuelve 200, tu servidor no está validando el token.

**En el panel.** Abre el widget en **Application security › Turnstile**. Verás la tasa de resolución (cuántos retos se resolvieron sin interacción, cuántos con la casilla y cuántos con pre-clearance), el tráfico por hostname, país, navegador, ASN o IP, y la **validación de tokens**: cuántas llamadas a Siteverify, cuántos tokens válidos y cuántos inválidos. Si esa última parte está a cero, tu servidor no llama a Siteverify. Es lo mismo que señala el aviso naranja de la lista.

## Límites y precios

Turnstile es gratuito y sus límites no dependen del plan de tus zonas. Lo que es **solo Enterprise**:

| Solo Enterprise | Qué te da |
|---|---|
| Más widgets y hostnames | Free: hasta 20 widgets por cuenta y 10 hostnames por widget |
| Widgets sin hostnames preconfigurados | Un mismo widget en cualquier dominio |
| Ephemeral IDs | Un identificador del dispositivo en la respuesta de Siteverify (`metadata.ephemeral_id`) |
| Offlabel | Quitar la marca de Cloudflare del widget |
| Bot Fight Mode del widget | Retos más costosos para los bots maliciosos |
| Analítica de 30 días | Free: 7 días |

- Retos y validaciones **ilimitados** en Free.
- Pre-clearance, los tres modos y las claves de prueba están en Free.
- El pre-clearance solo funciona si el hostname está **con proxy** en Cloudflare. El resto de Turnstile, no.
- La **región China** hay que pedirla al equipo de cuenta y no se puede cambiar después de crear el widget.

## Documentación oficial

- [Turnstile: visión general](https://developers.cloudflare.com/turnstile/) y [planes](https://developers.cloudflare.com/turnstile/plans/)
- [Modos del widget](https://developers.cloudflare.com/turnstile/concepts/widget/) y [gestión de hostnames](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)
- [Poner el widget en tu página](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- [Validar el token con Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Claves de prueba](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Pre-clearance y la cookie cf_clearance](https://developers.cloudflare.com/cloudflare-challenges/concepts/clearance/) y [Challenge Passage](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/challenge-passage/)
- [Content Security Policy](https://developers.cloudflare.com/turnstile/reference/content-security-policy/)
- [Turnstile Spin](https://developers.cloudflare.com/turnstile/spin/)
- [Gestionar widgets con la API](https://developers.cloudflare.com/turnstile/get-started/widget-management/api/) y [con Terraform](https://developers.cloudflare.com/turnstile/get-started/widget-management/terraform/)
- [Analíticas de Turnstile](https://developers.cloudflare.com/turnstile/turnstile-analytics/) y [validación de tokens](https://developers.cloudflare.com/turnstile/turnstile-analytics/token-validation/)
- [Changelog de Turnstile](https://developers.cloudflare.com/turnstile/changelog/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** DDoS: qué protege Cloudflare de serie y cómo ajustarlo.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
