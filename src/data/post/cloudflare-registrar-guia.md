---
publishDate: 2026-12-08T09:00:00Z
draft: false
image: 'media:blog/cloudflare-registrar-guia/portada.png'
title: 'Cloudflare Registrar: dominios a precio de coste'
excerpt: 'Serie Cloudflare, parte 49. Qué es Cloudflare Registrar, qué cobra (lo mismo que el registro, sin margen), qué extensiones admite, cómo transferir un dominio sin cortes, cómo registrar uno nuevo, cómo funcionan la renovación automática, la privacidad del WHOIS y DNSSEC, y qué pasa si un dominio caduca.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'registrar'
  - 'dominios'
  - 'dns'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 49 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

La serie empezó por el [DNS](/blog/cloudflare-dns-dnssec-guia). Pero el dominio suele seguir registrado en otro sitio, que te cobra la renovación cada año. Con Cloudflare Registrar compras y renuevas en la misma cuenta donde ya tienes la zona.

## Qué es

Cloudflare Registrar es el registrador de dominios de Cloudflare. **Pagas lo que cobran el registro y la ICANN, sin margen**. La renovación va al precio de lista del registro, no a un precio promocional que sube el segundo año.

Lo que incluye, sin coste extra:

- **Redacción del WHOIS** por defecto, cuando el registro lo permite.
- **DNSSEC en un clic**.
- **Renovación automática**, activada por defecto.

Está disponible **en todos los planes**, también en Free. Una condición previa: el dominio tiene que usar **los nameservers de Cloudflare** (zona en configuración *full*). No puedes registrar el dominio aquí y llevar el DNS a otro proveedor. Sí puedes delegar subdominios.

