---
publishDate: 2026-11-24T00:00:00Z
draft: true
title: 'DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio'
excerpt: 'Serie Cloudflare, parte 1. Qué es el DNS de Cloudflare, cuándo poner un registro con proxy y cuándo no, cómo viaja la petición y cómo configurarlo paso a paso en el panel, con Terraform y con la API, incluido DNSSEC.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'dns'
  - 'dnssec'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 1 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En Cloudflare todo empieza por el DNS. Antes del WAF, de la caché o de un Worker, hay un registro DNS que decide si una petición pasa por la red de Cloudflare o va directa a tu servidor. Si este primer paso queda bien, el resto de la serie es mucho más fácil.

## Qué es

El DNS de Cloudflare es un **servicio de DNS autoritativo**: responde, para tu dominio, a la pregunta «¿qué dirección IP tiene `www.example.com`?». Funciona sobre la misma red global que el resto de Cloudflare y está disponible en todos los planes, también en el gratuito.

Hay dos ideas que importan más que ninguna otra:

- **Estado del proxy.** Cada registro `A`, `AAAA` o `CNAME` está **con proxy** (nube naranja) o en **solo DNS** (nube gris). Un registro con proxy responde con IP anycast de Cloudflare, así que el tráfico HTTP/HTTPS pasa por Cloudflare y se puede cachear y proteger. Un registro en solo DNS responde con la IP real de tu servidor. El resto de tipos, como `MX` o `TXT`, siempre son solo DNS.
- **DNSSEC.** Añade firmas criptográficas a tus registros para que los resolvers puedan comprobar que la respuesta viene de verdad de tus servidores autoritativos y que nadie la ha alterado por el camino.

**Planes.** La configuración habitual, la *configuración completa (primary)*, en la que apuntas los nameservers de tu dominio a Cloudflare, está en todos los planes y es la única opción en Free y Pro. La *configuración parcial (CNAME)*, en la que mantienes otro proveedor de DNS y solo pasas por el proxy algunos subdominios, requiere Business o Enterprise. Las transferencias de zona (Cloudflare como primario o secundario junto a otro proveedor) y las configuraciones de subdominio son opciones de Enterprise.

## Casos de uso

- **Una web que tiene que ser rápida y estar protegida.** Pon con proxy los registros `A`/`AAAA`/`CNAME` que sirven tráfico web y tendrás caché, protección DDoS y el WAF delante de tu servidor, sin exponer su IP.
- **Correo y verificaciones de terceros.** Los registros `MX`, SPF, DKIM y DMARC, y los `CNAME`/`TXT` que usan las herramientas SaaS para verificar tu dominio, se quedan en solo DNS.
- **Salir de un proveedor de DNS antiguo.** Cloudflare escanea los registros existentes al añadir el dominio, tú los revisas y cambias los nameservers en tu registrador.
- **Proteger el propio dominio.** DNSSEC impide que un atacante falsifique respuestas DNS de tu dominio, que es la base de los ataques de envenenamiento de caché y de redirección.

## Arquitectura

![Cómo responde el DNS de Cloudflare y adónde va el tráfico: visitante, resolver recursivo, DNS autoritativo de Cloudflare firmado con DNSSEC, y las dos ramas, registro con proxy y registro solo DNS](media:blog/cloudflare-dns-dnssec-guia/00-arquitectura.png)

El recorrido de un visitante que abre `www.example.com`:

1. El navegador pregunta a su **resolver recursivo** (por ejemplo 1.1.1.1 o el de su operador).
2. El resolver sigue la delegación desde la raíz y el registro de `.com` hasta tus **nameservers de Cloudflare**. Con DNSSEC activo, cada paso de esa cadena va firmado y se comprueba.
3. Cloudflare responde:
   - para un registro **con proxy**, con IP anycast de Cloudflare. La petición HTTP llega entonces al centro de datos de Cloudflare más cercano, que aplica las reglas de caché y seguridad y se conecta a tu origen;
   - para un registro **solo DNS**, con la IP real de tu servidor, y el tráfico no toca Cloudflare.

## Implementación paso a paso

Las capturas son de una zona real. Los ID de cuenta, las IP y los correos están difuminados.

### 1. Añade el dominio y revisa los registros

En el panel, añade tu dominio y elige un plan. Cloudflare escanea los registros que encuentra. Ve a **DNS › Records** y comprueba que está todo: el dominio raíz (`@`), `www`, los registros de correo y los de verificación. El escaneo no garantiza encontrar todos los registros.

<!-- CAPTURA 01: DNS › Records, lista de registros -->

### 2. Crea un registro

Pulsa **Add record**, elige el tipo, el nombre y el contenido, y decide el estado del proxy. Para un servidor web:

| Tipo | Nombre | Dirección IPv4 | Proxy        | TTL  |
| ---- | ------ | -------------- | ------------ | ---- |
| A    | demo   | 192.0.2.10     | Con proxy    | Auto |

`192.0.2.10` es una dirección reservada para documentación; usa la tuya. Los registros con proxy siempre tienen TTL **Auto** (300 segundos). En los de solo DNS puedes elegir entre 60 segundos (30 en Enterprise) y un día.

