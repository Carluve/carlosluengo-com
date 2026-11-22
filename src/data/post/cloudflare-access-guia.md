---
publishDate: 2026-03-10T09:00:00Z
draft: false
image: 'media:blog/cloudflare-access-guia/portada.png'
title: 'Cloudflare Access: proteger una aplicación sin VPN'
excerpt: 'Serie Cloudflare, parte 10. Cómo poner un login delante de cualquier aplicación web sin VPN: proveedores de identidad, políticas Allow, Block, Bypass y Service Auth, duración de la sesión, service tokens para scripts, validación del JWT en tu servidor y los registros de quién entró.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'zero trust'
  - 'access'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 10 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

El [WAF](/blog/cloudflare-waf-guia) decide qué peticiones son peligrosas. Pero hay aplicaciones que no deberían ser públicas para nadie: un panel de administración, la wiki interna, el entorno de *staging*. La respuesta clásica es una VPN. Access es la alternativa: un login delante de la aplicación, en el borde, sin instalar nada en el ordenador de quien entra.

## Qué es

Access forma parte de Cloudflare One, la plataforma Zero Trust de Cloudflare. Funciona como un portero delante de un nombre de host (`panel.example.com`) o de una ruta (`example.com/admin`). Antes de que la petición llegue a tu origen, Access comprueba **quién** la hace y si una **política** le deja pasar.

Cuatro piezas:

- **Proveedores de identidad.** Dónde se identifica la gente: tu cuenta de Cloudflare, un código de un solo uso por correo (*One-time PIN*), Google, Microsoft Entra ID, GitHub, Okta o cualquier proveedor SAML u OIDC.
- **Aplicaciones.** El nombre de host o la ruta que proteges.
- **Políticas.** Reglas reutilizables que dicen quién entra: por correo, por dominio de correo, por país, por grupo del proveedor de identidad, por estado del dispositivo…
- **Service tokens.** Credenciales para máquinas (scripts, CI, monitorización) que no pueden hacer login en un navegador.

Access deniega por defecto: lo que no coincide con ninguna política no pasa. Zero Trust tiene planes propios, separados de los de la zona, y el Free cubre **hasta 50 usuarios**.

## Casos de uso

- **Paneles de administración.** `/wp-admin`, phpMyAdmin, Portainer, el panel del router. Solo tu correo, o el de tu equipo, pasa.
- **Herramientas internas sin login propio.** Un Grafana o un Kibana que nunca debió estar en internet.
- **Entornos de *staging*.** El cliente ve la web nueva con un código que le llega por correo, sin contraseñas compartidas.
- **APIs internas.** Un job de CI o un cron llama a tu API con un service token, sin abrirla al mundo.
- **Workers internos.** Un Worker en `workers.dev` que no debe ser público.

## Arquitectura

![Flujo de Cloudflare Access: una persona con navegador o un script con service token llegan a la aplicación de Access; sin sesión, la persona pasa por el login en el dominio del equipo; Access evalúa Service Auth y Bypass primero y después Allow y Block; si pasa, la petición llega al origen con un JWT firmado en la cabecera Cf-Access-Jwt-Assertion, que el origen valida. Debajo, tabla con las cuatro acciones de política y si quedan en los registros](media:blog/cloudflare-access-guia/00-arquitectura.png)

El recorrido de una petición:

