---
publishDate: 2026-03-24T09:00:00Z
draft: false
image: 'media:blog/cloudflare-gateway-guia/portada.png'
title: 'Gateway: filtrado DNS y HTTP para tu equipo'
excerpt: 'Serie Cloudflare, parte 12. Qué es Cloudflare Gateway, cómo filtrar el DNS de una oficina o de un portátil, cuándo necesitas el cliente Cloudflare One y la inspección TLS, cómo bloquear categorías de riesgo y apps de IA, la página de bloqueo, los registros y los límites del plan Free.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'zero trust'
  - 'gateway'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 12 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Hasta ahora la serie ha protegido lo que tú publicas: tu web, tu API y tus aplicaciones internas con [Access](/blog/cloudflare-access-guia). Gateway mira en la otra dirección. Protege a **tu equipo** cuando sale a Internet: qué dominios resuelve, a qué servidores se conecta y qué descarga.

## Qué es

Gateway es la pasarela web segura (*Secure Web Gateway*, SWG) de Cloudflare One. Se sitúa entre los dispositivos de tu equipo e Internet y aplica políticas en tres capas:

- **Políticas DNS.** Revisan cada consulta DNS. Si el dominio es de malware, de *phishing* o de una categoría que no quieres, Gateway no lo resuelve y la conexión no empieza.
- **Políticas de red.** Filtran conexiones TCP y UDP por IP, puerto, protocolo o el nombre del servidor (SNI). Sirven para tráfico que no es web: SSH, RDP, bases de datos.
- **Políticas HTTP.** Ven la URL completa, las cabeceras y los ficheros. Bloquean una ruta, una aplicación o una subida de ficheros.

Las tres capas usan las mismas **categorías de seguridad** (malware, *phishing*, *command and control*, criptominería…) y **de contenido** (juego, adultos, redes sociales…). Las mantiene la inteligencia de amenazas de Cloudflare. También reconocen más de veinte **tipos de aplicación**, entre ellos *Artificial Intelligence*.

Gateway vive en el panel de Zero Trust, a nivel de cuenta. No depende de ninguna zona: puedes usarlo sin tener un solo dominio en Cloudflare.

**El cliente.** Lo que antes se llamaba WARP ahora es el **cliente Cloudflare One**. Para DNS no es obligatorio. Para las políticas de red y HTTP, sí (o, sin cliente, un fichero PAC en el navegador). Le dedico el siguiente post.

## Casos de uso

- **Una oficina sin agentes.** Cambias el DNS del router a Gateway y todos los dispositivos de esa red quedan protegidos contra dominios de malware y *phishing*, móviles e impresoras incluidos.
- **Portátiles que salen de la oficina.** Con el cliente Cloudflare One, las mismas políticas se aplican en casa, en el tren o en el hotel, y cada consulta queda asociada a una persona.
- **Controlar la IA que usa tu equipo.** Ves qué aplicaciones de IA se usan y bloqueas las que no has aprobado, o dejas solo la cuenta corporativa.
- **Ver antes de bloquear.** Los registros DNS y HTTP te dicen a qué se conecta tu equipo. Es el punto de partida de cualquier política.

**Y en casa.** Si solo quieres que la red de casa no resuelva malware ni contenido para adultos, no necesitas Gateway: basta con poner `1.1.1.2` o `1.1.1.3` (1.1.1.1 for Families) en el router. Gateway tiene sentido cuando quieres políticas propias, saber quién hizo qué y ver los registros.

## Arquitectura

![Recorrido del tráfico por Gateway: los dispositivos llegan por una ubicación DNS o por el cliente Cloudflare One y pasan por las políticas DNS, de red y HTTP antes de salir a Internet, con una tabla de lo que ve y necesita cada capa](media:blog/cloudflare-gateway-guia/00-arquitectura.png)

Hay dos formas de mandar tráfico a Gateway:

