---
publishDate: 2026-06-16T09:00:00Z
draft: false
image: 'media:blog/cloudflare-email-guia/portada.png'
title: 'Email Routing y Email Service en Cloudflare: recibir y enviar correo'
excerpt: 'Serie Cloudflare, parte 24. Cómo recibir correo en tu dominio sin servidor de correo con Email Routing (direcciones, reglas, catch-all y Email Workers), cómo enviar correo transaccional desde un Worker, la API o SMTP con Email Sending, qué registros SPF, DKIM y DMARC se crean y qué cuesta cada cosa.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'email'
  - 'email routing'
  - 'workers'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 24 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Quieres que `hola@tudominio.com` funcione sin pagar un buzón, o que tu aplicación en [Workers](/blog/cloudflare-workers-guia) mande un «pedido confirmado». Las dos cosas las resuelve Cloudflare Email Service, si el dominio ya está en su [DNS](/blog/cloudflare-dns-dnssec-guia).

## Qué es

**Email Service** agrupa dos productos:

- **Email Routing** recibe el correo de tu dominio. Por cada dirección decides qué hacer: reenviarla a un buzón que ya tienes (Gmail, Outlook…), pasarla a un Worker o descartarla. No guarda correo: no es un buzón.
- **Email Sending** envía correo **transaccional** desde un Worker, la API REST o SMTP. Está en **beta pública** desde el 16 de abril de 2026.

**Planes.** Aquí no manda el plan de la zona, sino el de Workers. Email Routing es gratis e ilimitado en Workers Free y Workers Paid. Email Sending a cualquier destinatario exige **Workers Paid**. Enviar a tus propias direcciones verificadas es gratis en los dos. No hay funciones exclusivas de Enterprise.

## Casos de uso

- **Direcciones de dominio sin servidor de correo.** `hola@` y `facturas@` llegan a tu Gmail.
- **Alias con etiqueta.** Con *subaddressing*, `tu+tienda@tudominio.com` llega a `tu@tudominio.com`.
- **Procesar correo con código.** Un Email Worker rechaza remitentes o reenvía a varias personas.
- **Avisos de tu aplicación.** Registro, contraseña, pedido confirmado.
- **Un formulario que te escribe a ti.** Cabe en Workers Free: solo envía a una dirección verificada.

## Arquitectura

![Dos flujos: recibir (MX de Cloudflare, reglas y acciones: reenviar, Email Worker o descartar) y enviar (Worker, API o SMTP, Email Sending, supresiones y buzón del destinatario), con una tabla de disponibilidad por plan de Workers](media:blog/cloudflare-email-guia/00-arquitectura.png)

**Recibir (Email Routing).**

1. Al activarlo, Cloudflare publica sus registros **MX**, un **SPF** y un **DKIM** (`cf2024-1._domainkey`) en el dominio raíz. Quedan bloqueados para que no los borres sin querer.
2. Desde el 3 de julio de 2025, el correo entrante tiene que pasar al menos **SPF o DKIM** para que se reenvíe.
3. Se busca una **regla** para la dirección de destino. Si no hay ninguna y el catch-all está apagado, se rechaza con «Address does not exist» y el remitente no reintenta.
4. La regla ejecuta una acción: **Send to an email** (solo a direcciones verificadas), **Send to a Worker** o, en el catch-all, **Drop**.

**Enviar (Email Sending).**

1. Das de alta el dominio. Cloudflare crea MX, SPF y DKIM en el subdominio `cf-bounce` y, si no tienes DMARC, uno con `p=reject`.
2. Tu código envía por el *binding* `send_email`, por `POST /accounts/{account_id}/email/sending/send` o por SMTP en `smtp.mx.cloudflare.net:465`. Los tres usan el mismo canal, con firma DKIM y ARC automática.
3. Los rebotes y quejas generan **supresiones** por dominio de envío: a esa dirección no se vuelve a enviar.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Activa Email Routing en el dominio

Antes de nada, **añade y verifica tu buzón de destino** en **Compute › Email Service › Email Routing › Destination Addresses**. Cloudflare te manda un correo con el botón *Verify email address*. Las direcciones de destino son de la cuenta y sirven para todos tus dominios.

Después, en **Email Routing**, pulsa **Onboard Domain**, elige el dominio y revisa los registros que se van a crear.

![Email Routing de una zona: resumen de configuración (enrutado desactivado, registros DNS sin configurar, sin reglas ni direcciones de destino)](media:blog/cloudflare-email-guia/01-panel.png)

Tres avisos:

- Si el dominio ya tiene **MX de otro proveedor**, el alta falla con el error 2008. Bórralos en **DNS › Records** y activa Email Routing justo después, para que el hueco sin MX sea mínimo. Email Routing no convive con otro servidor de correo en el mismo dominio.
- Si ya tienes un **SPF**, Cloudflare no lo sustituye: añade tú `include:_spf.mx.cloudflare.net`. Un solo registro SPF por nombre.
- Crea las reglas enseguida: hasta entonces, se rechaza todo.

