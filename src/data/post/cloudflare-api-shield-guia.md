---
publishDate: 2026-07-21T09:00:00Z
draft: false
image: 'media:blog/cloudflare-api-shield-guia/portada.png'
title: 'API Shield: descubrimiento, validación de esquemas y mTLS'
excerpt: 'Serie Cloudflare, parte 29. Qué es API Shield, qué piezas tienes en cualquier plan (inventario de operaciones y mTLS con certificados de cliente) y cuáles son de Enterprise (descubrimiento, validación de esquemas OpenAPI, JWT, abuso volumétrico y secuencias), con una API protegida por certificado paso a paso.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'api shield'
  - 'mtls'
  - 'seguridad'
  - 'apis'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 29 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

El [WAF](/blog/cloudflare-waf-guia) busca peticiones que se parecen a un ataque. Con una API puedes ir más lejos: sabes exactamente qué llamadas son válidas, quién debería hacerlas y en qué orden. API Shield usa ese conocimiento para dejar pasar solo lo esperado.

## Qué es

API Shield es el conjunto de funciones de Cloudflare para proteger APIs. Trabaja sobre **operaciones**: un endpoint identificado por método HTTP, patrón de host y patrón de ruta (por ejemplo, `POST api.example.com/v1/orders`).

Las piezas:

- **Endpoint Management.** El inventario de operaciones, en **Web Assets › Operations**. Las añades a mano, desde un esquema o desde lo que descubre Cloudflare.
- **API Discovery.** Encuentra endpoints a partir del tráfico real, incluidos los que nadie documentó (*shadow APIs*).
- **Schema validation.** Subes un esquema OpenAPI y Cloudflare marca las peticiones que no lo cumplen. **Schema learning** hace lo mismo con un esquema aprendido del tráfico.
- **mTLS.** El cliente tiene que presentar un certificado durante el *handshake* TLS. Si no lo trae, o no es válido, una regla lo bloquea.
- **JWT validation.** Verifica la firma y la vigencia de los tokens JWT en el borde.
- **Abuso volumétrico y secuencias.** Recomiendan límites de peticiones por sesión y detectan llamadas fuera del orden esperado.

**Planes.** La regla general de la documentación: salvo que la página de la función diga otra cosa, API Shield es un **add-on de pago de Enterprise**. Las excepciones que importan: **Endpoint Management** está en todos los planes y **cualquiera puede montar mTLS** con la CA gestionada por Cloudflare. Este post se centra en esas dos piezas, porque las puedes probar hoy en una zona Free.

## Casos de uso

- **Una API que solo usan tus dispositivos o servicios.** Una app móvil, un parque de sensores IoT o un backend que llama a otro. Con mTLS, quien no tiene certificado no pasa del borde.
- **Saber qué expones.** Un inventario de operaciones obliga a hacer la lista. En Enterprise, Discovery la completa con lo que aparece en el tráfico.
- **Modelo positivo.** En vez de perseguir ataques, defines qué es válido (el esquema OpenAPI, un JWT firmado) y marcas el resto.
- **Abuso de lógica de negocio.** Alguien que llama a `/transfer` sin pasar antes por `/balance`, o que enumera IDs. Para eso están las secuencias y la detección de BOLA, ambas de Enterprise.

## Arquitectura

![Flujo de una petición: cliente con certificado, comprobación mTLS en el handshake, inventario de operaciones, detecciones de esquema y JWT, regla personalizada del WAF que bloquea y API de origen; debajo, tabla con cada pieza y su plan](media:blog/cloudflare-api-shield-guia/00-arquitectura.png)

Hay una idea que ordena todo: **las detecciones no bloquean por sí solas**. Cada pieza deja un resultado en un campo del lenguaje de reglas, y quien decide es una regla personalizada del WAF:

| Pieza | Campo que rellena |
|---|---|
| mTLS | `cf.tls_client_auth.cert_verified`, `cf.tls_client_auth.cert_revoked` |
| Inventario | `cf.api_gateway.fallthrough_detected` (la petición no coincide con ninguna operación guardada) |
| Esquema subido | `cf.schema_validation.uploaded.violated` |
| JWT | `cf.api_gateway.tokens.valid`, `cf.api_gateway.tokens.presented` |

mTLS va un paso antes que el resto: el certificado se presenta al abrir la conexión TLS, antes de que exista la petición HTTP. Cloudflare valida el certificado contra las CA de la **cuenta**, así que el mismo certificado sirve en varias zonas de la misma cuenta si activas mTLS en cada hostname.

## Implementación paso a paso

El ejemplo: proteger `api.example.com` para que solo respondan los clientes con un certificado emitido por Cloudflare. La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Añade tus operaciones al inventario

**Security › Web Assets › Operations › Add operation › Manually add**. Elige el método, el patrón de host y el de ruta. Las variables de ruta van entre llaves: `/v1/devices/{var1}/readings`.