1. La petición llega al borde de Cloudflare. Para eso el registro DNS tiene que estar [con proxy](/blog/cloudflare-dns-dnssec-guia) (nube naranja) en una zona de Cloudflare, o llegar por un [Tunnel](#y-tunnel). Con nube gris, el tráfico va directo a tu origen y Access no lo ve.
2. Access evalúa primero las políticas **Service Auth** y **Bypass**, de arriba abajo.
3. Si no coincide ninguna y no hay sesión, envía a la persona a la página de login de tu equipo, en `tuequipo.cloudflareaccess.com`. Ahí elige proveedor de identidad.
4. Con la identidad resuelta, evalúa las políticas **Allow** y **Block** en el orden en que las pusiste. La primera que coincide decide.
5. Si pasa, Access deja una cookie `CF_Authorization` en el navegador y reenvía la petición a tu origen con un **JWT firmado** en la cabecera `Cf-Access-Jwt-Assertion`.

Las cuatro acciones:

- **Allow** deja pasar a quien cumple las reglas. Cada política combina reglas **Include** (basta con cumplir una), **Require** (hay que cumplirlas todas) y **Exclude** (quien la cumple no entra por esta política).
- **Block** sirve para hacer excepciones a un Allow. No hace falta un Block general: lo que no coincide ya está bloqueado.
- **Bypass** desactiva Access para ese tráfico. No admite reglas de identidad y **no deja registro**. Úsalo solo para rutas que tienen que ser públicas.
- **Service Auth** autentica a máquinas con service token o certificado mTLS, sin login. A diferencia de Bypass, deja registro.

Dos errores abren la aplicación a cualquiera: un Allow con **Include › Everyone** y un Allow con **Include › Login Methods › One-time PIN**, que deja entrar a cualquiera con correo.

## Implementación paso a paso

Las capturas son de `carluve.dev`, una zona en plan **Free**, con Zero Trust también en plan **Free**. En el texto, la aplicación de ejemplo protege `panel.example.com`. En las capturas se han tapado el subdominio, el nombre del equipo, los correos y las IP.

La primera vez que entras en **Zero Trust** desde el panel, Cloudflare te pide un **nombre de equipo**. Ese nombre forma tu dominio de equipo, `tuequipo.cloudflareaccess.com`, donde vive la página de login. También te pide elegir plan. El Free basta.

### 1. Elige cómo se identifica la gente

En **Zero Trust › Integrations › Identity providers**. Desde mayo de 2026, las organizaciones nuevas traen **Cloudflare** como proveedor por defecto: se entra con la cuenta de Cloudflare. El **One-time PIN** ya no se añade solo. Si lo quieres: **Add new identity provider › One-time PIN**.


Cómo funciona el One-time PIN:

- La persona escribe su correo y recibe un código que **caduca a los 10 minutos** y solo vale una vez.
- Si su correo no cumple ninguna política Allow, **no recibe nada**, aunque la página diga que se ha enviado. Así nadie averigua qué correos tienen acceso.
- Si un filtro de correo «abre» los enlaces para analizarlos, el código puede llegar ya usado. Añade `noreply@notify.cloudflare.com` a su lista de permitidos.

Para un equipo, conecta el proveedor que ya usáis (Google Workspace, Entra ID…). El One-time PIN encaja con invitados externos.

### 2. Crea una política

Las políticas se reutilizan en varias aplicaciones. **Zero Trust › Access controls › Policies › Add a policy**:

| Campo | Valor |
|---|---|
| Policy name | Equipo |
| Action | Allow |
| Session duration | Same as application session timeout |
| Include › Emails | `tu@example.com`, `otra@example.com` |

Si todo tu equipo usa el mismo dominio, cambia **Emails** por **Emails ending in** `@example.com`. Con **Require › Country** exiges, además, que la conexión venga de España.

![Formulario Add policy: política «Equipo» con acción Allow, duración de sesión y el desplegable de selectores abierto (Emails, Emails ending in, Login Methods, Service Auth…)](media:blog/cloudflare-access-guia/02-politica.png)

### 3. Crea la aplicación

**Zero Trust › Access controls › Applications › Create new application › Self-hosted and private › Add public hostname**:

1. **Subdomain** `panel` y **Domain** `example.com`. Puedes añadir una ruta para proteger solo una parte (`/admin`).
2. **Access policies**: añade la política **Equipo**.
3. **Identity providers**: marca los que aceptas. Con uno solo, **Apply instant authentication** salta la pantalla de elegir proveedor.
4. **Session Duration**: cuánto dura el permiso antes de volver a comprobar las políticas. Por defecto, **24 horas**.
5. **Create**.

Primero eliges el tipo de aplicación. Para una web propia, **Self-hosted and private**:

![Ventana Add an application: tipos Self-hosted and private, SaaS, Infrastructure y Bookmarks, con el esquema fuentes, políticas y destinos](media:blog/cloudflare-access-guia/01-tipo-aplicacion.png)

![Formulario de una aplicación self-hosted: destinos (subdominio, dominio y ruta) y el bloque Access policies, todavía sin política asociada](media:blog/cloudflare-access-guia/03-aplicacion.png)

Desde ahora, quien abra `panel.example.com` ve la página de login de Access:


### Duración de la sesión

Hay tres relojes, del más general al más concreto:

- **Sesión global**: cada cuánto vuelve a identificarse la persona en el proveedor de identidad. De 15 minutos a un mes; **24 horas** por defecto. Se cambia en **Access controls › Access settings**.
- **Sesión de la aplicación**: cuánto vale el permiso para una aplicación. De «expira al momento» a un mes; **24 horas** por defecto.
- **Sesión de la política**: igual que la de la aplicación si no la cambias. Sirve para dar 7 días a tu equipo y 24 horas a externos en la misma aplicación.

Cuando caduca la sesión de la aplicación y la global sigue viva, Access vuelve a evaluar las políticas sin pedir login. Para echar a alguien al momento, **Team & Resources › Users › Revoke** cierra sus sesiones.

### 4. Acceso para scripts: service tokens

Un cron o un pipeline de CI no puede hacer login. Para eso están los service tokens:

1. **Access controls › Service credentials › Service Tokens › Create Service Token**. Ponle un nombre y una duración.
2. Copia el **Client ID** y el **Client Secret**. El secreto **solo se muestra una vez**.
3. Crea una política con **Action: Service Auth** e **Include › Service Token** con ese token, y añádela a la aplicación.

El script envía las dos cabeceras en cada petición:

```bash
curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://panel.example.com/api/estado
```

Novedades de 2026:

- Los secretos creados desde el 26 de agosto empiezan por `cfast_`. Así los escáneres de secretos los detectan con menos falsos positivos.
- Desde el 25 de agosto puedes **rotar** el secreto con un periodo de gracia (de una hora a 30 días) en el que valen el viejo y el nuevo.
- **Strict service token authentication** (2 de octubre): una petición con cabeceras de service token solo la autoriza una política Service Auth. Si falla, recibe un 401 o un 403, no una redirección al login. Viene activada, sin opción de apagarla, en las organizaciones creadas desde el 5 de octubre. En las anteriores, actívala en **Access controls › Access settings › Manage service tokens**.

Los service tokens **no consumen plazas** de usuario. La notificación **Expiring Access Service Token** avisa una semana antes de que caduquen.

### 5. Valida el JWT en tu origen

Access protege el nombre de host. Pero quien conozca la IP de tu origen puede ir directo a él y saltarse Access. Por eso tu origen debe comprobar el JWT de cada petición:

- **Firma**, con las claves públicas de `https://tuequipo.cloudflareaccess.com/cdn-cgi/access/certs`. Access rota la clave de firma cada 6 semanas, y la anterior sigue valiendo 7 días. No copies la clave a mano: léela de esa URL.
- **`aud`**, que tiene que coincidir con el **Application Audience (AUD) Tag**. Lo encuentras en **Access controls › Applications ›** tu aplicación **› Edit › Additional settings**.
- **`iss`**, tu dominio de equipo, y que `exp` y `nbf` estén vigentes.

Valida la cabecera `Cf-Access-Jwt-Assertion`, no la cookie, que no siempre llega. En Node, con la librería `jose`:

```js
import { jwtVerify, createRemoteJWKSet } from "jose";

const TEAM_DOMAIN = "https://tuequipo.cloudflareaccess.com";
const AUD = process.env.POLICY_AUD;
const JWKS = createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`));

