---
publishDate: 2026-09-29T09:00:00Z
draft: false
image: 'media:blog/cloudflare-casb-guia/portada.png'
title: 'CASB de Cloudflare: postura de seguridad de las aplicaciones SaaS'
excerpt: 'Serie Cloudflare, parte 39. Qué hace el CASB de Cloudflare, cómo conectar Microsoft 365, Google Workspace o GitHub por API, cómo leer los hallazgos, cómo combinarlo con DLP, cómo remediar y avisar por webhook, y qué te da el plan Free.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'zero trust'
  - 'casb'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 39 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

[Access](/blog/cloudflare-access-guia) decide quién entra en una aplicación y [Gateway](/blog/cloudflare-gateway-guia) controla a qué sale tu equipo. Falta lo que pasa **dentro** de las aplicaciones SaaS cuando ya has iniciado sesión: un fichero de Drive compartido con «cualquiera con el enlace», un administrador sin segundo factor, un repositorio sin protección de rama. Eso es lo que mira el CASB.

## Qué es

El CASB (*Cloud Access Security Broker*) de Cloudflare se conecta a las **API** de tus aplicaciones SaaS y de tus nubes y busca problemas de seguridad: configuraciones demasiado abiertas, actividad de usuarios no autorizada, *shadow IT* y datos expuestos. No hay agente ni proxy: no toca el tráfico de nadie.

Tres términos que verás en el panel:

- **Tipo de hallazgo (*finding type*).** La definición de un problema concreto, por ejemplo «Google Workspace: File publicly accessible with view access».
- **Hallazgo de postura (*posture finding*).** El resumen de un tipo de hallazgo dentro de una integración.
- **Instancia (*finding instance*).** Cada aparición concreta: el fichero `presupuesto.xlsx`, el usuario `ana@example.com`.

Hay además **hallazgos de contenido** (*content findings*): ficheros que contienen datos sensibles según tus perfiles de [DLP](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/).

**Integraciones.** Microsoft 365 (Admin Center, OneDrive, Outlook, SharePoint, Microsoft 365 Copilot), Google Workspace (Gmail, Admin, Calendar, Drive, Gemini), GitHub, Salesforce, ServiceNow, Slack, Zoom, Box, Dropbox, Atlassian Confluence y Jira, Bitbucket Cloud, AWS S3, GCP Cloud Storage, OpenAI y Anthropic. Las variantes FedRAMP piden un permiso especial de tu equipo de cuenta.

**Planes.** El CASB está disponible para todas las cuentas de Zero Trust. En Free puedes configurar **hasta dos integraciones**. Ver el **detalle de una instancia** es solo de Enterprise, y las **políticas de remediación** piden un plan de CASB de pago.

## Casos de uso

- **Ficheros públicos por descuido.** Detectar documentos de Drive, OneDrive o SharePoint abiertos a Internet o compartidos fuera de la empresa.
- **Cuentas débiles.** Administradores sin 2FA en Google Workspace, una organización de GitHub sin 2FA obligatoria, contraseñas que no cambian desde hace meses en Microsoft 365.
- **Correo mal configurado.** En Microsoft 365, un SPF que admite cualquier IP o un dominio sin DMARC.
- **Datos sensibles expuestos.** Con DLP, saber qué ficheros públicos contienen números de tarjeta o identificadores.
- **IA corporativa.** Revisar la postura de ChatGPT, Claude, Gemini o Copilot en tu organización.

## Arquitectura

![Flujo del CASB: Cloudflare se conecta por API, con permisos de solo lectura, a Microsoft 365, Google Workspace, GitHub y otras aplicaciones; escanea cada 1 a 24 horas, cruza los ficheros públicos con los perfiles DLP y genera hallazgos de postura y de contenido; las políticas remedian en Microsoft 365 y Google Workspace o envían un webhook; tabla de severidades Critical, High, Medium y Low](media:blog/cloudflare-casb-guia/00-arquitectura.png)

