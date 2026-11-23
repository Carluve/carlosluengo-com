---
publishDate: 2026-07-14T09:00:00Z
draft: false
image: 'media:blog/cloudflare-credenciales-filtradas-guia/portada.png'
title: 'Credenciales filtradas en Cloudflare: detectar contraseñas robadas en tu login'
excerpt: 'Serie Cloudflare, parte 28. Qué comprueba la detección de credenciales filtradas del WAF, qué campos y qué cabecera añade, cómo usarla en reglas personalizadas y de rate limiting, cómo avisar a tu origen y qué cambia según el plan.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'waf'
  - 'seguridad'
  - 'credenciales'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 28 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En el post del [WAF](/blog/cloudflare-waf-guia) y en el de [rate limiting](/blog/cloudflare-rate-limiting-guia) apareció una regla que no habíamos creado: **Leaked credential check**. Viene de serie en la zona Free. Aquí ves qué hay detrás y cómo sacarle más partido.

## Qué es

La detección de credenciales filtradas es una detección del WAF. Mira las peticiones de inicio de sesión, extrae el usuario y la contraseña y los compara con una base de datos de credenciales que han aparecido en filtraciones. Esa base se construye con:

- El conjunto de contraseñas de **Have I Been Pwned** (solo contraseñas).
- Usuarios recopilados por Cloudflare.
- Pares de usuario y contraseña filtrados.

Cloudflare no guarda ni registra las contraseñas en claro: las convierte en un hash antes de compararlas.

Lo importante es qué **no** hace: no bloquea nada por sí sola. Solo rellena unos campos que puedes usar en reglas y que ves en Security Analytics. La mitigación la pones tú: con una regla personalizada, con una de rate limiting o en tu propio código.

**Planes.** Está en todos. En Free viene activada por defecto. Lo que cambia es cuánto sabe:

- **Todos los planes:** si la **contraseña** está filtrada.
- **Pro en adelante:** también si el **par usuario y contraseña** está filtrado.
- **Solo Enterprise:** si el **usuario** está filtrado, si hay un par **parecido** filtrado, si la petición lleva credenciales y las **ubicaciones de detección personalizadas**.

## Casos de uso

- **Frenar el *credential stuffing*.** Un atacante prueba listas de usuarios y contraseñas robadas en otra web. Muchas de esas peticiones llevan credenciales filtradas, así que un rate limiting sobre ese campo las corta pronto.
- **Proteger a tus usuarios de sí mismos.** Alguien entra con su contraseña de siempre, que se filtró hace años. El login es legítimo, pero conviene pedirle que la cambie.
- **Endurecer el panel de administración.** Un *challenge* cuando alguien intenta entrar en `/wp-admin` o en `/admin` con una contraseña conocida.

## Arquitectura

![Flujo de la detección: el visitante envía el login, Cloudflare extrae usuario y contraseña de las ubicaciones conocidas, los compara como hash con la base de filtraciones, rellena los campos cf.waf.credential_check, las reglas personalizadas y de rate limiting deciden la acción y, si la petición pasa, la cabecera Exposed-Credential-Check llega al origen; debajo, tabla de valores de la cabecera y su plan](media:blog/cloudflare-credenciales-filtradas-guia/00-arquitectura.png)

1. **Dónde busca.** Cloudflare trae reglas para los logins de Drupal, Joomla, Ghost, Magento, Plone, WordPress y Outlook Web App de Exchange, más reglas genéricas para patrones de autenticación habituales. Desde el 20 de agosto de 2026 también descodifica la cabecera `Authorization: Basic`.
2. **Qué rellena.** Si encuentra credenciales, las compara y pone a `true` los campos que correspondan.
3. **Quién actúa.** Tus reglas personalizadas y de rate limiting leen esos campos y bloquean o piden un *challenge*.
4. **Qué llega al origen.** Si activas una *managed transform*, la petición que pasa lleva la cabecera `Exposed-Credential-Check`.

Los campos:

| Campo | Qué significa | Plan |
|---|---|---|
| `cf.waf.credential_check.password_leaked` | La contraseña está filtrada | Todos |
| `cf.waf.credential_check.username_and_password_leaked` | El par está filtrado | Pro en adelante |
| `cf.waf.credential_check.username_leaked` | El usuario está filtrado | Solo Enterprise |
| `cf.waf.credential_check.username_password_similar` | Hay un par parecido filtrado | Solo Enterprise |
| `cf.waf.auth_detected` | La petición lleva credenciales | Solo Enterprise |

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Comprueba que la detección está activa

**Security › Settings**, filtrando por **Detection tools**. Ahí está **Leaked credential detection**. En Free ya viene encendida; en los planes de pago tienes que activarla tú.

![Security › Settings, grupo Fraud: interruptor Leaked credentials detection y enlace para crear una regla personalizada](media:blog/cloudflare-credenciales-filtradas-guia/01-panel.png)

### 2. Elige cómo mitigar