<!-- CAPTURA 02: formulario Add record relleno (sin guardar) -->

### 3. Decide qué va con proxy

Pon con proxy todos los registros `A`, `AAAA` y `CNAME` que sirven tráfico web. Deja en solo DNS el correo, los registros de verificación de dominio y los servicios que no son HTTP. El panel te avisa cuando un registro expone la IP de tu origen.

Un detalle que pilla a mucha gente: si varios registros `A`/`AAAA` comparten nombre y **uno** de ellos va con proxy, Cloudflare los trata todos como con proxy.

<!-- CAPTURA 03: interruptor de proxy en un registro -->

### 4. Apunta los nameservers a Cloudflare

En la página **Overview** de la zona, Cloudflare te muestra los dos nameservers que te ha asignado. Sustituye los actuales en tu registrador. Si el proveedor anterior tenía DNSSEC activo, **borra primero el registro DS antiguo en el registrador**: un DS obsoleto rompe la cadena de confianza y deja la zona en *Pending*. Los dominios de Cloudflare Registrar ya usan los nameservers de Cloudflare.

<!-- CAPTURA 07: Overview con los nameservers asignados -->

### 5. Activa DNSSEC

Ve a **DNS › Settings** y, en la tarjeta **DNSSEC**, pulsa **Enable DNSSEC**. Cloudflare firma la zona y te muestra los valores del registro **DS**: key tag, algoritmo 13 (ECDSA Curve P-256 con SHA-256), tipo de digest y digest.

<!-- CAPTURA 04: DNS › Settings, tarjeta DNSSEC -->
<!-- CAPTURA 05: detalles del registro DS -->

Después añade ese registro DS en tu registrador. Algunos lo hacen solos: Cloudflare publica registros `CDS` y `CDNSKEY`, y los registradores compatibles con la RFC 8078 los recogen automáticamente. En Cloudflare Registrar es un clic, y el DS puede tardar uno o dos días en aparecer.

DNSSEC pasa por estos estados: **Pending** (activado en Cloudflare, pero el DS aún no está en el registrador) y **Active** (DS presente).

### Lo mismo, como código

Con el proveedor de Terraform (v5):

```hcl
resource "cloudflare_dns_record" "demo" {
  zone_id = var.zone_id
  name    = "demo"
  type    = "A"
  content = "192.0.2.10"
  proxied = true
  ttl     = 1 # 1 = Auto
}
```

Con la API, activar DNSSEC necesita un token con el permiso `DNS Write`:

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dnssec" \
  --request PATCH \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{"status": "active"}'
```

Un `GET` al mismo endpoint devuelve los valores del registro DS.

## Cómo comprobarlo

```bash
# Un registro con proxy responde con IP de Cloudflare, no con la de tu origen
dig +short demo.example.com

# La zona está delegada en Cloudflare
dig +short NS example.com

# DNSSEC: registro DS en el padre y respuestas firmadas
dig +short DS example.com
dig +dnssec example.com A
```

También puedes revisar la cadena de confianza con [DNSViz](https://dnsviz.net). En el panel, **DNS › Analytics** muestra las consultas por registro, tipo y código de respuesta.

<!-- CAPTURA 06: DNS › Analytics -->

## Límites y precios

- El DNS autoritativo y DNSSEC están incluidos en todos los planes, también en Free.
- Configuración completa en todos los planes; parcial (CNAME) en Business y Enterprise; transferencias de zona y configuraciones de subdominio en Enterprise.
- Los comentarios en registros están en todos los planes (100 caracteres en Free, 500 en los de pago). Las etiquetas de registro, a partir de Pro.

## Documentación oficial

- [Visión general del DNS](https://developers.cloudflare.com/dns/)
- [Proxy status](https://developers.cloudflare.com/dns/proxy-status/) y [limitaciones del proxy](https://developers.cloudflare.com/dns/proxy-status/limitations/)
- [Crear registros DNS](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/) y [TTL](https://developers.cloudflare.com/dns/manage-dns-records/reference/ttl/)
- [Tipos de configuración DNS (completa, parcial, transferencias de zona)](https://developers.cloudflare.com/dns/zone-setups/)
- [DNSSEC](https://developers.cloudflare.com/dns/dnssec/), [estados de DNSSEC](https://developers.cloudflare.com/dns/dnssec/dnssec-states/) y [activar DNSSEC con Cloudflare Registrar](https://developers.cloudflare.com/registrar/get-started/enable-dnssec/)
- [Zona atascada en Pending Nameserver Update](https://developers.cloudflare.com/dns/zone-setups/troubleshooting/pending-nameservers/)

Documentación consultada el 22 de noviembre de 2026.

**Siguiente en la serie:** SSL/TLS, certificados de edge, Origin CA y modos de cifrado.

## También te puede interesar

- [Cloudflare: Why a Simpler, Faster and Safer Internet Actually Matters](/blog/cloudflare-simpler-faster-safer-internet)
- [Configuring Cloudflare for Families on an ASUS Router](/blog/configuring-cloudflare-for-families-asus)