1. **Conectas una integración** autorizando a Cloudflare en la aplicación (OAuth, una GitHub App, una cuenta de servicio…). Los permisos son de **solo lectura** y mínimos.
2. **El primer escaneo** empieza al guardar la integración. Después se repite solo, normalmente **entre cada hora y cada 24 horas**, según la aplicación.
3. **Los hallazgos** se agrupan por categoría y severidad: **Critical** (actúa hoy), **High**, **Medium** y **Low**.
4. **Con DLP**, el CASB revisa los ficheros públicos y marca los que coinciden con un perfil.
5. **La respuesta**: ignoras el hallazgo, lo remedias (a mano o con una política) o lo envías por webhook a Slack, a tu SIEM o a tu sistema de tickets.

Para remediar, la integración necesita el **modo lectura y escritura**. Sin él, Cloudflare solo mira.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Conecta una integración

En [Cloudflare One](https://one.dash.cloudflare.com/), ve a **Cloud & SaaS findings › Integrations** y elige **Add integration**. Aparece el catálogo de aplicaciones.

![Cloud & SaaS findings (CASB): acciones rápidas, recomendaciones y métricas de hallazgos e integraciones, todas a cero](media:blog/cloudflare-casb-guia/01-panel.png)

Cada aplicación tiene sus requisitos. Los más habituales:

- **Microsoft 365.** Suscripción Business Basic, Business Standard, E3, E5 o F3, y un administrador global que acepte los permisos.
- **Google Workspace.** Plan Business Starter o superior, un superadministrador y permisos de propietario en el proyecto de Google Cloud que uses.
- **GitHub.** Una organización (Free, Pro o Enterprise) y ser propietario o gestor de GitHub Apps.

El asistente te guía por la autorización. Al pulsar **Save integration**, empieza el primer escaneo. Dos detalles: en **Configure** puedes desactivar **Scan for findings** para pausarla, y **Disenroll** la borra con sus claves y sus datos sin vuelta atrás.

### 2. Añade DLP durante el alta

Si quieres hallazgos de contenido, elige los **perfiles DLP** en el propio asistente. Así el CASB escanea **todos** los ficheros públicos. Si añades el perfil más tarde, solo revisa los ficheros que cambien a partir de ese momento.

DLP en el CASB funciona con AWS S3, Box, Dropbox, GCP Cloud Storage, Google Drive, OneDrive, SharePoint, Microsoft 365 Copilot, OpenAI y Anthropic. Solo lee ficheros de texto (documentos, hojas de cálculo, PDF) de hasta **100 MB**; las imágenes no. En Free tienes dos perfiles predefinidos: *Financial Information* y *Social Security, Insurance, Tax, and Identifier Numbers*. El resto de DLP es un complemento de Zero Trust Enterprise.

### 3. Revisa los hallazgos

En **Cloud & SaaS findings › Posture Findings** y **Content Findings**, elige SaaS o Cloud. Cada fila es un tipo de hallazgo con su severidad. Algunos ejemplos reales del catálogo:

| Hallazgo | Severidad |
|---|---|
| Google Workspace: Admin user with two-factor authentication disabled | Critical |
| Microsoft: File publicly accessible with edit access | Critical |
| GitHub: Organization two-factor authentication disabled | High |
| Microsoft: Domain SPF record allows any IP address | High |
| GitHub: Repository has no Default Branch Protection | Medium |
| Google Workspace: Inactive user | Low |

Con **Move to ignore** apartas un hallazgo que no te aplica en esa integración. Puedes cambiar su severidad desde **Manage**.

### 4. Remedia y avisa

En Microsoft 365 y Google Workspace, el CASB puede **quitar el permiso de compartición** de un fichero o carpeta: público, compartido fuera de la empresa (solo Google) o con toda la empresa, con edición o lectura, con o sin coincidencia DLP. A mano se hace desde **Remediation details** de la instancia. En automático, con una **política**.

Para enviar hallazgos fuera, crea un destino en **Integrations › Webhooks › Create webhook**: nombre, URL HTTPS pública y método de autenticación (*None*, *Basic Auth*, *Bearer Auth*, *Static Headers* o *HMAC-Signing*). **Test delivery** manda una petición de prueba antes de guardar.

La política une las dos cosas: **Cloud & SaaS findings › Policies › Create a policy**. Eliges proveedor, integraciones (o todas), un tipo de hallazgo y una o ambas acciones: **Run Remediation** y **Send webhooks**.

Tres límites: una política admite **una sola remediación**, solo actúa sobre instancias **nuevas** (no es retroactiva) y no puede quitar permisos **heredados** de una carpeta o una unidad compartida. Esos los cambias en el padre.

### Un receptor del webhook en un Worker

Si tu herramienta no acepta el formato del CASB, pon un [Worker](/blog/cloudflare-workers-guia) en medio. El cuerpo es JSON con `id`, `type`, `metadata` y `data`; el contenido de `data` varía según la integración, así que el ejemplo solo usa lo que está documentado. Comprueba el token *Bearer*, valida el JSON y reenvía un aviso corto a un webhook de Slack:

```ts
export interface Env {
  CASB_TOKEN: string;        // wrangler secret put CASB_TOKEN
  SLACK_WEBHOOK_URL: string; // wrangler secret put SLACK_WEBHOOK_URL
}

const enc = new TextEncoder();

async function sameToken(a: string, b: string): Promise<boolean> {
  // Compara hashes de igual longitud para no filtrar información por tiempo.
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
    if (!env.CASB_TOKEN || !env.SLACK_WEBHOOK_URL) return new Response("Sin configurar", { status: 500 });

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ") || !(await sameToken(auth.slice(7), env.CASB_TOKEN))) {
      return new Response("No autorizado", { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response("JSON no válido", { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return new Response("Cuerpo no válido", { status: 400 });
    }
    const { id, type, data } = body as Record<string, unknown>;
    if (typeof id !== "string" || typeof type !== "string" || typeof data !== "object" || data === null) {
      return new Response("Faltan campos", { status: 400 });
    }

    // No reenvíes el payload entero: puede incluir nombres de ficheros o usuarios.
    const text = `CASB: nueva instancia (${type.slice(0, 100)}), id ${id.slice(0, 100)}. Revísala en Cloudflare One.`;
    const r = await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return r.ok ? new Response("OK") : new Response("Error al reenviar", { status: 502 });
  },
} satisfies ExportedHandler<Env>;
```

## Lo mismo, como código

Desde octubre de 2026, el proveedor de Terraform (v5.27.0 o superior) gestiona integraciones, webhooks y políticas del CASB. El token necesita *Zero Trust Write*. Las integraciones que usan OAuth (como Microsoft 365) no se pueden crear con Terraform; las de cuenta de servicio, como GCP, sí.

El webhook hacia el Worker y una política que retira el acceso público de los ficheros de Drive y avisa:

```hcl
variable "cloudflare_account_id" {
  type = string
}

variable "casb_token" {
  type      = string
  sensitive = true
}

variable "remediation_type_id" {
  type        = string
  description = "Sale de la API de remediation_types del tipo de hallazgo"
}

resource "cloudflare_zero_trust_casb_webhook" "slack" {
  account_id          = var.cloudflare_account_id
  label               = "Aviso a Slack"
  destination_url     = "https://casb-webhook.example.com/"
  authentication_type = "Bearer Auth"
  headers = [{
    key   = "Authorization"
    value = "Bearer ${var.casb_token}"
  }]
}

resource "cloudflare_zero_trust_casb_policy" "drive_publico" {
  account_id                  = var.cloudflare_account_id
  display_name                = "Quitar acceso público en Drive"
  description                 = "Google Workspace: File publicly accessible with view access"
  enabled                     = true
  applies_to_all_integrations = true
  finding_type_id             = "d5132bc7-4c41-4824-b879-3918bf7f6ee7"

  actions = {
    remediation_types = [{
      remediation_type_id = var.remediation_type_id
    }]
    webhook_configs = [{
      webhook_config_id = cloudflare_zero_trust_casb_webhook.slack.id
    }]
  }
}
```

El `finding_type_id` es el que publica la documentación de Google Workspace. El de la remediación lo obtienes con la API:

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/data-security/posture/finding_types/d5132bc7-4c41-4824-b879-3918bf7f6ee7/remediation_types" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

Cambiar `finding_type_id` en Terraform **recrea** la política.

## Cómo comprobarlo

Primero, que el Worker rechaza lo que debe:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://casb-webhook.example.com/
# 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://casb-webhook.example.com/ \
  -H "Authorization: Bearer $CASB_TOKEN" -d 'esto no es JSON'
# 400
```

Después, **Test delivery** en la página del webhook: si responde, Cloudflare llega a tu URL. Esa prueba no envía una instancia real.

Si remedias, la instancia pasa por **Pending**, **Processing**, **Validating** y **Completed**. La validación puede tardar **hasta 48 horas**. **Rejected** significa que faltan permisos de escritura. Las acciones quedan en **Logs › Admin**.

## Límites y precios

| | Zero Trust Free | Solo Enterprise |
|---|---|---|
| Integraciones | Hasta 2 | |
| Hallazgos de postura y de contenido | ✓ | |
| Detalle de cada instancia | | ✓ |
| Perfiles DLP | 2 predefinidos | Resto de DLP (complemento) |

- Las **políticas de remediación** piden un plan de CASB de pago.
- Los **webhooks** solo envían hallazgos de postura, no de contenido, y para mandar una instancia real tienes que poder ver su detalle.
- La remediación solo cubre ficheros y carpetas de **Microsoft 365** y **Google Workspace**.
- DLP en el CASB: ficheros de texto de hasta 100 MB y solo ficheros públicos.
- Para delegar, existen los roles **Cloudflare CASB Read** y **Cloudflare CASB**. Para activar DLP en el CASB hace falta además el rol **Cloudflare Zero Trust**.

## Documentación oficial

- [Cloud and SaaS findings (CASB)](https://developers.cloudflare.com/cloudflare-one/cloud-and-saas-findings/) y [gestionar hallazgos](https://developers.cloudflare.com/cloudflare-one/cloud-and-saas-findings/manage-findings/)
- [Integraciones disponibles](https://developers.cloudflare.com/cloudflare-one/integrations/cloud-and-saas/): [Microsoft 365](https://developers.cloudflare.com/cloudflare-one/integrations/cloud-and-saas/microsoft-365/), [Google Workspace](https://developers.cloudflare.com/cloudflare-one/integrations/cloud-and-saas/google-workspace/), [GitHub](https://developers.cloudflare.com/cloudflare-one/integrations/cloud-and-saas/github/), [Salesforce](https://developers.cloudflare.com/cloudflare-one/integrations/cloud-and-saas/salesforce/)
- [DLP en el CASB](https://developers.cloudflare.com/cloudflare-one/cloud-and-saas-findings/casb-dlp/) y [Data Loss Prevention](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/)
- [Políticas de remediación](https://developers.cloudflare.com/cloudflare-one/cloud-and-saas-findings/policies/) y [webhooks](https://developers.cloudflare.com/cloudflare-one/integrations/cloud-and-saas/webhooks/)
- [API: tipos de hallazgo](https://developers.cloudflare.com/api/resources/zero_trust/subresources/casb/subresources/posture/subresources/finding_types/methods/list/)
- Changelog: [políticas de remediación (21-ago-2026)](https://developers.cloudflare.com/changelog/post/2026-08-21-casb-policies/), [integraciones con Terraform (7-oct-2026)](https://developers.cloudflare.com/changelog/post/2026-10-07-casb-terraform-integrations/) y [roles del CASB](https://developers.cloudflare.com/changelog/post/2025-10-28-casb-roles/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** DLP: protección de datos.

## También te puede interesar

- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
- [Gateway: filtrado DNS y HTTP para tu equipo](/blog/cloudflare-gateway-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