1. **Una ubicación DNS** (*DNS location*). Es una red, como una oficina. Gateway le asigna direcciones de resolución IPv4, una IPv6 propia y nombres DoT y DoH únicos. En IPv4 reconoce la ubicación por la **IP pública de origen**, así que tienes que registrarla. Si tu IP cambia, usa IPv6, DoH o el cliente. Por esta vía solo hay **políticas DNS**.
2. **El cliente Cloudflare One**. Envía el DNS a Gateway y, en modo *Traffic and DNS* con el proxy activo, también el tráfico TCP (y opcionalmente UDP). Por esta vía tienes las tres capas y sabes qué usuario hizo cada petición.

El orden de evaluación, desde julio de 2025:

1. **Políticas DNS**, al resolver el nombre.
2. **Políticas de red**, al abrir la conexión.
3. **Políticas HTTP**, si el tráfico es web. Para ver dentro de HTTPS, Gateway **descifra** la conexión (inspección TLS). Usa un certificado raíz de tu cuenta, y el dispositivo tiene que confiar en él. Las políticas **Do Not Inspect** se evalúan siempre antes que las demás.

Dentro de cada capa manda **la primera coincidencia**: cuando coincide una política Allow o Block, esa capa deja de evaluar. Pon arriba lo más específico (tus dominios corporativos en Allow) y abajo lo general.

## Implementación paso a paso

Las capturas son de mi cuenta, con el tema claro. La política de la captura la abrí para la foto y la cancelé sin guardar. No hay capturas de registros ni de ubicaciones: mostrarían IPs y dominios reales.

Gateway está en **Zero Trust › Traffic controls**. Desde octubre de 2026, la navegación de Zero Trust está unificada con la del resto del panel, y *Traffic controls* sustituye a *Traffic policies*.

### 1. Conecta una red o un dispositivo

**Una oficina o tu red de pruebas.** En **Traffic controls › Resolver endpoints › Add a location**:

- Ponle un nombre y elige los *endpoints*: IPv4, IPv6, DoT y DoH.
- En IPv4, Cloudflare rellena tu IP pública actual. Comprueba que es la de la red que quieres filtrar.
- Al terminar, el asistente te da las direcciones DNS para el router.

**Un portátil.** Instala el cliente Cloudflare One, inicia sesión en tu organización (el nombre de equipo que elegiste al activar Zero Trust) y déjalo en modo *Traffic and DNS*. El inicio de sesión ocupa una plaza, igual que en Access.

Antes de crear políticas, comprueba que llega tráfico: tus consultas deberían aparecer en **Insights › Logs › DNS**. Por defecto, Gateway lo registra todo, también lo que permite.

### 2. Bloquea las amenazas por DNS

Es la primera política que recomienda Cloudflare: mucho impacto y poco riesgo. **Traffic controls › Firewall policies › DNS › Add a policy**:

| Selector | Operador | Valor | Acción |
|---|---|---|---|
| Security Categories | in | *All security risks* | Block |

![Formulario de nueva política de firewall de tipo DNS: condiciones de tráfico e identidad vacías, el desplegable de acciones abierto (Allow, Block, Override, Safe search, YouTube restricted) y la vista previa con las fuentes de tráfico](media:blog/cloudflare-gateway-guia/01-politica-dns.png)

Algunas pautas:

- **Categorías de contenido con cuidado.** Bloquea las que choquen con tu política de uso (juego, adultos…). La categoría *Security Risks* incluye dominios nuevos o mal configurados. Cloudflare recomienda permitirla o aislarla, no bloquearla, para no tumbar dominios legítimos.
- **Una política Allow arriba**, con la lista de tus dominios corporativos, evita que un dominio tuyo recién creado caiga en *New Domains*.
- **Safe Search y YouTube Restricted** son acciones DNS propias: fuerzan la búsqueda segura en Google, Bing, YouTube y otros buscadores sin tocar los navegadores.

### 3. Activa la página de bloqueo

Sin página de bloqueo, una consulta A bloqueada recibe `0.0.0.0` (y una AAAA, `::`). El usuario ve un error de conexión genérico y no sabe qué ha pasado.

