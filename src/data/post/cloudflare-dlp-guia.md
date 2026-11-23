---
publishDate: 2026-10-06T09:00:00Z
draft: false
image: 'media:blog/cloudflare-dlp-guia/portada.png'
title: 'DLP en Cloudflare: que los datos sensibles no salgan por la puerta'
excerpt: 'Serie Cloudflare, parte 40. Qué hace Data Loss Prevention en Cloudflare One, cómo se combinan perfiles y entradas de detección, cómo aplicarlo en una política HTTP de Gateway, qué hace con los prompts de IA y con los ficheros de tus SaaS, y cómo registrar lo detectado cifrado con tu clave.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'dlp'
  - 'zero trust'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 40 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Con [Gateway](/blog/cloudflare-gateway-guia) ya decides a qué sitios entra tu equipo, y con el [cliente WARP](/blog/cloudflare-warp-guia) ese tráfico pasa por Cloudflare. Falta la otra dirección: qué datos **salen**. Un Excel con tarjetas subido a un Drive personal, una clave de API pegada en un chat de IA. Para eso está DLP.

## Qué es

Data Loss Prevention (DLP) busca datos sensibles en tres sitios:

- **Tráfico web**, dentro de Gateway. Analiza el cuerpo de las peticiones y respuestas HTTP, no las cabeceras: formularios, ficheros, mensajes de chat.
- **Prompts de IA** enviados a ChatGPT, Google Gemini, Perplexity y Claude.
- **Ficheros de tus SaaS**, con CASB, que lee por API Google Drive, OneDrive, SharePoint, Box, Dropbox, S3 y otros.

Las piezas son dos:

- **Entradas de detección**: la lógica que reconoce un dato. Pueden ser predefinidas (tarjetas, IBAN, claves de AWS, tokens de Cloudflare…), expresiones regulares propias, listas de valores exactos, listas de palabras, huellas de documentos o temas de prompts de IA.
- **Perfiles**: agrupan entradas. Los hay predefinidos y personalizados. Las políticas y las integraciones usan perfiles, no entradas sueltas.

Cloudflare no escribe en disco lo que analiza: lo cifra y lo mantiene en memoria.

**Planes.** DLP completo es un **complemento de Zero Trust Enterprise**. Sin él, en los planes Free y Pay-as-you-go tienes los perfiles predefinidos **Financial Information** y **Social Security, Insurance, Tax, and Identifier Numbers**, el registro cifrado del *payload* y el informe de falsos positivos.

## Casos de uso

- **Que las tarjetas no salgan de contabilidad.** Bloquear subidas con números de tarjeta o IBAN a cualquier sitio que no sea tu aplicación aprobada.
- **Primero mirar, luego bloquear.** Una política que deja pasar y registra te dice qué sale y adónde.
- **Claves en el chat de IA.** Bloquear el prompt que contiene código fuente o credenciales, sin prohibir la herramienta.
- **Ficheros públicos olvidados.** Encontrar en Drive o SharePoint documentos públicos con datos personales.

## Arquitectura

![Flujo de DLP: el dispositivo con el cliente Cloudflare One envía el tráfico a Gateway, que descifra TLS y evalúa la política HTTP con el perfil DLP; si coincide, Allow registra y Block corta; el fragmento detectado se cifra con tu clave pública; aparte, CASB analiza por API los ficheros de los SaaS con los mismos perfiles](media:blog/cloudflare-dlp-guia/00-arquitectura.png)

En el tráfico web, el orden es este:

1. El dispositivo envía su tráfico a Gateway con el cliente Cloudflare One u otra vía de entrada.
2. Gateway **descifra TLS**. Sin descifrado, DLP no lee un cuerpo HTTPS. Lo que coincide con una política *Do Not Inspect* tampoco se analiza.
3. Una **política HTTP** usa el selector *DLP Profile*, casi siempre con otras condiciones: método, aplicación, grupo de usuarios.
4. Si la política coincide, se aplica su acción. **Allow** deja pasar y registra la coincidencia. **Block** corta la petición.
5. Si la política registra el *payload*, el fragmento que la disparó se guarda **cifrado con tu clave pública**.

CASB va por otro camino: pide los ficheros por API, así que no le afectan el *split tunnel* ni *Do Not Inspect*.

## Implementación paso a paso

La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

**Requisitos.** Necesitas el filtrado HTTP de Gateway con el proxy TCP activo y la inspección TLS encendida, con el certificado en los dispositivos. Lo vimos en las partes de [Gateway](/blog/cloudflare-gateway-guia) y [WARP](/blog/cloudflare-warp-guia).

### 1. Activa las entradas de un perfil predefinido

En **Zero Trust › Data loss prevention › Profiles**, abre **Financial Information** y pulsa **Edit**. Cada entrada se activa por separado: tarjetas Visa, Mastercard, American Express, IBAN, número de ruta ABA…