export async function verificarAccess(request) {
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw new Error("Falta el JWT de Access");
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: TEAM_DOMAIN,
    audience: AUD,
  });
  return payload.email; // vacío si entró un service token
}
```

Si tu aplicación no puede validar JWT, hay dos atajos: un proxy inverso que lo haga por ella o, con Tunnel, la opción **Protect with Access** de `cloudflared`. Y cierra el puerto: tu origen solo debe aceptar conexiones de Cloudflare.

### Y Tunnel

Lo más limpio es no tener ningún puerto abierto: `cloudflared` abre una conexión saliente hacia Cloudflare y tu aplicación se publica por ahí. Access y Tunnel van juntos casi siempre. Tunnel es el siguiente post de la serie.

La documentación aconseja **crear la aplicación de Access antes** de publicar la ruta del túnel. Si lo haces al revés, la aplicación queda pública durante ese rato.

### Un Worker en workers.dev

Para un Worker no hace falta pasar por Zero Trust: **Workers & Pages ›** tu Worker **› Access › Protect this Worker behind Access**. Eliges si proteges solo las previsualizaciones o todo el tráfico, y quién entra: miembros de tu cuenta o un dominio de correo. La protección cubre `workers.dev`, las rutas, los dominios personalizados y las previsualizaciones.

Dentro del Worker, `ctx.access` trae la identidad ya validada, sin tocar el JWT. Tiene límites: no llega a través de Service Bindings ni a Workers con Static Assets, y los WebSockets no funcionan con la protección a nivel de Worker. En esos casos, crea una aplicación self-hosted normal con el nombre de host del Worker y valida el JWT como en el paso 5.

### Lo mismo, como código

Con el proveedor de Terraform (v5), la política, el service token y la aplicación:

```hcl
resource "cloudflare_zero_trust_access_policy" "equipo" {
  account_id = var.account_id
  name       = "Equipo"
  decision   = "allow"
  include = [
    { email = { email = "tu@example.com" } },
    { email = { email = "otra@example.com" } },
  ]
}