Si activas **Modify Gateway block behavior** en la política, Gateway responde con las IPs de su página de bloqueo. Para que se vea bien en HTTPS, el dispositivo tiene que confiar en el certificado raíz de tu cuenta (paso 4).

La página se personaliza para toda la cuenta en **Reusable components › Custom pages › Account Gateway block page**: nombre de la organización, logo, cabecera, mensaje y un enlace `mailto` para que te escriban. También puedes redirigir a una URL tuya (con un 307) y pasarle el contexto de la política en la cadena de consulta.


### 4. Proxy e inspección TLS: la capa HTTP

Las políticas de red y HTTP necesitan tres cosas, todas en **Traffic controls › Traffic settings**:

1. **El proxy.** En *Proxy and inspection*, activa **Allow Secure Web Gateway to proxy traffic** y marca **TCP**. Marca también **UDP** si quieres inspeccionar HTTP/3 (QUIC). Si no, ese tráfico se salta la inspección.
2. **El certificado.** En **Certificates**, el certificado raíz de tu cuenta tiene que estar activo. Las cuentas creadas desde octubre de 2024 ya tienen uno disponible. El cliente Cloudflare One puede instalarlo en el dispositivo. Algunas aplicaciones usan su propio almacén de certificados, y ahí hay que añadirlo a mano.
3. **La inspección TLS.** Activa **Inspect HTTPS requests with TLS decryption**. Sin ella, Gateway solo ve el dominio, no la URL ni el contenido.

![Zero Trust › Traffic controls › Traffic settings: Allow Secure Web Gateway to proxy traffic activado con TCP, UDP e ICMP, e Inspect HTTPS requests with TLS decryption desactivado](media:blog/cloudflare-gateway-guia/03-trafico.png)

La inspección TLS rompe lo que no acepta un certificado intermedio: aplicaciones con *certificate pinning* (muchas móviles), mTLS, certificados autofirmados o sitios con ECH. Para eso existe **Do Not Inspect**. Tu primera política HTTP debería ser esta:

| Selector | Operador | Valor | Acción |
|---|---|---|---|
| Application | in | *Do Not Inspect* | Do Not Inspect |

El valor *Do Not Inspect* es un tipo de aplicación. Agrupa las que, según Cloudflare, fallan con la inspección. Por ejemplo, las actualizaciones de macOS solo confían en certificados de Apple; *Apple (Do Not Inspect)* evita que fallen.

### 5. Bloquea apps de IA (o solo las no aprobadas)

Con HTTP funcionando, puedes filtrar por aplicación. En **Firewall policies › HTTP › Add a policy**:

| Selector | Operador | Valor | Acción |
|---|---|---|---|
| Application | in | *Artificial Intelligence* | Block |


Bloquearlo todo suele ser excesivo. Mejor mira primero:

- **Shadow IT: SaaS analytics** (**Insights › Dashboards**) agrupa el tráfico HTTP por aplicación: quién la usa y cuántos datos sube. Cloudflare sugiere reunir unos siete días de tráfico antes de decidir.
- En **Team & Resources › Applications** marcas cada aplicación como *Approved*, *Unapproved*, *In review* o *Unreviewed*. Marcarla no bloquea nada. Lo hace una política HTTP con el selector **Application Status**, por ejemplo Block para *Unapproved*.
- Desde agosto de 2026, Gateway detecta tráfico **MCP** (el protocolo de los agentes de IA) con el selector *Is MCP* (en beta). El informe **AI security report** resume su uso.

### Lo mismo, como código

Con el proveedor de Terraform v5, el recurso es `cloudflare_zero_trust_gateway_policy`. Esta es la política DNS del paso 2, con página de bloqueo:

```hcl
resource "cloudflare_zero_trust_gateway_policy" "dns_amenazas" {
  account_id  = var.account_id
  name        = "Bloquear amenazas (DNS)"
  description = "Categorías de seguridad de Cloudflare"
  enabled     = true
  precedence  = 20
  action      = "block"
  filters     = ["dns"]
  traffic     = "any(dns.security_category[*] in {68 178 80 83 176 175 117 131 134 151 153})"
  rule_settings = {
    block_page_enabled = true
    block_reason       = "Este dominio es un riesgo de seguridad."
  }
}
```

Las dos políticas HTTP, con la excepción primero:

```hcl
resource "cloudflare_zero_trust_gateway_policy" "http_no_inspeccionar" {
  account_id = var.account_id
  name       = "No inspeccionar apps incompatibles"
  enabled    = true
  precedence = 10
  action     = "off" # Do Not Inspect
  filters    = ["http"]
  traffic    = "any(app.type.ids[*] in {16})"
}

resource "cloudflare_zero_trust_gateway_policy" "http_ia" {
  account_id = var.account_id
  name       = "Bloquear apps de IA"
  enabled    = true
  precedence = 60
  action     = "block"
  filters    = ["http"]
  traffic    = "any(app.type.ids[*] in {25})" # Artificial Intelligence
}
```

La inspección TLS es un ajuste de cuenta:

```hcl
resource "cloudflare_zero_trust_gateway_settings" "ajustes" {
  account_id = var.account_id
  settings = {
    tls_decrypt = {
      enabled = true
    }
  }
}
```

Ten en cuenta:

- Los números de categoría son los del ejemplo de la documentación. La lista de categorías de seguridad crece. Para no quedarte corto, crea la política en el panel con *All security risks* y usa **Copy as JSON** en su menú (⋮) para copiar la expresión exacta.
- Fija `precedence` a mano. La v4 del proveedor alteraba la precedencia con un *hash* y daba errores al reordenar. Por eso Cloudflare recomienda la v5.
- El token necesita *Zero Trust: Edit* en la cuenta.

Con la API es `POST /accounts/{account_id}/gateway/rules`, con los mismos campos.

## Cómo comprobarlo

Cloudflare tiene un dominio de prueba por categoría con el formato `<categoría>.testcategory.com`. Desde un dispositivo que use Gateway:

```bash
dig malware.testcategory.com +short
# Con página de bloqueo: 162.159.36.12 y 162.159.46.12
# Sin página de bloqueo: 0.0.0.0
```

Otros útiles: `phishing.testcategory.com`, `cryptomining.testcategory.com` y `commandandcontrolandbotnet.testcategory.com`. En el navegador, deberían mostrar tu página de bloqueo.

Para HTTP, abre una aplicación de IA que hayas bloqueado. Debe salir la página de bloqueo en la URL original, sin aviso de certificado. Si aparece un aviso, el certificado raíz no está instalado o no está activo.

