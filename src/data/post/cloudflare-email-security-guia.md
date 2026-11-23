---
publishDate: 2026-10-13T09:00:00Z
draft: false
image: 'media:blog/cloudflare-email-security-guia/portada.png'
title: 'Email Security y DMARC Management: phishing en tu bandeja y suplantación de tu dominio'
excerpt: 'Serie Cloudflare, parte 41. Dos productos para el correo: Email Security (antes Area 1) filtra el phishing que te llega, y DMARC Management, gratis en todos los planes, vigila quién envía correo en nombre de tu dominio. Modos de despliegue, disposiciones, SPF, DKIM y DMARC paso a paso.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'email security'
  - 'dmarc'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 41 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

El correo tiene dos problemas de seguridad distintos. Uno es lo que **te llega**: phishing, malware, fraudes de facturas. El otro es lo que **otros envían haciéndose pasar por ti**. Cloudflare tiene un producto para cada uno, y el segundo funciona en una zona Free con el [DNS de Cloudflare](/blog/cloudflare-dns-dnssec-guia).

## Qué es

**Email Security** (antes Area 1) analiza el correo entrante de tu organización y le asigna una **disposición**: malicioso, sospechoso, suplantación, spam, masivo o limpio. Según esa disposición, el mensaje se bloquea, se pone en cuarentena o se mueve de carpeta. Detecta phishing, malware, *Business Email Compromise* (BEC), fraude de proveedores y spam. Vive en Cloudflare One. Desde el 1 de octubre de 2025, el antiguo panel de Area 1 ya no existe: todo se gestiona desde el panel de Cloudflare.

**DMARC Management** recibe los informes DMARC que los servidores de correo del mundo envían sobre tu dominio. Te enseña qué fuentes mandan correo en tu nombre y si pasan SPF, DKIM y DMARC. También te ayuda a crear esos tres registros.

Los tres registros, en una línea cada uno:

- **SPF**: qué servidores pueden enviar correo de tu dominio.
- **DKIM**: firma criptográfica que demuestra que el mensaje sale de tu dominio y no se ha alterado.
- **DMARC**: une los dos anteriores y le dice al receptor qué hacer si fallan (nada, cuarentena o rechazo) y adónde mandar los informes.

**Planes.** DMARC Management está en **todos los planes**, Free incluido, siempre que uses el DNS de Cloudflare. Sigue en beta. Email Security se contrata aparte, en paquetes **Advantage**, **Enterprise** y **Enterprise + PhishGuard** (PhishGuard es el servicio gestionado en el que el equipo de Cloudflare revisa los mensajes por ti). Los paquetes Advantage solo admiten el despliegue MX/Inline. Algunas funciones, como las reglas de contenido bloqueado y el envío de detecciones por Logpush, son **solo de los paquetes Enterprise**.

## Casos de uso

- **Saber quién envía correo como tú.** Tu web manda avisos, tu CRM manda campañas y tu equipo usa Google Workspace. DMARC Management te dice cuáles pasan la autenticación y cuáles no.
- **Llegar a `p=reject` sin romper nada.** Empiezas en modo observación, corriges las fuentes legítimas y endureces la política cuando los informes salen limpios.
- **Blindar dominios que no envían correo.** Un dominio aparcado es perfecto para suplantaciones. Tres registros restrictivos lo cierran.
- **Una capa más sobre Microsoft 365 o Gmail.** Email Security detecta lo que se escapa al filtro nativo, sobre todo BEC sin enlaces ni adjuntos.

## Arquitectura

![Dos flujos. Arriba, Email Security: en modo MX/Inline el correo pasa por Cloudflare antes del buzón; en modo API o BCC llega al buzón y Cloudflare lo analiza después y lo mueve. Abajo, DMARC Management: el receptor consulta SPF, DKIM y DMARC en tu zona y envía informes agregados a Cloudflare. Tabla con las cinco disposiciones y la recomendación de cada una](media:blog/cloudflare-email-security-guia/00-arquitectura.png)