resource "cloudflare_zero_trust_access_service_token" "ci" {
  account_id = var.account_id
  name       = "CI"
  duration   = "8760h"
  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_zero_trust_access_policy" "ci" {
  account_id = var.account_id
  name       = "Service token de CI"
  decision   = "non_identity" # Service Auth
  include = [{
    service_token = { token_id = cloudflare_zero_trust_access_service_token.ci.id }
  }]
}

resource "cloudflare_zero_trust_access_application" "panel" {
  account_id       = var.account_id
  name             = "Panel"
  type             = "self_hosted"
  domain           = "panel.example.com"
  session_duration = "24h"
  policies = [
    { id = cloudflare_zero_trust_access_policy.ci.id, precedence = 1 },
    { id = cloudflare_zero_trust_access_policy.equipo.id, precedence = 2 },
  ]
}
```

El token de API necesita *Access: Apps and Policies Write* y *Access: Service Tokens Write*. El secreto del service token queda en el estado de Terraform: sácalo con un `output` marcado como `sensitive` o guárdalo en un gestor de secretos.

Por API, las políticas reutilizables se crean con `POST /accounts/{account_id}/access/policies`. En el JSON, Allow es `"decision": "allow"` y Service Auth es `"decision": "non_identity"`.

## Cómo comprobarlo

Sin sesión, la aplicación tiene que enviarte al login, no a tu origen:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://panel.example.com
# 302 https://tuequipo.cloudflareaccess.com/...
```

Con el service token, la petición llega al origen:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  https://panel.example.com
# 200
```

Antes de dar por buena una política, usa el **Policy tester**: **Access controls › Applications ›** tu aplicación **› Edit › Policies › Policy tester**. Te dice qué porcentaje de tus usuarios entraría y qué políticas cumple un correo concreto.

Para saber quién ha entrado, **Zero Trust › Insights › Logs › Access authentication logs**. Cada intento de login sale con la aplicación, el usuario, el proveedor de identidad, el país, la IP y el resultado.


Dos detalles: las peticiones por **Bypass no aparecen**, y con One-time PIN el intento solo se registra cuando la persona **introduce el código**.

Por API, `GET /accounts/{account_id}/access/logs/access_requests`, con el permiso *Access: Audit Logs Read*. Los cambios de configuración (quién tocó una política) están en **Manage Account › Audit Logs** y se guardan 18 meses.

## Límites y precios

Los planes de Zero Trust van por usuario, no por zona. Un usuario ocupa una plaza la primera vez que se autentica, tenga los dispositivos que tenga.

- **Free**: hasta **50 usuarios**, sin coste. Los registros se guardan **24 horas**.
- **Pay-as-you-go**: 7 $ por usuario y mes. Registros de **30 días**.
- **Solo Enterprise (contrato)**: registros de hasta **6 meses** y Logpush hacia tu SIEM o tu almacenamiento. Precio a medida.

Revocar a un usuario cierra sus sesiones, pero no libera la plaza. Para eso hay que **eliminarlo** en **Team & Resources › Users**. El panel **Cloudflare One overview** muestra cuántas plazas llevas.

Límites por cuenta, iguales en todos los planes:

| | Límite |
|---|---|
| Aplicaciones | 500 |
| Políticas reutilizables | 500 |
| Reglas por aplicación | 1.000 |
| Correos o IP por regla | 1.000 |
| Dominios por aplicación | 50 |
| Proveedores de identidad | 50 |
| Service tokens | 50 |

## Documentación oficial

- [Publicar una aplicación self-hosted](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Políticas de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/), [gestión de políticas](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/policy-management/) y [políticas habituales](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/)
- [Proveedores de identidad](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/) y [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [Gestión de sesiones](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
- [Service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
- [Validar el JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) y [contenido del token de aplicación](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [Access en Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Registros de autenticación de Access](https://developers.cloudflare.com/cloudflare-one/insights/logs/dashboard-logs/access-authentication-logs/) y [Audit Logs](https://developers.cloudflare.com/fundamentals/account/account-security/audit-logs/)
- [Plazas](https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/) y [límites de la cuenta](https://developers.cloudflare.com/cloudflare-one/account-limits/)
- [Changelog de Access](https://developers.cloudflare.com/cloudflare-one/changelog/access/), con [Cloudflare como proveedor de identidad](https://developers.cloudflare.com/changelog/post/2026-05-19-cloudflare-as-identity-provider/) y [strict service token authentication](https://developers.cloudflare.com/changelog/post/2026-10-02-strict-service-token-authentication/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Tunnel: publicar sin abrir puertos, ni en tu router ni en tu servidor.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