Desde el propio dispositivo, [help.one.cloudflare.com](https://help.one.cloudflare.com/) te dice si pasas por Gateway y en qué organización.

En el panel, **Insights › Logs** tiene una pestaña por capa: **DNS**, **Network** y **HTTP**. Cada entrada muestra la decisión, la política que coincidió y las categorías. En **Traffic settings › Traffic logging** decides si registrar todo, solo lo bloqueado o nada.

## Límites y precios

Zero Trust tiene planes propios, separados de los de la zona, y se paga por plaza: cada persona que inicia sesión en el cliente o en Access ocupa una. El plan Free es el mismo que vimos en [Access](/blog/cloudflare-access-guia), y los dos productos comparten las plazas. Las ves en **Cloudflare One overview**. Para liberar una, elimina al usuario en **Team & Resources › Users** (revocarlo no basta).

Límites por cuenta:

| | Límite |
|---|---|
| Políticas DNS, de red y HTTP | 500 de cada tipo |
| Ubicaciones DNS | 250 |
| Rangos de IP de origen por ubicación | 1.500 |
| Listas | 100 |
| Elementos por lista | 1.000 (5.000 en Enterprise) |
| Certificados raíz activos | 10 |

Retención de los registros DNS, de red y HTTP en el panel:

| Plan | Retención |
|---|---|
| Free | 24 horas |
| De pago (Standard o Gateway) | 30 días |
| Enterprise | 180 días DNS; 30 días red y HTTP |

Solo Enterprise:

- **Resolver policies** (mandar ciertas consultas a tus propios DNS) y **egress policies** con IPs de salida dedicadas.
- **IPv4 de resolución dedicada** o tus propias IPs (BYOIP) para las ubicaciones, y registrar a mano IPs de origen desde las que no estás conectado.
- **Notificaciones de bloqueo** del cliente Cloudflare One.
- **Tu propia CA raíz** para la inspección, en lugar del certificado de Cloudflare.

**Logpush**, para enviar los registros a tu SIEM, está en todos los planes, pero la mayoría de los conjuntos de datos de Zero Trust exigen un plan de pago.

## Documentación oficial

- [Gateway: visión general](https://developers.cloudflare.com/cloudflare-one/traffic-controls/) y [primeros pasos](https://developers.cloudflare.com/cloudflare-one/traffic-controls/get-started/)
- [Políticas DNS](https://developers.cloudflare.com/cloudflare-one/traffic-controls/dns-policies/), [políticas habituales](https://developers.cloudflare.com/cloudflare-one/traffic-controls/dns-policies/common-policies/) y [cómo probar el filtrado](https://developers.cloudflare.com/cloudflare-one/traffic-controls/dns-policies/test-dns-filtering/)
- [Ubicaciones DNS](https://developers.cloudflare.com/cloudflare-one/traffic-controls/resolver-endpoints/) y [IPs de resolución](https://developers.cloudflare.com/cloudflare-one/traffic-controls/resolver-endpoints/dns-resolver-ips/)
- [Políticas de red](https://developers.cloudflare.com/cloudflare-one/traffic-controls/network-policies/), [políticas HTTP](https://developers.cloudflare.com/cloudflare-one/traffic-controls/http-policies/) y [políticas HTTP habituales](https://developers.cloudflare.com/cloudflare-one/traffic-controls/http-policies/common-policies/)
- [Inspección TLS](https://developers.cloudflare.com/cloudflare-one/traffic-controls/http-policies/tls-decryption/), [proxy](https://developers.cloudflare.com/cloudflare-one/traffic-controls/proxy/) y [certificados de usuario](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/user-side-certificates/)
- [Orden de evaluación](https://developers.cloudflare.com/cloudflare-one/traffic-controls/order-of-enforcement/)
- [Categorías de dominio](https://developers.cloudflare.com/cloudflare-one/traffic-controls/domain-categories/) y [aplicaciones y tipos de aplicación](https://developers.cloudflare.com/cloudflare-one/traffic-controls/application-app-types/)
- [Página de bloqueo](https://developers.cloudflare.com/cloudflare-one/reusable-components/custom-pages/gateway-block-page/)
- [Shadow IT: SaaS analytics](https://developers.cloudflare.com/cloudflare-one/insights/analytics/shadow-it-discovery/)
- [Registros de Gateway](https://developers.cloudflare.com/cloudflare-one/insights/logs/dashboard-logs/gateway-logs/) y [retención de registros](https://developers.cloudflare.com/cloudflare-one/insights/logs/)
- [Plazas](https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/) y [límites de la cuenta](https://developers.cloudflare.com/cloudflare-one/account-limits/)
- [Changelog de Gateway](https://developers.cloudflare.com/cloudflare-one/changelog/gateway/), la [navegación unificada de octubre de 2026](https://developers.cloudflare.com/changelog/post/2026-10-12-unified-dashboard-navigation/) y las [políticas con lenguaje natural](https://developers.cloudflare.com/changelog/post/2026-05-12-natural-language-policy-creation/)
- [1.1.1.1 for Families](https://developers.cloudflare.com/1.1.1.1/setup/#1111-for-families), para el caso doméstico

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** WARP y postura del dispositivo, con el cliente Cloudflare One.

## También te puede interesar

- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
