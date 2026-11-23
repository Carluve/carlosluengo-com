---
publishDate: 2026-09-08T09:00:00Z
draft: false
image: 'media:blog/cloudflare-security-center-guia/portada.png'
title: 'Security Center y Brand Protection: tu postura de seguridad en un solo panel'
excerpt: 'Serie Cloudflare, parte 36. Qué revisa Security Center en tu cuenta, cada cuánto escanea según el plan, cómo usar Investigate para consultar IPs y dominios, qué hace Brand Protection contra los dominios que imitan tu marca y cómo automatizar las alertas.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'security center'
  - 'brand protection'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 36 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

A estas alturas de la serie tienes [DNS](/blog/cloudflare-dns-dnssec-guia), [SSL/TLS](/blog/cloudflare-ssl-tls-guia), [WAF](/blog/cloudflare-waf-guia), [Access](/blog/cloudflare-access-guia) y [Tunnel](/blog/cloudflare-tunnel-guia) configurados zona a zona. El problema es que nadie revisa cada zona cada semana. Security Center lo hace por ti.

## Qué es

Security Center es la vista de seguridad de la cuenta. Junta tres cosas: el análisis de tu configuración, el inventario de lo que tienes expuesto y la inteligencia de amenazas de la red de Cloudflare. Tiene cinco piezas:

- **Security Insights.** Escanea la cuenta y lista los fallos de configuración, con una severidad: *Low*, *Moderate* o *Critical*.
- **Infrastructure.** El inventario de dominios, IPs y activos de la cuenta. Desde aquí también creas un `security.txt`.
- **Investigate.** Buscas una IP, un dominio o una URL y ves su categoría, su historial y su DNS pasivo.
- **Security Reports** (beta). Las peticiones que han bloqueado o desafiado la protección DDoS HTTP, el WAF y Bot Management.
- **Brand Protection** (beta). Busca dominios recién registrados que imitan tu marca o usan tu logo.

Security Center está en todos los planes. Brand Protection, mientras siga en beta, es **solo Enterprise**.

## Casos de uso

- **Encontrar lo que se te escapó.** Un `CNAME` que apunta a un servicio que ya no existe (riesgo de *subdomain takeover*), un registro sin proxy, un dominio sin HSTS o sin DMARC.
- **Revisar a las personas, no solo las zonas.** Usuarios de la cuenta sin MFA, políticas de Access demasiado amplias o túneles sin protección.
- **Mirar una IP sospechosa de tus logs.** Investigate te dice a qué red pertenece y cómo la clasifica Cloudflare.
- **Detectar el phishing contra tu marca antes que tus clientes.** Brand Protection avisa cuando aparece `tumarca-login.com` o una web con tu logo.

## Arquitectura

![Security Center: a la izquierda, las fuentes (configuración de la cuenta y de las zonas, red de Cloudflare, dominios nuevos de internet); en el centro, Security Insights, Infrastructure, Investigate y Brand Protection; a la derecha, las salidas (panel, alertas por correo o webhook, API). Debajo, tabla con la frecuencia de escaneo por plan](media:blog/cloudflare-security-center-guia/00-arquitectura.png)

El flujo tiene tres partes:

1. **Escaneo.** Cloudflare compara tu configuración con un conjunto de ajustes que considera ideales. Revisa la cuenta, los registros DNS y productos como SSL/TLS, WAF y Access en todos los dominios. También mira los registros **sin proxy**, que no reciben la protección de la red. Cada diferencia es un *insight*.
2. **Inteligencia.** Investigate y Brand Protection usan los datos de la red de Cloudflare: categorías de dominios, DNS pasivo, WHOIS y los dominios que se registran cada día.
3. **Salida.** Lo ves en el panel, te llega como notificación (correo o webhook) o lo lees por API.

Los escaneos están **activos por defecto** en todas las cuentas y zonas desde mayo de 2026. Frecuencia: cada 7 días en Free, cada 3 en Pro y Business, y a diario en Enterprise. En Free, los escaneos automáticos pueden pausarse si la cuenta está inactiva; entrar al panel o leer la API los mantiene en marcha.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Revisa Security Insights

En el panel de la cuenta, ve a **Security Center › Security Insights**. No hay nada que activar: el primer escaneo ya se habrá hecho. Arriba ves la fecha del último escaneo y el botón **Scan now**.

![Security Insights: hallazgos por gravedad y por tipo, y los más frecuentes (HSTS, TLS 1.2 mínimo, security.txt, AI Labyrinth, puntuación de bots)](media:blog/cloudflare-security-center-guia/01-panel.png)

Para cada insight, **Details** te explica el riesgo y cómo resolverlo. Algunos se arreglan en un clic. Por ejemplo, *Domains without "Always use HTTPS"* se resuelve en **SSL/TLS › Edge Certificates › Always Use HTTPS**.