**Extensiones.** Cloudflare admite más de 400 TLD y publica la lista en su [página de políticas de TLD](https://www.cloudflare.com/tld-policies/). Hay genéricos (`.com`, `.net`, `.org`, `.dev`, `.app`, `.io`, `.ai`) y algunos territoriales (`.uk`, `.ca`, `.mx`, `.nz`, `.us`). A día de hoy no aparecen `.es`, `.eu` ni `.cat`: compruébalo antes de planificar. Tampoco admite dominios internacionalizados (IDN), los que llevan `ñ`, tildes o empiezan por `xn--`.

## Casos de uso

- **Dejar de pagar la subida del segundo año.** Muchos registradores venden barato el primer año y renuevan caro.
- **Una sola cuenta para todo.** Dominio, DNS, certificados y seguridad en el mismo panel y con los mismos permisos.
- **Automatización.** La API de Registrar (en beta) busca, comprueba precio y registra dominios desde un script.

## Arquitectura

![Transferencia a Cloudflare Registrar en cinco pasos: apagar DNSSEC en el registrador actual, activar la zona en Cloudflare, desbloquear y pedir el código de autorización, iniciar la transferencia con pago y esperar la aprobación de hasta 5 días; debajo, tabla con las fases tras la caducidad: gracia, suspensión, redención y pending delete](media:blog/cloudflare-registrar-guia/00-arquitectura.png)

Con Cloudflare Registrar, el registrador (a quien pagas) y el DNS autoritativo son el mismo. Para transferir, vas y vuelves entre tu registrador actual y Cloudflare:

1. **Apaga DNSSEC** en el registrador actual, si lo tienes, y **espera 24 horas**. Si cambias los nameservers con los DS antiguos aún publicados, el dominio puede dejar de resolver.
2. **Activa la zona** en Cloudflare: añade el dominio, revisa los registros importados y cambia los nameservers. Hasta que la zona pase de *Pending* a *Active* no podrás meter el código de autorización.
3. **Desbloquea** el dominio en el registrador actual (en WHOIS aparece como `clientTransferProhibited`) y pide el **código de autorización** (auth code, EPP code). Caduca, así que pídelo justo antes de usarlo.
4. **Inicia la transferencia** en Cloudflare con el código y el pago.
5. **Espera la aprobación.** El registrador antiguo tiene hasta 5 días para liberar el dominio. Si apruebas el correo de transferencia, va más rápido.

## Implementación paso a paso

Todo lo de Registrar está a nivel de **cuenta**, no de zona. La captura es de mi cuenta, en tema claro, con los nombres de los dominios tapados.

### 1. Comprueba si tu dominio puede venir

Repasa los requisitos de transferencia:

- El dominio tiene **más de 60 días** desde su registro.
- **No se ha transferido** en los últimos 60 días.
- **No has cambiado** nombre, organización o email del titular en los últimos 60 días. Ese cambio activa un bloqueo de 60 días (algunos registradores permiten saltárselo, otros no).
- Si acabas de renovarlo tras caducar, **espera 45 días** desde la caducidad original o el año extra puede no sumarse.
- Tu cuenta de Cloudflare tiene el **email verificado** y un **método de pago** válido.

### 2. Transfiere

Con la zona activa y el dominio desbloqueado, ve a **Domains › Transfer domains**. Cloudflare lista los dominios de tu cuenta que cumplen los requisitos.

![Domains › Transfers: dominios bloqueados en el registrador actual con su precio de coste (11,17 $) y un dominio .es que no se puede transferir porque el TLD no está admitido (nombres tapados)](media:blog/cloudflare-registrar-guia/01-panel.png)

1. Selecciona el dominio y pega el **código de autorización**.
2. Confirma el **pago**. Cloudflare cobra en este momento al método de pago principal. Un pago fallido puede dejar la transferencia a medias.
3. Rellena los **datos de contacto**. La ICANN exige que sean reales, aunque luego no se publiquen. Datos falsos pueden acabar en suspensión.
4. Pulsa **Confirm transfer**.

Qué cuesta: en la mayoría de genéricos (`.com`, `.net`, `.org`), la transferencia **suma un año** a la fecha de caducidad y pagas ese año a precio de coste. Hay excepciones: `.uk` y `.nz` no cobran transferencia ni suman año, y no puedes pasar del máximo de 10 años (5 en `.co`).

### 3. O registra uno nuevo

Para un dominio que aún no tienes, ve a **Domains › Register domains**.

1. Busca un nombre o unas palabras clave. Si un dominio no sale en los resultados, no está disponible.
2. Pulsa **Purchase**. Cloudflare comprueba la disponibilidad otra vez en ese momento.
3. Elige los **años** (hasta 10 en la mayoría de extensiones). El precio y la fecha de renovación se actualizan solos.
4. Rellena el contacto (solo caracteres ASCII) y el pago, y pulsa **Complete purchase**.

El registro tarda unos 30 segundos.

### 4. Ajusta renovación, WHOIS y DNSSEC

En **Domains › Manage domains › Manage** tienes cada dominio:

- **Auto-renew.** Activo por defecto. El primer intento es unos **30 días antes** de caducar; si falla, recibes un email y hay **tres reintentos** más. Si no quieres renovar, desactívalo **al menos 30 días antes**. Las renovaciones no se reembolsan.
- **Contacts.** Los datos reales del titular. Cambiar nombre, apellidos, organización o email es un *cambio de titular*: llega un correo de aprobación y, si aceptas sin marcar **Do not apply 60 day transfer lock**, el dominio queda bloqueado 60 días para transferencias.
- **Configuration › Enable DNSSEC.** Cloudflare publica los registros CDS y CDNSKEY de tu zona y los envía al registro. Tarda **uno o dos días** en aparecer.

En el WHOIS público, nombre, email y dirección se sustituyen por `Data Redacted`. Siguen visibles el país y la provincia del titular, los nameservers, el estado de bloqueo y las fechas, porque así lo exige la ICANN. Quien quiera contactarte usa un [formulario](https://domaincontact.registrar.cloudflare.com/) que Cloudflare reenvía a tu email.

### Lo mismo, como código

La **API de Registrar** está en beta. Permite buscar, comprobar disponibilidad y precio, registrar, cambiar el auto-renew y, desde el 30 de septiembre de 2026, iniciar transferencias. No hace renovaciones ni cambios de contacto, y solo cubre parte de las extensiones. Necesita un token con permiso de escritura en Registrar, un contacto por defecto y el acuerdo de registro aceptado en el panel.

Este script comprueba el precio y solo compra si le pasas `--confirmar`. Ojo: por API, `auto_renew` es `false` si no lo indicas.

```js
// registrar.mjs · Uso: node registrar.mjs midominio.dev [--confirmar]
const { CF_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
const dominio = (process.argv[2] ?? "").trim().toLowerCase();
const confirmar = process.argv.includes("--confirmar");

if (!CF_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error("Define CF_ACCOUNT_ID y CLOUDFLARE_API_TOKEN en el entorno.");
  process.exit(1);
}
// Solo letras, números y guiones: Registrar no admite IDN
if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{2,63})+$/.test(dominio)) {
  console.error("Nombre de dominio no válido.");
  process.exit(1);
}

const base = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/registrar`;

async function api(path, body) {
  const res = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { throw new Error(`Respuesta no JSON (HTTP ${res.status})`); }
  if (!res.ok || data?.success !== true) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data?.errors ?? [])}`);
  }
  return data.result;
}

// 1. Disponibilidad y precio en tiempo real
const check = await api("/domain-check", { domains: [dominio] });
const d = Array.isArray(check?.domains) ? check.domains.find((x) => x?.name === dominio) : null;
if (!d) throw new Error("La API no devolvió el dominio pedido.");
if (d.registrable !== true) {
  console.log(`No registrable: ${d.reason ?? "motivo desconocido"}`);
  process.exit(0);
}
const p = d.pricing;
if (typeof p?.registration_cost !== "string" || typeof p?.currency !== "string") {
  throw new Error("La respuesta no trae precio. No sigo.");
}
console.log(`${dominio}: ${p.registration_cost} ${p.currency} (renueva a ${p.renewal_cost ?? "?"})`);
if (!confirmar) {
  console.log("Repite con --confirmar para comprarlo. El cargo no se reembolsa.");
  process.exit(0);
}

// 2. Registro (usa el contacto por defecto de la cuenta)
const reg = await api("/registrations", { domain_name: dominio, auto_renew: true });
console.log(`Estado: ${reg?.state ?? "desconocido"}`);
```

Si la respuesta es `202` (estado `in_progress`), no repitas la llamada: consulta `GET .../registrations/{dominio}/registration-status` hasta llegar a `succeeded` o `failed`, y para si ves `action_required`.

Terraform (proveedor v5) no tiene un recurso para el registro del dominio. Sí gestiona la zona y DNSSEC:

```hcl
resource "cloudflare_zone" "principal" {
  account = { id = var.account_id }
  name    = "example.com"
  type    = "full" # Registrar exige nameservers de Cloudflare
}

resource "cloudflare_zone_dnssec" "principal" {
  zone_id = cloudflare_zone.principal.id
  status  = "active"
}
```

## Cómo comprobarlo

Tras la transferencia, consulta el dominio en [rdap.cloudflare.com](https://rdap.cloudflare.com/) (WHOIS o RDAP): los datos personales deben salir como `Data Redacted`. Con DNSSEC activo, el campo DNSSEC dice `signedDelegation`, y **DNS › Settings** de la zona lo confirma:

Para ver la caducidad sin abrir el panel, `GET /accounts/{account_id}/registrar/registrations/{dominio}` devuelve `expires_at`, `auto_renew` y `locked`.

## Límites y precios

- **Precio:** el del registro más la tasa de la ICANN, sin margen. Disponible en todos los planes.
- **Plazo máximo:** 10 años en la mayoría de extensiones, tanto al registrar como al renovar.
- **Transferencias:** hasta 10 días en total; requisitos de 60 días; `.mx` puede tardar hasta 10 días hábiles.
- **Bloqueos:** 60 días tras transferir, registrar o cambiar de titular. Mover un dominio entre cuentas de Cloudflare lo bloquea 30 días.
- **Caducidad:** gracia de 30 días (resuelve), suspensión hasta el día 40, redención hasta el 70 (con tasa de restauración) y *pending delete* hasta el 75. Después, cualquiera puede registrarlo.
- **Sin reembolsos** en registros, renovaciones ni transferencias.
- **Sin IDN** y sin DNS de terceros.
- **Solo Enterprise: Custom Domain Protection.** Para dominios de alto perfil: *registry lock* cuando la extensión lo permite, cambios verificados fuera de banda con un proceso que defines tú y sin interfaz web que se pueda secuestrar. Se contrata con el equipo de cuenta.

Un aviso de seguridad: cualquiera con rol de Super Admin o Administrator en la cuenta puede desbloquear tus dominios y sacar el código de transferencia. Revisa quién tiene esos roles.

## Documentación oficial

- [Cloudflare Registrar](https://developers.cloudflare.com/registrar/) y [FAQ](https://developers.cloudflare.com/registrar/faq/)
- [Transferir un dominio a Cloudflare](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/) y [problemas en transferencias](https://developers.cloudflare.com/registrar/troubleshooting/)
- [Registrar un dominio nuevo](https://developers.cloudflare.com/registrar/get-started/register-domain/)
- [Renovaciones](https://developers.cloudflare.com/registrar/account-options/renew-domains/) y [cambios de contacto](https://developers.cloudflare.com/registrar/account-options/domain-contact-updates/)
- [Redacción del WHOIS](https://developers.cloudflare.com/registrar/account-options/whois-redaction/) y [DNSSEC](https://developers.cloudflare.com/registrar/get-started/enable-dnssec/)
- [Extensiones admitidas](https://developers.cloudflare.com/registrar/top-level-domains/) y [requisitos de .us](https://developers.cloudflare.com/registrar/top-level-domains/us-domains/)
- [Custom Domain Protection](https://developers.cloudflare.com/registrar/custom-domain-protection/)
- [API de Registrar](https://developers.cloudflare.com/registrar/registrar-api/) y [transferencias por API (changelog, 30-sep-2026)](https://developers.cloudflare.com/changelog/post/2026-09-30-registrar-transfer-api-beta/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Zaraz y Web Analytics, analítica sin cookies y etiquetas de terceros en el borde.

## También te puede interesar

- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [SSL/TLS en Cloudflare: certificados de borde, Origin CA y modos de cifrado](/blog/cloudflare-ssl-tls-guia)