**En Free** tienes una sola regla de rate limiting y Cloudflare te sugiere usarla con una plantilla: bloquea a las IPs que prueban una contraseña filtrada **más de cinco veces en 10 segundos**. Si tu login es de un CMS de la lista, es la mejor forma de gastar esa regla. Lo expliqué en el [post de rate limiting](/blog/cloudflare-rate-limiting-guia).

**En Pro y superiores**, la documentación recomienda una regla personalizada con **Managed Challenge** cuando el par está filtrado (`cf.waf.credential_check.username_and_password_leaked`). Mejor si la acotas a tu login:

```
(cf.waf.credential_check.username_and_password_leaked
 and http.request.uri.path eq "/login"
 and http.request.method eq "POST")
```

¿Por qué *challenge* y no *block*? Porque quien teclea una contraseña filtrada puede ser el dueño legítimo de la cuenta. El *challenge* para a los scripts y deja pasar a la persona, que luego tu aplicación obliga a cambiar la contraseña.

### 3. Una regla personalizada también en Free

El campo **Password Leaked** está en todos los planes, así que en Free puedes usarlo en una de tus cinco reglas personalizadas sin tocar la de rate limiting. **Security rules › Create rule › Custom rules**:

```
(cf.waf.credential_check.password_leaked
 and http.request.uri.path eq "/wp-login.php")
```

Acción: **Managed Challenge**.

### 4. Avisa a tu origen

Bloquear no basta: si la contraseña de un usuario está filtrada, tu aplicación debería pedirle que la cambie. Ve a **Rules › Settings › Managed Transforms** y activa **Add Leaked Credentials Checks Header**.

Desde ese momento, las peticiones con credenciales filtradas llegan con la cabecera `Exposed-Credential-Check` y uno de estos valores:

- `1`: par usuario y contraseña filtrado (Pro en adelante).
- `2`: usuario filtrado (solo Enterprise).
- `3`: par parecido filtrado (solo Enterprise).
- `4`: contraseña filtrada (todos los planes).

Solo llega un valor, aunque varios campos sean `true`.

Un ejemplo de login que la usa. Comprueba primero la contraseña y solo después mira la cabecera, para no dar pistas a quien no la conoce:

```js
// Solo confía en esta cabecera si tu origen únicamente acepta
// tráfico de Cloudflare (por ejemplo, detrás de Cloudflare Tunnel).
// Si el origen es accesible directamente, cualquiera puede enviarla.
export async function handleLogin(request) {
  if (request.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON no válido" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254 || password.length > 1024) {
    return Response.json({ error: "Faltan credenciales" }, { status: 400 });
  }

  const user = await verifyCredentials(email, password); // tu lógica
  if (!user) {
    return Response.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  // 1 = par filtrado, 3 = par parecido, 4 = contraseña filtrada.
  // 2 (solo el usuario) no implica que la contraseña esté comprometida.
  const check = request.headers.get("Exposed-Credential-Check");
  if (check === "1" || check === "3" || check === "4") {
    await requirePasswordReset(user.id); // tu lógica
    return Response.json({ next: "/cambiar-contrasena" });
  }

  return startSession(user); // tu lógica
}
```

### 5. Ubicaciones personalizadas (solo Enterprise)

Si tu login manda las credenciales con otros nombres, las reglas por defecto pueden no verlas. En Enterprise le dices a Cloudflare dónde están: **Security › Settings › Leaked credential detection › Configurations › Add custom username and password location**. Solo el usuario es obligatorio. Para un cuerpo JSON como `{"user": "...", "secret": "..."}`:

```
lookup_json_string(http.request.body.raw, "user")
lookup_json_string(http.request.body.raw, "secret")
```

Para formularios se usa `url_decode(http.request.body.form["user"][0])`, y para *multipart*, `http.request.body.multipart`. Solo se admiten las funciones `lookup_json_string()` y `url_decode()`.

En Free, Pro y Business no existe este ajuste: comprueba con las credenciales de prueba (más abajo) si tu login está cubierto.

### Lo mismo, como código

Activar la detección con la API (en Free ya lo está). El token necesita *Zone WAF Write*:

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/leaked-credential-checks" \
  --request POST \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{"enabled": true}'
```

Con Terraform (proveedor v5), la detección y la regla de rate limiting equivalente a la plantilla Free:

```hcl
resource "cloudflare_leaked_credential_check" "lcc" {
  zone_id = var.zone_id
  enabled = true
}