### 2. Crea una dirección

En la pestaña **Routing Rules**, **Create routing rule**: escribe la parte local (`hola`), elige la acción **Send to an email** y tu dirección verificada.

- **Una regla, un destino.** Para reenviar a varias personas, usa un Worker que llame a `forward()` una vez por destino.
- **Catch-all** (en la misma pestaña) recoge cualquier dirección sin regla, también las mal escritas. Con **Drop** el correo se borra sin aviso y la dirección parece válida.
- Una regla con destino sin verificar queda desactivada.

### 3. Ajustes: subaddressing y registros

En **Settings** del dominio activas el *subaddressing*. Aquí también se desbloquean los registros DNS si algún día cambias de proveedor.

### 4. Un Worker que recibe y envía

Un Worker con dos manejadores: `email()` para el correo entrante y `fetch()` para un formulario que te escribe a ti.

```jsonc
// wrangler.jsonc
{
  "name": "correo",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-23",
  "addresses": ["facturas@example.com"],
  "send_email": [
    { "name": "AVISOS", "destination_address": "yo@example.net" }
  ],
  "vars": { "DESTINO": "yo@example.net", "BLOQUEADOS": "spam@example.org" }
}
```

`addresses` (Wrangler 4.113.0 o superior) crea al desplegar la regla `facturas@` → este Worker. `destination_address` limita el *binding* a una sola dirección verificada: un fallo en tu código no puede enviar a nadie más.

```ts
interface Env {
  AVISOS: SendEmail;
  DESTINO: string;
  BLOQUEADOS: string;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export default {
  // Correo entrante
  async email(message: ForwardableEmailMessage, env: Env) {
    const bloqueados = env.BLOQUEADOS.split(",").map((s) => s.trim().toLowerCase());
    if (bloqueados.includes(message.from.toLowerCase())) {
      message.setReject("Remitente no aceptado");
      return;
    }
    if (message.rawSize > 10 * 1024 * 1024) {
      message.setReject("Mensaje demasiado grande");
      return;
    }
    await message.forward(env.DESTINO);
  },

  // Formulario de contacto
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/contacto" || req.method !== "POST") {
      return new Response("No encontrado", { status: 404 });
    }

    let datos: unknown;
    try {
      datos = await req.json();
    } catch {
      return new Response("JSON no válido", { status: 400 });
    }
    if (typeof datos !== "object" || datos === null) {
      return new Response("Cuerpo no válido", { status: 400 });
    }
    const { nombre, email, mensaje } = datos as Record<string, unknown>;
    if (
      typeof nombre !== "string" || nombre.length < 1 || nombre.length > 100 ||
      typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254 ||
      typeof mensaje !== "string" || mensaje.length < 1 || mensaje.length > 5000
    ) {
      return new Response("Faltan campos o no son válidos", { status: 400 });
    }

    try {
      await env.AVISOS.send({
        from: { email: "web@example.com", name: "Formulario web" },
        to: env.DESTINO,
        replyTo: email,
        subject: `Contacto de ${nombre.replace(/[\r\n]+/g, " ")}`,
        text: mensaje,
      });
    } catch (e) {
      if (e instanceof TypeError) return new Response("Mensaje no válido", { status: 400 });
      console.error("Envío fallido", (e as { code?: string }).code);
      return new Response("No se pudo enviar", { status: 502 });
    }
    return new Response("Enviado", { status: 202 });
  },
};
```

Detalles que importan:

- **Nunca uses la dirección del visitante como `from`.** Va en `replyTo`. El `from` debe ser de tu dominio.
- Protege el formulario con [Turnstile](/blog/cloudflare-turnstile-guia) y [rate limiting](/blog/cloudflare-rate-limiting-guia).
- `message.raw` es un *stream* de un solo uso: si lo lees, guárdalo antes en un `ArrayBuffer`.
- En Workers Free, un Email Worker pesado puede fallar con `EXCEEDED_CPU`.

### 5. Enviar a cualquiera: Email Sending

Para mandar avisos a tus usuarios necesitas Workers Paid y dar de alta el dominio en **Compute › Email Service › Email Sending › Onboard Domain**.

- Cuidado con el **DMARC**: si el dominio no tiene uno, Cloudflare publica uno con `p=reject`. Si otros servicios envían en tu nombre (Google Workspace, tu CRM), empieza con `p=none` hasta comprobar que pasan SPF o DKIM.
- Usa un subdominio propio (`avisos.tudominio.com`): cada dominio tiene su reputación.