Tres cosas que conviene saber:

- **Un insight no desaparece solo al arreglarlo.** Desaparece en el siguiente escaneo. Si no quieres esperar, lanza **Scan now** o archívalo. Desde mayo de 2026 puedes lanzar escaneos a demanda en cualquier plan, incluso de una sola zona o de un solo tipo de insight.
- **Hay falsos positivos conocidos.** Si despliegas reglas gestionadas a nivel de cuenta y no de zona, puede salir *Managed Rules not deployed*. Si una regla está en *Log*, puede salir como vulnerabilidad. En ambos casos, archiva el insight.
- **Puedes exportarlos a CSV** desde el mismo panel.

### 2. Crea una alerta para los críticos

Revisar el panel a mano no escala. En **Security Insights**, selecciona los insights que te importan y pulsa **Create alert for selected classes**. También puedes hacerlo desde **Notifications**: el tipo es **Security Insights** y está en todos los planes.

### 3. Consulta una IP o un dominio en Investigate

**Security Center › Investigate**. Escribe una IP, un dominio, un *hostname* o una URL. Para un dominio verás la categoría, a qué IPs resuelve, si la categoría ha cambiado, el país de origen y el DNS pasivo. El panel también te da el `curl` equivalente para la API.

Dos detalles. Cualquier usuario puede ver y lanzar análisis de URL, pero la inteligencia de IP, dominio y DNS pasivo necesita un rol de Super Admin, Administrator, Brand Protection o Cloudforce One Admin. Además, cada búsqueda **gasta cuota** de las Intel APIs (ver «Límites y precios»).

Si Cloudflare clasifica mal un dominio tuyo, puedes pedir que lo recategoricen desde Investigate, desde Radar o con la API.

### 4. Brand Protection (Enterprise)

En **Brand Protection** creas dos tipos de búsqueda:

- **Por texto (*strings*).** Escribes tu marca y Cloudflare busca dominios nuevos con erratas (*typosquatting*), caracteres que se parecen (*homoglyph*) o combinaciones con servicios (`marca-soporte.com`). Cada texto es una frase completa: si quieres vigilar dos términos por separado, añádelos como dos *strings*. Al guardar la búsqueda, también revisa los dominios vistos hace poco.
- **Por logo.** Subes un `.png`, `.jpg` o `.jpeg` y la visión artificial busca webs que lo usan, aunque el dominio no lleve tu marca. Desde febrero de 2026 eliges el umbral de coincidencia, con un mínimo del **75 %**.

Para cada coincidencia tienes siete días de historial de resolución, WHOIS y los informes de URL. Si no es nada, la descartas (*dismiss*). Si es un ataque, hay dos caminos:

- El dominio usa la red o el registrador de Cloudflare: envías un **abuse report** desde el panel, ya rellenado.
- Está en otro proveedor: el panel genera una **carta de cese y desistimiento** con los datos del WHOIS. Cloudflare avisa de que no es asesoramiento legal.

Las alertas de logo (*Logo Match Alerts*) son de Enterprise.

## Lo mismo, como código

**Listar los insights críticos abiertos** con la API. El token necesita el permiso *Account Security Center Insights* (lectura):

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/security-center/insights?severity=critical&dismissed=false&per_page=100" \
  --header "Authorization: Bearer $CF_API_TOKEN"
```

Para archivar uno: `PUT /accounts/{account_id}/security-center/insights/{issue_id}/dismiss` con `{"dismiss": true}`.

**Un Worker que te avisa de los críticos cada lunes.** El token y el webhook van como *secrets* (`wrangler secret put CF_API_TOKEN` y `wrangler secret put WEBHOOK_URL`), nunca en el código. El Worker no se fía de la respuesta: comprueba su forma antes de usarla.

```ts
interface Env {
  ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  WEBHOOK_URL: string;
}

type Insight = { id: string; subject: string; issue_class: string };

function esInsight(x: unknown): x is Insight {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.subject === "string" && typeof o.issue_class === "string";
}

export default {
  async scheduled(_ctrl: ScheduledController, env: Env): Promise<void> {
    if (!env.ACCOUNT_ID || !env.CF_API_TOKEN || !env.WEBHOOK_URL) {
      console.error("Falta configuración");
      return;
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.ACCOUNT_ID)}` +
      "/security-center/insights?severity=critical&dismissed=false&per_page=100";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` } });
    if (!res.ok) {
      console.error(`API: ${res.status}`);
      return;
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      console.error("La respuesta no es JSON");
      return;
    }

    const issues = (body as { result?: { issues?: unknown } })?.result?.issues;
    if (!Array.isArray(issues)) {
      console.error("Formato inesperado");
      return;
    }
    const criticos = issues.filter(esInsight);
    if (criticos.length === 0) return;

    const texto = criticos.map((i) => `• ${i.issue_class}: ${i.subject}`).join("\n");
    const aviso = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Insights críticos abiertos:\n${texto}` }),
    });
    if (!aviso.ok) console.error(`Webhook: ${aviso.status}`);
  },
};
```