resource "cloudflare_ruleset" "rate_limit" {
  zone_id = var.zone_id
  name    = "Rate limiting"
  kind    = "zone"
  phase   = "http_ratelimit"
  rules = [{
    ref         = "contrasena_filtrada"
    description = "Bloquear IPs que prueban contraseñas filtradas"
    expression  = "(cf.waf.credential_check.password_leaked)"
    action      = "block"
    ratelimit = {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 10
      requests_per_period = 5
      mitigation_timeout  = 10
    }
  }]
}
```

En Pro o superior, la regla personalizada con *challenge*:

```hcl
resource "cloudflare_ruleset" "waf_custom" {
  zone_id = var.zone_id
  name    = "Reglas personalizadas"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules = [{
    ref         = "par_filtrado_login"
    description = "Challenge si el par usuario/contraseña está filtrado"
    expression  = "(cf.waf.credential_check.username_and_password_leaked and http.request.uri.path eq \"/login\")"
    action      = "managed_challenge"
  }]
}
```

Y en Enterprise, una ubicación personalizada:

```hcl
resource "cloudflare_leaked_credential_check_rule" "json_login" {
  zone_id  = var.zone_id
  username = "lookup_json_string(http.request.body.raw, \"user\")"
  password = "lookup_json_string(http.request.body.raw, \"secret\")"
}
```

Recuerda lo de siempre: un `cloudflare_ruleset` controla **todas** las reglas de su fase. Si la plantilla de rate limiting ya está desplegada desde el panel, impórtala antes con `cf-terraforming` o la sustituirás.

## Cómo comprobarlo

Cloudflare publica credenciales de prueba. Distinguen mayúsculas y hay que usarlas en pareja exacta:

| Usuario | Contraseña | Resultado |
|---|---|---|
| `CF_LEAKED_USERNAME_FREE` | `CF_LEAKED_PASSWORD` | Password Leaked |
| `CF_EXPOSED_USERNAME` | `CF_EXPOSED_PASSWORD` | Par, usuario y contraseña filtrados |
| `CF_LEAKED_USERNAME` | `CF_LEAKED_PASSWORD` | Par, usuario y contraseña filtrados |

Los dos últimos admiten variantes con `@example.com` o `@cloudflare.com`, por si tu aplicación exige un correo. En Free solo verás **Password Leaked**; usa la primera pareja.

Con un login de WordPress (campos `log` y `pwd`) y la plantilla de rate limiting activa, a partir de la sexta petición en 10 segundos debería aparecer el 429:

```bash
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    --data-urlencode "log=CF_LEAKED_USERNAME_FREE" \
    --data-urlencode "pwd=CF_LEAKED_PASSWORD" \
    https://www.example.com/wp-login.php
done
```

Si activaste la *managed transform*, mira la cabecera en las peticiones que **recibe tu origen**, no en la respuesta: con la pareja Free tiene que llegar `Exposed-Credential-Check: 4`. Los eventos de la regla aparecen en **Security › Analytics**, pestaña **Events**. Si cambias el usuario de prueba por uno tuyo, la contraseña de prueba deja de dar positivo.

## Límites y precios

- Está **en todos los planes**. En Free viene activada; en los de pago se activa en Security › Settings, por API o con Terraform.
- Free solo sabe si la **contraseña** está filtrada; Pro y Business, también el **par**.
- **Solo Enterprise:** usuario filtrado, par parecido, `cf.waf.auth_detected`, ubicaciones personalizadas y la acción **Log** para validar reglas sin bloquear.
- Si la detección falla en una petición, desde octubre de 2026 puedes tratarlo en tus reglas con `any(cf.appsec.request.failed_detections[*] eq "waf_credential_check")`.
- La antigua **Exposed Credentials Check** (un ruleset gestionado) está obsoleta. Si aún la tienes, Cloudflare recomienda desactivarla tras migrar, porque tener las dos añade latencia a los logins.

## Documentación oficial

- [Detección de credenciales filtradas](https://developers.cloudflare.com/waf/detections/leaked-credentials/) y [cómo empezar](https://developers.cloudflare.com/waf/detections/leaked-credentials/get-started/)
- [Ejemplos de reglas de mitigación](https://developers.cloudflare.com/waf/detections/leaked-credentials/examples/)
- [Disponibilidad de las detecciones por plan](https://developers.cloudflare.com/waf/detections/#availability)
- [Managed Transforms: Add leaked credentials checks header](https://developers.cloudflare.com/rules/transform/managed-transforms/reference/#add-leaked-credentials-checks-header) y [cómo activarlas](https://developers.cloudflare.com/rules/transform/managed-transforms/configure/)
- [Migrar desde Exposed Credentials Check](https://developers.cloudflare.com/waf/managed-rules/check-for-exposed-credentials/upgrade-to-leaked-credentials-detection/)
- [Terraform: reglas de rate limiting](https://developers.cloudflare.com/terraform/additional-configurations/rate-limiting-rules/)
- [Guía: frenar el robo de cuentas](https://developers.cloudflare.com/use-cases/solutions/stop-account-takeover-attacks/)
- Changelog: [cabecera Authorization (20-ago-2026)](https://developers.cloudflare.com/changelog/post/2026-08-20-leaked-credentials-authorization-header/) y [campo de detecciones fallidas (9-oct-2026)](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/cf.appsec.request.failed_detections/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** API Shield: descubrimiento, validación de esquemas y mTLS.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [Rate limiting en Cloudflare: limitar peticiones sin bloquear a tus usuarios](/blog/cloudflare-rate-limiting-guia)
- [Turnstile: el CAPTCHA sin CAPTCHA, del widget a la verificación en el servidor](/blog/cloudflare-turnstile-guia)