Desde fuera de Workers, con un token con permiso **Email Sending: Edit** guardado en una variable de entorno:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/email/sending/send" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "to": "cliente@example.net",
    "from": { "address": "avisos@example.com", "name": "Tienda" },
    "subject": "Pedido confirmado",
    "text": "Tu pedido A-1001 está confirmado."
  }'
```

En REST el remitente usa `address` (en el *binding*, `email`) y la respuesta separa `delivered`, `queued`, `permanent_bounces` y `suppressed_recipients`. Por SMTP, el usuario es `api_token` y la contraseña, el token. Solo funciona en el puerto 465, con TLS implícito.

### Lo mismo, como código

Con el proveedor de Terraform (v5), el destino verificado, una dirección y un catch-all que descarta:

```hcl
resource "cloudflare_email_routing_address" "yo" {
  account_id = var.account_id
  email      = "yo@example.net"
}

resource "cloudflare_email_routing_rule" "hola" {
  zone_id  = var.zone_id
  name     = "hola"
  enabled  = true
  matchers = [{ type = "literal", field = "to", value = "hola@example.com" }]
  actions  = [{ type = "forward", value = ["yo@example.net"] }]
}

resource "cloudflare_email_routing_catch_all" "resto" {
  zone_id  = var.zone_id
  name     = "Descartar el resto"
  enabled  = true
  matchers = [{ type = "all" }]
  actions  = [{ type = "drop" }]
}
```

El enlace del correo de verificación lo tienes que pulsar tú. El token necesita escritura en *Email Routing Addresses* y *Email Routing Rules*. No gestiones desde Terraform las reglas que crea Wrangler con `addresses`.

## Cómo comprobarlo

Los MX tienen que apuntar a Cloudflare:

```bash
dig +short MX example.com
dig +short TXT cf2024-1._domainkey.example.com
```

Después, envía un correo desde otra cuenta a `hola@` y mira que llega. En local, `wrangler dev` expone `/cdn-cgi/local/email` para disparar el manejador `email()` con un mensaje de prueba.

Para el envío, el **Activity log** de Email Sending muestra cada mensaje con su estado y, con **Email preview** activado, su contenido durante unos siete días. Lo enviado con el *binding* sale como **dropped** en el resumen de Email Routing aunque se haya entregado: fíate de las métricas de Email Sending.

## Límites y precios

| | Workers Free | Workers Paid |
|---|---|---|
| Email Routing (recibir y reenviar) | Gratis, ilimitado | Gratis, ilimitado |
| Enviar a direcciones verificadas | Gratis | Gratis |
| Enviar a cualquier destinatario | — | 3.000 al mes incluidos, luego 0,35 $ por 1.000 |

**Email Routing**

- 200 reglas por dominio y 200 direcciones de destino por cuenta.
- 25 MiB por mensaje entrante.
- `reply()` solo una vez por mensaje, con DMARC válido en el entrante, desde el mismo dominio que lo recibió y si la cabecera `References` tiene 100 entradas o menos.

**Email Sending**

- 50 destinatarios por correo (to, cc y bcc juntos), asunto de 998 caracteres, 25 MiB con adjuntos y 16 KB de cabeceras propias.
- Cuota diaria por cuenta que empieza baja y sube según tu reputación. No hay una cifra publicada.
- 30 dominios por zona entre Routing y Sending, incluido el raíz.

**Antiabuso**

- Solo correo **transaccional**. Newsletters y campañas no están permitidas.
- Cloudflare recomienda menos de un 2 % de rebotes duros y menos de un 0,1 % de quejas.
- Abusos: `mailabuse@cloudflare.com`, con las cabeceras completas.

## Documentación oficial

- [Email Service](https://developers.cloudflare.com/email-service/), [precios](https://developers.cloudflare.com/email-service/platform/pricing/) y [límites](https://developers.cloudflare.com/email-service/platform/limits/)
- [Direcciones, reglas y catch-all](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/) y [configuración de dominios](https://developers.cloudflare.com/email-service/configuration/domains/)
- [Manejador email()](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/)
- [Workers API de envío](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [restricciones del binding](https://developers.cloudflare.com/email-service/configuration/send-bindings/), [API REST](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/) y [SMTP](https://developers.cloudflare.com/email-service/api/send-emails/smtp/)
- [SPF, DKIM y DMARC](https://developers.cloudflare.com/email-service/concepts/email-authentication/) y [entregabilidad](https://developers.cloudflare.com/email-service/concepts/deliverability/)
- [Changelog de Email Service](https://developers.cloudflare.com/email-service/platform/changelog/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Stream y Realtime: vídeo y comunicación en tiempo real.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Turnstile: el CAPTCHA sin CAPTCHA, del widget a la verificación en el servidor](/blog/cloudflare-turnstile-guia)
- [Queues: mensajes y tareas en segundo plano](/blog/cloudflare-queues-guia)