![Security › Web assets › Operations: todavía sin endpoints, con los accesos a Discovery y a la alta manual, y las pestañas Schema validation y Client-side resources](media:blog/cloudflare-api-shield-guia/01-panel.png)

Añadirla solo la mete en el inventario. No empieza a aprender nada ni bloquea nada. En Free caben 100 operaciones guardadas.

### 2. Crea un certificado de cliente

**SSL/TLS › Client Certificates › Add Certificate**. La CA por defecto es la gestionada por Cloudflare. Tienes dos opciones:

- Que Cloudflare genere la clave privada y la CSR.
- Generar tú la clave y la CSR. Es lo recomendable: la clave privada nunca sale de tu máquina.

```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout sensor-01.key -out sensor-01.csr \
  -subj '/O=Example/CN=sensor-01'
chmod 600 sensor-01.key
```

Pega el contenido de `sensor-01.csr`, elige la validez y pulsa **Continue**. Copia el certificado en ese momento y guárdalo como `sensor-01.pem`. Si Cloudflare generó la clave, **no la vuelve a mostrar**.

Una pauta: **un certificado por dispositivo o servicio**. Así, si uno se compromete, revocas ese y el resto sigue funcionando.

### 3. Activa mTLS en el hostname

En la misma página, en el bloque **Hosts**, pulsa **Edit** y escribe el subdominio (`api`; el dominio se añade solo). Desde ese momento Cloudflare pide certificado de cliente a quien conecte con `api.example.com` y deja el resultado en `cf.tls_client_auth.cert_verified`.

Activarlo **todavía no bloquea nada**. Un cliente sin certificado sigue llegando a tu origen.

### 4. Crea la regla mTLS

En **Client Certificates**, pulsa **Create a mTLS rule**. Se abre una regla personalizada del WAF con parte de la expresión ya escrita. Completa el hostname y la ruta, y elige **Block**.

La expresión que conviene acabar teniendo, en el editor:

```
(http.host eq "api.example.com"
 and starts_with(http.request.uri.path, "/v1/")
 and (not cf.tls_client_auth.cert_verified or cf.tls_client_auth.cert_revoked))
```

El `cert_revoked` importa: **un certificado revocado no se bloquea solo**. Hace falta una regla que lo compruebe. Esta regla cuenta como una de las 5 reglas personalizadas del plan Free.

### 5. Lo que añade Enterprise

Con el add-on de API Shield, el mismo patrón (primero la detección, luego la regla) se extiende:

- **Schema validation.** En **Web Assets › Schema validation › Add validation** subes un OpenAPI 3.0 en YAML o JSON. Se aceptan esquemas 3.1 si solo usan la semántica de 3.0; OpenAPI 2.0, no. Luego bloqueas con `cf.schema_validation.uploaded.violated`.
- **JWT validation.** Creas una *token configuration* con dónde buscar el token (cabecera o cookie) y las claves públicas (JWKS) o, desde agosto de 2026, claves simétricas HS256/384/512. Cloudflare no descarga el JWKS por su cuenta: o pegas las claves o las sincronizas con un Worker.
- **Discovery, abuso volumétrico y secuencias** necesitan un **identificador de sesión** (cabecera, cookie o claim de un JWT). Puedes configurar hasta 10.

Cloudflare recomienda revisar primero las violaciones en **Security › Analytics** y empezar con una regla limitada a una sola operación.

### Lo mismo, como código

Con el proveedor de Terraform (v5), la operación del inventario y la regla mTLS:

```hcl
resource "cloudflare_api_shield_operation" "readings" {
  zone_id  = var.zone_id
  method   = "POST"
  host     = "api.example.com"
  endpoint = "/v1/devices/{var1}/readings"
}

resource "cloudflare_ruleset" "custom" {
  zone_id = var.zone_id
  name    = "Reglas personalizadas"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules = [{
    ref         = "mtls_api"
    description = "API solo con certificado de cliente válido"
    expression  = "(http.host eq \"api.example.com\" and starts_with(http.request.uri.path, \"/v1/\") and (not cf.tls_client_auth.cert_verified or cf.tls_client_auth.cert_revoked))"
    action      = "block"
  }]
}
```

Igual que en el [post del WAF](/blog/cloudflare-waf-guia): Terraform asume que controla **todas** las reglas de la fase `http_request_firewall_custom`. Si ya tienes reglas creadas en el panel, impórtalas antes.

En Enterprise con API Shield, el esquema se sube así (las operaciones tienen que existir antes):

```hcl
resource "cloudflare_schema_validation_schemas" "api_v1" {
  zone_id            = var.zone_id
  kind               = "openapi_v3"
  name               = "api-v1.yaml"
  source             = file("./schemas/api-v1.yaml")
  validation_enabled = true
}
```

Activar el esquema no bloquea: sigue haciendo falta la regla con `cf.schema_validation.uploaded.violated`. Para JWT el recurso es `cloudflare_token_validation_config`. Por API, el esquema se sube con `POST /zones/{zone_id}/schema_validation/schemas` y se activa con un `PATCH` a ese esquema poniendo `validation_enabled: true`.