**Email Security tiene tres modos de despliegue:**

1. **MX/Inline (antes de la entrega).** Cambias los registros MX para que apunten a Cloudflare. El correo se analiza y solo después se entrega a Microsoft 365, Gmail o cualquier otro servidor. Es el modo que Cloudflare recomienda cuando es tu protección principal: bloquea antes de que el usuario vea nada, puede añadir texto al asunto o al cuerpo, reescribir enlaces y sigue aceptando correo en cola si tu proveedor se cae. Funciona con cualquier proveedor.
2. **API (después de la entrega).** Para Microsoft 365, vía Microsoft Graph. No tocas el flujo de correo: Cloudflare recibe una copia de cada mensaje entregado, lo analiza y lo mueve según la disposición (*auto-moves*: borrado recuperable, borrado definitivo, papelera, correo no deseado o ninguna acción).
3. **BCC/Journaling (después de la entrega).** Para Google Workspace y Exchange, o Microsoft 365 con journaling. Tu proveedor manda una copia a Cloudflare.

Existe también un despliegue **mixto**: Inline para el correo externo y BCC/Journaling para el interno.

En modo Inline, cada mensaje con disposición lleva la cabecera `X-CFEmailSecurity-Disposition`. Tu proveedor puede usarla para enviar el correo a cuarentena. Ojo: el valor de spam en la cabecera es `UCE`, no `SPAM`.

**DMARC Management** no toca tu correo. Añade a tu registro DMARC una dirección de Cloudflare en la etiqueta `rua`. Los servidores que reciben correo de tu dominio mandan ahí sus informes agregados, y Cloudflare los muestra en el panel.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Activa DMARC Management

En la zona, ve a **Email › DMARC Management** y pulsa **Enable DMARC Management**. Solo funciona en dominios raíz (`example.com`, no `blog.example.com`) y no en zonas configuradas como subdominio.

![Email Security: página de inicio con Retro Scan, que analiza hasta 14 días de correo de Microsoft 365, y los pasos para proteger dominios](media:blog/cloudflare-email-security-guia/01-panel.png)

Al activarlo, Cloudflare busca tu registro DMARC:

- **Si no tienes**, te propone crear uno que puedes editar después.
- **Si ya tienes**, le añade otra entrada `rua` con una dirección de Cloudflare. Tus destinatarios de informes anteriores se mantienen.

El primer informe puede tardar **hasta 24 horas**.

### 2. Revisa SPF, DKIM y DMARC

En **Email record overview › View records** ves los registros de autenticación de la zona y puedes crearlos o editarlos.

Pautas:

- **Un solo registro SPF.** Dos registros TXT que empiezan por `v=spf1` hacen que SPF falle.
- **Máximo 10 consultas DNS en SPF.** Cada `include:` o `mx` cuenta. Al editar el SPF, DMARC Management cuenta las consultas y te avisa si te pasas.
- **Empieza con `p=none`.** Mira los informes unas semanas, corrige las fuentes legítimas que fallan y pasa a `p=quarantine` y luego a `p=reject`.
- **Si tu SPF depende de un CNAME a un dominio externo**, DMARC Management no puede modificarlo. Edítalo en el proveedor de ese dominio.

Si el dominio **no envía correo**, ciérralo con estos tres registros TXT:

| Nombre | Contenido |
|---|---|
| `@` | `v=spf1 -all` |
| `*._domainkey` | `v=DKIM1; p=` |
| `_dmarc` | `v=DMARC1;p=reject;sp=reject;adkim=s;aspf=s` |

### 3. Lee los informes

La gráfica muestra el volumen de correo de un periodo de hasta **30 días**. **View reports** lista los informes por fecha. **Top 10 sources** resume quién envía en tu nombre; **View all** abre todas las fuentes, con el detalle de cada una.

### 4. Email Security: prueba antes de comprar