![Perfiles de DLP predefinidos: prompts de IA, credenciales y secretos, información financiera y sanitaria, datos personales y código fuente](media:blog/cloudflare-dlp-guia/01-panel.png)

Dos ajustes del perfil sirven para quitar ruido:

- **Match count**: cuántas coincidencias hacen falta en un mismo fichero o cuerpo para que salte. Con 10, un documento con un solo número de tarjeta no dispara nada.
- **Confidence threshold**: **Low** (por defecto) es el más permisivo, **Medium** añade validaciones y **High** solo salta con alta confianza. La confianza sube si hay palabras como «payment» junto al número.

### 2. Sube tu clave pública

Por defecto, el registro dice que hubo coincidencia, pero no qué contenía. Para verlo, DLP guarda el fragmento enmascarado, con **75 bytes de contexto a cada lado**, cifrado con una clave pública que subes tú. Cloudflare no tiene la privada y no puede descifrarlo.

Genera el par de claves con [`matched-data-cli`](https://github.com/cloudflare/matched-data-cli), la misma herramienta del *payload logging* del WAF:

```bash
./matched-data-cli generate-key-pair
```

Devuelve un JSON con `private_key` y `public_key`. Guarda la privada en tu gestor de contraseñas, nunca en un repositorio. Si la pierdes, lo registrado queda ilegible.

Pega la pública en **Data loss prevention › DLP settings › DLP Payload Encryption public key**. En esa misma página eliges el **enmascarado**: **Full Mask** (por defecto, `***-**-****`), **Partial Mask** (deja ver el 25 %) o **Clear Text**. Se aplica antes de cifrar.

### 3. Crea la política HTTP

En **Traffic controls › Firewall policies › HTTP › Add a policy** (antes *Traffic policies*). Empieza registrando, no bloqueando:

| Selector | Operador | Valor | Acción |
|---|---|---|---|
| DLP Profile | in | *Financial Information* | Allow |
| HTTP Method | in | *POST* | |

En **Configure policy settings**, activa **Log the payload of matched rules**. Cuando sepas qué sale y adónde, crea encima una política **Block** que excluya tu aplicación aprobada con *Application not in*. Gateway evalúa de arriba abajo.

### 4. Perfiles personalizados

Con el complemento Enterprise creas tus entradas en **Data loss prevention › Detection entries** y las combinas en **Profiles › Create profile**. Los tipos:

- **Pattern**: expresiones regulares en sintaxis de Rust, de 1.024 bytes como máximo. No admiten `+` ni `*`: usa rangos como `{1,64}`.
- **Exact Data Match**: un CSV con valores reales (clientes, cuentas). Se cifra antes de llegar a Cloudflare y se compara por *hash*.
- **Custom Wordlist**: palabras como nombres de proyecto o referencias internas. Se guardan en claro.
- **Documentos**: subes un `.docx` o `.txt` de menos de 10 MB y DLP busca contenido parecido según el porcentaje de similitud que fijes.

Un patrón para el DNI:

```
\b[0-9]{8}-?[A-HJ-NP-TV-Z]\b
```

Solo comprueba el formato, no la letra de control. Súbele el *match count* si lo usas para bloquear.

### 5. Prompts de IA

DLP clasifica los prompts por **contenido** (datos personales, credenciales, código fuente, datos de clientes, información financiera) y por **intención** (pedir datos personales o código malicioso, intentar un *jailbreak*). Hay cinco perfiles predefinidos *AI Prompt*: *AI Security*, *Customer*, *Financial Information*, *PII* y *Technical*. Desde junio de 2026 también puedes describir **temas propios** en lenguaje natural.

Se aplican con los controles granulares de aplicación. Una política con *Application is ChatGPT*, la operación de enviar el prompt y *DLP Profile in AI Prompt: Technical* bloquea el prompt con código o claves, pero no ChatGPT. Con **Capture generative AI prompt content in logs** se guardan el prompt y la respuesta, cifrados con tu clave. Los perfiles *AI Prompt* son del complemento Enterprise.

### 6. DLP en CASB

En **Integrations › Cloud & SaaS › Add integration**, el asistente te pide los perfiles DLP. CASB analiza los ficheros **accesibles públicamente**. Elige los perfiles al configurar: si los añades después, solo analiza los ficheros que cambien desde entonces. No analiza imágenes ni ficheros de más de 100 MB.

### Lo mismo, como código

Con el proveedor de Terraform (v5). Primero, saca los ID de los perfiles con la API:

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/dlp/profiles" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | jq '.result[]? | {id, name, type}'
```

El token, con permiso *Zero Trust Read*, va en una variable de entorno, nunca en el código.

Después, el perfil predefinido y la política:

```hcl
variable "account_id" { type = string }

variable "financial_profile_id" {
  type        = string
  description = "ID del perfil Financial Information (GET /dlp/profiles)"
}

variable "financial_entry_ids" {
  type        = list(string)
  description = "ID de las entradas a activar; las que no estén se desactivan"
  validation {
    condition     = length(var.financial_entry_ids) > 0
    error_message = "Indica al menos una entrada."
  }
}

resource "cloudflare_zero_trust_dlp_predefined_profile" "financiero" {
  account_id           = var.account_id
  profile_id           = var.financial_profile_id
  enabled_entries      = var.financial_entry_ids
  confidence_threshold = "medium"
}

resource "cloudflare_zero_trust_gateway_policy" "dlp_registrar" {
  account_id  = var.account_id
  name        = "DLP: registrar datos financieros en subidas"
  action      = "allow"
  enabled     = true
  filters     = ["http"]
  precedence  = 100
  traffic     = "any(dlp.profiles[*] in {\"${var.financial_profile_id}\"}) and http.request.method == \"POST\""
  rule_settings = {
    payload_log = { enabled = true }
  }
}
```

Ojo con `enabled_entries`: **desactiva todas las entradas que no aparezcan en la lista**.

## Cómo comprobarlo

Desde un dispositivo de tu organización, abre [dlptest.com/http-post](https://dlptest.com/http-post/) y envía un número de prueba que pase Luhn, como `4111 1111 1111 1111`. Con Allow, la petición pasa. Con Block, se corta.

Después, en **Insights › Logs › HTTP request logs**, filtra por **DLP Profiles** o por **Policy**. Despliega la fila, pulsa **Decrypt payload log** y pega tu clave privada. Cloudflare no guarda ni la clave ni el resultado descifrado.

Si no salta, prueba el perfil por separado en **Data loss prevention › Test scan**: pegas un texto o subes un fichero (hasta 10 MB) o un HAR, eliges perfiles y ves qué entradas coinciden y con qué confianza. Si el test coincide y Gateway no, el fallo está en la política, en la ruta del tráfico o en el descifrado TLS. No sirve para los perfiles *AI Prompt*.

Cada web envía los datos a su manera: que funcione en dlptest.com no garantiza que funcione en otra aplicación.

## Límites y precios

Esto es lo que **solo** tienes con el complemento Enterprise:

| Función | Solo Enterprise |
|---|---|
| Perfiles predefinidos salvo Financial Information y Social Security… | ✓ |
| Perfiles y entradas personalizados, datasets y documentos | ✓ |
| Perfiles *AI Prompt* y temas propios | ✓ |
| Copias forenses completas a Logpush | ✓ |
| Test scan con cualquier perfil | ✓ |

Límites de la cuenta y de formato:

- **Entradas personalizadas**: 25.
- **Exact Data Match**: 100.000 celdas por hoja; **1.000.000** de celdas en datasets por cuenta.
- **Custom Wordlist**: 200 palabras por hoja y 1.000 por cuenta.
- **Ficheros**: texto, CSV, Office 2007 o posterior, PDF y ZIP con ellos, hasta 10 niveles de compresión.
- **OCR**: `.jpg` y `.png` de 4 KB a 1 MB. Se activa en *DLP settings*.

## Documentación oficial

- [Data Loss Prevention: visión general y disponibilidad](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/)
- [Perfiles](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/dlp-profiles/), [perfiles predefinidos](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/dlp-profiles/predefined-profiles/) y [ajustes de perfil](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/dlp-profiles/advanced-settings/)
- [Entradas de detección](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/detection-entries/configure-detection-entries/) y [entradas predefinidas](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/detection-entries/predefined-detection-entries/)
- [Analizar tráfico HTTP](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/dlp-policies/) y [políticas habituales](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/dlp-policies/common-policies/)
- [Opciones de registro](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/dlp-policies/logging-options/), [DLP settings](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/dlp-settings/) y [generar el par de claves](https://developers.cloudflare.com/waf/payload-logging/command-line/generate-key-pair/)
- [Test scan](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/test-scan/) y [Passive Detection](https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/passive-detection/)
- [DLP en CASB](https://developers.cloudflare.com/cloudflare-one/cloud-and-saas-findings/casb-dlp/)
- [Controles granulares de aplicación](https://developers.cloudflare.com/cloudflare-one/traffic-controls/http-policies/granular-controls/)
- [Límites de la cuenta](https://developers.cloudflare.com/cloudflare-one/account-limits/#data-loss-prevention-dlp)
- [Terraform: perfil predefinido](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/zero_trust_dlp_predefined_profile) y [política de Gateway](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/zero_trust_gateway_policy)
- [Changelog de DLP](https://developers.cloudflare.com/cloudflare-one/changelog/dlp/), con la [protección de prompts de IA](https://developers.cloudflare.com/changelog/post/2025-08-25-ai-prompt-protection/) y los [temas propios de junio de 2026](https://developers.cloudflare.com/changelog/post/2026-06-11-custom-ai-prompt-topics/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Email Security y DMARC Management.

## También te puede interesar

- [Gateway: filtrado DNS y HTTP para tu equipo](/blog/cloudflare-gateway-guia)
- [WARP: el cliente de Zero Trust y la postura del dispositivo](/blog/cloudflare-warp-guia)
- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