## Cómo comprobarlo

Sin certificado, la regla tiene que devolver 403:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.example.com/v1/status
# 403
```

Con el certificado y la clave, la petición llega al origen:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  --cert sensor-01.pem --key sensor-01.key \
  https://api.example.com/v1/status
# 200
```

Si con certificado sigues recibiendo 403:

- Comprueba que el hostname está en **Hosts**. Si `api` es un CNAME, mTLS tiene que estar activado en `api`, no solo en el destino del CNAME.
- Revisa la expresión de la regla en **Security › Security rules**. El hostname tiene que coincidir exactamente.
- En **Security › Analytics › Events** verás la regla que bloqueó cada petición.

Los certificados se revocan desde **Client Certificates**. Revocar uno libera su hueco en la cuota al instante, y con la regla de arriba el dispositivo deja de entrar.

## Límites y precios

| | Disponibilidad |
|---|---|
| Endpoint Management (inventario manual) | Todos los planes |
| mTLS con la CA de Cloudflare | Todos los planes |
| API Discovery | **Enterprise + API Shield** |
| Schema validation y schema learning | **Enterprise + API Shield** |
| JWT validation | **Enterprise + API Shield** |
| Abuso volumétrico (límites por sesión) | **Enterprise + API Shield** |
| Detección de BOLA y portal para desarrolladores | **Enterprise + API Shield** |
| Sequence mitigation | **Enterprise**, beta cerrada |
| Traer tu propia CA (BYOCA), hasta 5 por cuenta | **Enterprise** |

- **Certificados de cliente:** 100 activos por zona en Free, Pro y Business, sin ampliación posible. Con Enterprise y API Shield, 100.000. Al llegar al tope, la API devuelve el error 1445.
- **Operaciones guardadas:** 100 en Free, 250 en Pro, 500 en Business. Cloudflare envía al borde hasta 3.000 operaciones por zona para hacer el *matching*.
- **Esquemas:** la documentación publica límites por plan (en Free, 5 esquemas activos y 200 KiB en total) y un tamaño máximo de cuerpo validado (1 KiB en Free, 128 KiB en Enterprise). En la práctica, la validación va ligada a la suscripción de API Shield. Si en tu zona no aparece **Schema validation**, es por eso. La acción **Log** solo existe en Enterprise.
- **JWT:** 32 configuraciones de token por zona y hasta 16 claves en cada una (desde agosto de 2026). Solo lee tokens en cabeceras o cookies, no en el cuerpo.
- **Secuencias:** hasta nueve operaciones por secuencia en Sequence Analytics.
- Con Enterprise puedes probar API Shield en preview, sin contrato.

## Documentación oficial

- [API Shield: visión general y disponibilidad](https://developers.cloudflare.com/api-shield/) y [límites por plan](https://developers.cloudflare.com/api-shield/plans/)
- [Endpoint Management](https://developers.cloudflare.com/api-shield/management-and-monitoring/endpoint-management/) y [gestión de operaciones en Web Assets](https://developers.cloudflare.com/security/web-assets/manage-operations/)
- [API Discovery](https://developers.cloudflare.com/api-shield/security/api-discovery/)
- [Schema validation](https://developers.cloudflare.com/api-shield/security/schema-validation/) y [su API](https://developers.cloudflare.com/api-shield/security/schema-validation/api/)
- [mTLS en API Shield](https://developers.cloudflare.com/api-shield/security/mtls/configure/), [certificados de cliente](https://developers.cloudflare.com/ssl/client-certificates/) y [crear un certificado](https://developers.cloudflare.com/ssl/client-certificates/create-a-client-certificate/)
- [JWT validation](https://developers.cloudflare.com/api-shield/security/jwt-validation/) y [su API](https://developers.cloudflare.com/api-shield/security/jwt-validation/api/)
- [Abuso volumétrico](https://developers.cloudflare.com/api-shield/security/volumetric-abuse-detection/), [Sequence Analytics](https://developers.cloudflare.com/api-shield/security/sequence-analytics/) y [Sequence mitigation](https://developers.cloudflare.com/api-shield/security/sequence-mitigation/)
- [Application Profiles: aplicar perfiles con reglas personalizadas](https://developers.cloudflare.com/waf/detections/application-profiles/enforce-profiles-with-custom-rules/)
- [Terraform para API Shield](https://developers.cloudflare.com/api-shield/reference/terraform/)
- [Changelog de API Shield](https://developers.cloudflare.com/api-shield/changelog/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** seguridad del lado del cliente y PCI DSS 4.0.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [Rate limiting en Cloudflare: limitar peticiones sin bloquear a tus usuarios](/blog/cloudflare-rate-limiting-guia)
- [SSL/TLS en Cloudflare: certificados de borde, Origin CA y modos de cifrado](/blog/cloudflare-ssl-tls-guia)