En [Cloudflare One](https://one.dash.cloudflare.com/), **Email security › Overview**. Sin contrato verás **Contact sales** y la opción de un análisis gratuito, **Retro Scan**.

**Retro Scan** conecta tu Microsoft 365 por API, analiza **hasta 14 días** de correo y te manda un informe con lo que tu filtro actual dejó pasar. Solo funciona con Microsoft 365.

Si lo despliegas en modo **MX/Inline**, el orden importa:

1. **Baja el TTL** de los registros MX a 5 minutos entre 3 y 5 días antes del cambio.
2. **Autoriza las IPs de salida** de Email Security en tu proveedor, o rechazará los mensajes que Cloudflare le reentregue. Microsoft 365 no admite dos de los rangos ni IPv6; usa la lista de bloques `/24` de la documentación.
3. **Cambia los MX** a los que te da el asistente. Solo se puede incorporar un dominio a la vez.
4. **Cierra la puerta trasera.** Pasadas 72 horas con todos los dominios incorporados, crea un conector en Microsoft 365 que solo acepte correo de Email Security con TLS. Si no, un atacante puede entregar directamente en tu servidor usando MX antiguos.

Después, en **Settings**: ajusta los *auto-moves* por disposición, añade a tus directivos al **registro de suplantación** (*impersonation registry*) y usa **allow policies** con cuidado. **Accept sender** quita las disposiciones de spam, suplantación y masivo, pero sigue buscando correo malicioso. Desde noviembre de 2026, las políticas de permitir y bloquear admiten **fecha de caducidad** en todos los paquetes.

### Lo mismo, como código

Los registros de autenticación son registros DNS normales. Con Terraform (proveedor v5):

```hcl
resource "cloudflare_dns_record" "spf" {
  zone_id = var.zone_id
  name    = "@"
  type    = "TXT"
  content = "\"v=spf1 include:_spf.google.com ~all\""
  ttl     = 1
  comment = "SPF: solo Google Workspace"
}

resource "cloudflare_dns_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc"
  type    = "TXT"
  content = "\"v=DMARC1; p=none; rua=mailto:dmarc@example.com\""
  ttl     = 1
  comment = "DMARC en modo observación"
}
```

Si después activas DMARC Management, copia en `content` el `rua` que añade Cloudflare. Si no, el siguiente `terraform apply` lo quitará y dejarás de recibir informes.

Para Email Security, la API de investigación lista los mensajes procesados: `GET /accounts/{account_id}/email-security/investigate`. El token necesita *Cloud Email Security: Read*. Un script para Node 18 o superior que saca los maliciosos de las últimas 24 horas:

```ts
const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !accountId || !/^[a-f0-9]{32}$/.test(accountId)) {
  console.error("Define CLOUDFLARE_API_TOKEN y un CLOUDFLARE_ACCOUNT_ID válido");
  process.exit(1);
}

const params = new URLSearchParams({
  start: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  final_disposition: "MALICIOUS",
  per_page: "50",
});

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/email-security/investigate?${params}`,
  { headers: { Authorization: `Bearer ${token}` } },
);

let body: unknown;
try {
  body = await res.json();
} catch {
  console.error(`Respuesta no JSON (HTTP ${res.status})`);
  process.exit(1);
}

const data = body as { success?: boolean; result?: unknown };
if (!res.ok || data.success !== true || !Array.isArray(data.result)) {
  console.error(`Error de la API (HTTP ${res.status})`);
  process.exit(1);
}