En `wrangler.jsonc`, `"vars": { "ACCOUNT_ID": "..." }` y `"triggers": { "crons": ["0 8 * * 1"] }`. Si prefieres no programar nada, la notificación nativa hace lo mismo. Con Terraform (proveedor v5):

```hcl
resource "cloudflare_notification_policy" "insights" {
  account_id = var.account_id
  name       = "Security Insights"
  alert_type = "security_insights_alert"
  enabled    = true
  mechanisms = {
    email = [{ id = var.email_seguridad }]
  }
}
```

El filtro `filters = { insight_class = [...] }` limita el aviso a unas clases concretas. Los tipos de Brand Protection son `brand_protection_alert`, `brand_protection_digest` y `logo_match_alert`.

**Consultar un dominio** con las Intel APIs (cuenta para la cuota):

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/intel/domain?domain=example.com" \
  --header "Authorization: Bearer $CF_API_TOKEN"
```

Hay rutas parecidas para `intel/ip?ipv4=`, `intel/whois?domain=`, `intel/domain-history?domain=` e `intel/dns` (DNS pasivo por IP). Brand Protection tiene su propia API en `/accounts/{account_id}/brand-protection/` para crear búsquedas y descargar coincidencias hacia tu SIEM.

## Cómo comprobarlo

1. Corrige un insight sencillo, por ejemplo activa **Always Use HTTPS** en una zona.
2. En **Security Insights**, lanza **Scan now**.
3. Cuando el estado pase de **Scan in Progress** a **Last scan performed on…**, el insight ya no debería salir como activo.

Por API, el campo `status` de cada insight vale `active` o `resolved`. Para el Worker, usa `npx wrangler dev --test-scheduled` y llama a `/__scheduled` en local para forzar el cron.

## Límites y precios

| | Todos los planes | Solo Enterprise |
|---|---|---|
| Security Insights, Infrastructure, Investigate | ✓ | |
| Escaneo automático | 7 días (Free), 3 días (Pro y Business) | A diario |
| Escaneo a demanda | ✓ | |
| Alertas de Security Insights | ✓ | |
| Llamadas a Intel APIs (incluye Investigate) | 100 al mes | 2.500 al mes |
| Brand Protection (beta) | | ✓ |
| Logo Match Alerts | | ✓ |

- Por encima de 2.500 llamadas al mes está la suscripción Cloudforce One (10.000 o 50.000).
- Las cuentas con **más de 10.000 zonas** no tienen agregación de insights a nivel de cuenta. Cloudflare recomienda Security Analytics por zona y Logpush a un SIEM.
- La documentación de Security Center aún tiene páginas con la frecuencia y las condiciones de escaneo manual anteriores a mayo de 2026. Las cifras de esta tabla son las del changelog del 29 de mayo de 2026.

## Documentación oficial

- [Security Center: visión general](https://developers.cloudflare.com/security-center/) y [primeros pasos](https://developers.cloudflare.com/security-center/get-started/)
- [Security Insights](https://developers.cloudflare.com/security/security-insights/), [cómo funciona](https://developers.cloudflare.com/security/security-insights/how-it-works/) y [revisar insights](https://developers.cloudflare.com/security/security-insights/review-insights/)
- [Infrastructure](https://developers.cloudflare.com/security-center/infrastructure/) e [Investigate](https://developers.cloudflare.com/security-center/investigate/)
- [Intel APIs](https://developers.cloudflare.com/security-center/intel-apis/) y [sus límites](https://developers.cloudflare.com/security-center/intel-apis/limits/)
- [Brand Protection](https://developers.cloudflare.com/security-center/brand-protection/) y [su API](https://developers.cloudflare.com/api/resources/brand_protection/)
- [API de Security Center: listar insights](https://developers.cloudflare.com/api/resources/security_center/subresources/insights/methods/list/)
- [Notificaciones disponibles](https://developers.cloudflare.com/notifications/notification-available/)
- [Changelog: escaneos más frecuentes (29-may-2026)](https://developers.cloudflare.com/changelog/post/2026-05-29-security-insights-default-scans/) y [umbral de logo configurable (12-feb-2026)](https://developers.cloudflare.com/changelog/post/2026-02-12-brand-protection-logo-matching-percentage-selector/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** AI Crawl Control y pago por rastreo: decide qué bots de IA leen tu web y cobra por ello.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