for (const msg of data.result) {
  if (typeof msg !== "object" || msg === null) continue;
  const { subject, from } = msg as { subject?: unknown; from?: unknown };
  console.log(`${typeof from === "string" ? from : "?"} | ${typeof subject === "string" ? subject : "(sin asunto)"}`);
}
```

El token va en una variable de entorno, nunca en el código. Para volúmenes grandes, pagina con el `cursor` de `result_info`.

## Cómo comprobarlo

Los registros, desde cualquier terminal:

```bash
dig TXT example.com +short          # SPF: una sola línea con v=spf1
dig TXT _dmarc.example.com +short   # DMARC: con el rua de Cloudflare
dig MX example.com +short           # Inline: deben salir los MX de Cloudflare
```

Para SPF y DMARC, manda un correo a una cuenta de Gmail y abre **Mostrar original**: deben aparecer `SPF: PASS`, `DKIM: PASS` y `DMARC: PASS`.

En Email Security, **Settings › Domains** muestra el estado de cada dominio. En MX/Inline y BCC aparece **Active** si ha procesado correo en los últimos siete días, y **No mail flow** si no, lo que suele indicar un error de configuración. En los mensajes entregados, busca la cabecera `X-CFEmailSecurity-Disposition`.

## Límites y precios

| | Disponibilidad |
|---|---|
| DMARC Management | Todos los planes, con DNS de Cloudflare (beta) |
| Email Security | Contrato aparte: Advantage, Enterprise o Enterprise + PhishGuard |
| Retro Scan | Gratis, solo Microsoft 365, 14 días de correo |
| Despliegue API y BCC/Journaling | Solo paquetes Enterprise |
| Reglas de contenido bloqueado | Solo paquetes Enterprise |
| Detecciones por Logpush | Solo paquetes Enterprise |

- **DMARC Management**: solo dominios raíz; gráfica de hasta 30 días; primer informe en hasta 24 horas.
- **SPF**: máximo 10 consultas DNS por comprobación (RFC 7208).
- **Investigación**: desde el panel, exportación a CSV de hasta 500 mensajes y acciones masivas de hasta 1.000. Para más, usa la API.

## Documentación oficial

- [DMARC Management](https://developers.cloudflare.com/dmarc-management/), [activarlo](https://developers.cloudflare.com/dmarc-management/enable/), [registros de seguridad](https://developers.cloudflare.com/dmarc-management/security-records/), [estadísticas](https://developers.cloudflare.com/dmarc-management/statistics/) y [límite de consultas SPF](https://developers.cloudflare.com/dmarc-management/dns-lookup-limits/)
- [Email Security](https://developers.cloudflare.com/cloudflare-one/email-security/) y [elegir un despliegue](https://developers.cloudflare.com/cloudflare-one/email-security/setup/)
- [Arquitectura de referencia de los despliegues](https://developers.cloudflare.com/reference-architecture/architectures/email-security-deployments/)
- [Configurar MX/Inline](https://developers.cloudflare.com/cloudflare-one/email-security/setup/pre-delivery-deployment/mx-inline-deployment-setup/) e [IPs de salida](https://developers.cloudflare.com/cloudflare-one/email-security/setup/pre-delivery-deployment/egress-ips/)
- [Disposiciones y atributos](https://developers.cloudflare.com/cloudflare-one/email-security/reference/dispositions-and-attributes/) y [cómo detecta el phishing](https://developers.cloudflare.com/cloudflare-one/email-security/reference/how-es-detects-phish/)
- [Auto-moves](https://developers.cloudflare.com/cloudflare-one/email-security/settings/detection-settings/auto-moves/), [allow policies](https://developers.cloudflare.com/cloudflare-one/email-security/policies/inbound/allow-policies/) y [registro de suplantación](https://developers.cloudflare.com/cloudflare-one/email-security/settings/detection-settings/impersonation-registry/)
- [Retro Scan](https://developers.cloudflare.com/cloudflare-one/email-security/retro-scan/)
- [API de investigación](https://developers.cloudflare.com/api/resources/email_security/subresources/investigate/methods/list/)
- [Changelog de Email Security](https://developers.cloudflare.com/cloudflare-one/changelog/email-security/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Cloudflare WAN y Network Firewall.

## También te puede interesar

- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [Gateway: filtrado DNS y HTTP para tu equipo](/blog/cloudflare-gateway-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
