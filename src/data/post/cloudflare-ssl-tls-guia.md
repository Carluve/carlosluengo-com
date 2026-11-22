---
publishDate: 2026-11-24T09:00:00Z
draft: true
image: 'media:blog/cloudflare-ssl-tls-guia/portada.png'
title: 'SSL/TLS en Cloudflare: certificados de borde, Origin CA y modos de cifrado'
excerpt: 'Serie Cloudflare, parte 3. Las dos conexiones TLS que hay en cada petición, qué modo de cifrado elegir (y por qué Flexible casi nunca), qué certificado te da Cloudflare gratis, cómo poner un certificado de Origin CA y pasar a Full (strict), y cómo comprobarlo.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'ssl'
  - 'tls'
  - 'https'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 3 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En cuanto un registro DNS pasa por el proxy de Cloudflare (lo vimos en la [parte 1](/blog/cloudflare-dns-dnssec-guia)), tu web tiene HTTPS sin hacer nada más. Pero ese candado solo cubre la mitad del camino. Este post va de la otra mitad: qué pasa entre Cloudflare y tu servidor y cómo dejarlo bien cerrado.

## Qué es

SSL/TLS en Cloudflare es el conjunto de ajustes que deciden **cómo se cifra cada petición**. Hay dos conexiones distintas:

- **Visitante → Cloudflare.** La protege un **certificado de borde** (*edge certificate*) que Cloudflare presenta al navegador. El más común es **Universal SSL**: gratuito, de validación de dominio (DV), emitido y renovado automáticamente en todos los planes.
- **Cloudflare → tu origen.** La decide el **modo de cifrado** (Off, Flexible, Full, Full (strict) y, en Enterprise, Strict). Para el modo más seguro, Full (strict), tu servidor necesita un certificado válido; Cloudflare te da uno gratis con **Origin CA**.

**Planes.** Universal SSL, los modos Off a Full (strict), Origin CA, Always Use HTTPS, HSTS y la versión mínima de TLS de la zona están en todos los planes. Advanced Certificate Manager es un complemento de pago para cualquier plan. Los certificados propios (*custom certificates*) son de Business y Enterprise. El modo **Strict (SSL-Only Origin Pull)** es **solo Enterprise**: en la zona Free de las capturas ni siquiera aparece.

## Casos de uso

- **Una web personal o de empresa detrás de Cloudflare.** Universal SSL para el visitante, certificado de Origin CA en el servidor y modo Full (strict). Coste: cero.
- **Un servidor que todavía no tiene certificado.** Empiezas en Full con un certificado autofirmado y subes a Full (strict) cuando instales el de Origin CA. Flexible solo como último recurso y nunca con logins ni datos personales.
- **Cumplimiento (PCI DSS, ENS, políticas internas).** Versión mínima TLS 1.2, HSTS y, si hace falta probar que la petición viene de tu cuenta de Cloudflare, Authenticated Origin Pulls con tu propio certificado.
- **Subdominios de varios niveles o una CA concreta.** `api.dev.example.com` no lo cubre Universal SSL. Para eso está Advanced Certificate Manager, que también deja elegir la CA y la validez.

## Arquitectura

![Las dos conexiones TLS: visitante → borde de Cloudflare con el certificado de borde, y borde → origen según el modo de cifrado, con una tabla de los modos Off, Flexible, Full, Full (strict) y Strict](media:blog/cloudflare-ssl-tls-guia/00-arquitectura.png)

1. El visitante abre `https://www.example.com`. El registro tiene proxy, así que el navegador negocia TLS con el **borde de Cloudflare**, que presenta el certificado de borde. Aquí mandan la versión mínima de TLS, TLS 1.3 y HSTS.
2. Cloudflare abre su propia conexión al **origen**. Si va cifrada y si comprueba el certificado del servidor depende del modo:
   - **Off**: todo en HTTP.
   - **Flexible**: HTTPS hasta Cloudflare y HTTP hasta tu servidor. El visitante ve el candado, pero el último tramo viaja en claro.
   - **Full**: Cloudflare usa el mismo esquema que el visitante y, si es HTTPS, no valida el certificado del origen (vale uno autofirmado o caducado).
   - **Full (strict)**: como Full, pero el certificado del origen tiene que estar en vigor, cubrir el nombre del host y estar firmado por una CA pública o por la Origin CA de Cloudflare.
   - **Strict (SSL-Only Origin Pull)**: siempre HTTPS al origen, aunque el visitante llegue por HTTP, con la misma validación que Full (strict). Solo Enterprise.

Por encima de todo está **Automatic SSL/TLS**, el modo por defecto en zonas nuevas: Cloudflare escanea tu origen más o menos una vez al mes y sube el modo al más seguro que soporte, poco a poco (empieza con el 1 % del tráfico) y con marcha atrás automática si el origen falla. Nunca baja de modo.

## Implementación paso a paso

Las capturas son de `carluve.dev`, una zona en plan **Free**. Los subdominios de los certificados avanzados están tapados.

### 1. Mira el estado actual

En **SSL/TLS › Overview** ves el modo activo y cuánto tráfico llega por cada versión de TLS en las últimas 24 horas.

![SSL/TLS › Overview en una zona Free: modo de cifrado Full, Automatic mode desactivado y tráfico por versión de TLS](media:blog/cloudflare-ssl-tls-guia/01-resumen.png)

En esta zona el modo es **Full** y el modo automático está desactivado: funciona, pero no se valida el certificado del origen. Es justo lo que vamos a corregir.

### 2. Instala un certificado de Origin CA en tu servidor

Antes de pasar a Full (strict), el origen necesita un certificado válido. Si ya tiene uno de una CA pública (Let's Encrypt, por ejemplo), sáltate este paso.

Ve a **SSL/TLS › Origin Server › Create Certificate**. Deja que Cloudflare genere la clave privada y el CSR (RSA o ECC), revisa los nombres (por defecto el dominio raíz y `*.dominio`) y elige la validez: hasta **15 años**.

![Formulario Origin Certificate Installation: clave RSA 2048 generada por Cloudflare, hostnames *.carluve.dev y carluve.dev, validez de 15 años](media:blog/cloudflare-ssl-tls-guia/05-origin-ca.png)

Al pulsar **Create**, copia el certificado y la **clave privada** y guárdalos en el servidor. La clave no se vuelve a mostrar. Formato PEM para Nginx o Apache (PKCS#7 para Windows/Tomcat). En Nginx:

```nginx
server {
    listen 443 ssl;
    server_name example.com *.example.com;
    ssl_certificate     /etc/ssl/cloudflare/origin.pem;
    ssl_certificate_key /etc/ssl/cloudflare/origin.key;
}
```

Ojo: un certificado de Origin CA **solo lo reconoce Cloudflare**. Si pausas Cloudflare o pones el registro en solo DNS, los navegadores lo darán por inválido. Tampoco avisa cuando va a caducar.

### 3. Cambia el modo a Full (strict) o activa el automático

En **SSL/TLS › Overview › Configure** eliges el modo. Puedes fijar **Full (strict)** a mano o marcar **Automatic SSL/TLS** para que Cloudflare lo suba solo cuando detecte que tu origen lo soporta.

![Pantalla Encryption mode and origin connection settings: Automatic SSL/TLS (recomendado), Full (Strict), Full, Flexible y Off, con el detalle del modo Full a la derecha](media:blog/cloudflare-ssl-tls-guia/02-modos.png)

Fíjate en el aviso del modo Full a la derecha: el tráfico va cifrado, pero un atacante podría hacerse pasar por tu servidor. Con Full (strict) eso ya no es posible.

Un detalle: pasar de Off o Flexible a Full o superior cambia la clave de caché por defecto, así que la caché empieza de cero.

### 4. Revisa el certificado de borde

En **SSL/TLS › Edge Certificates** está la lista de certificados que Cloudflare sirve a los visitantes. En una zona Free, el **Universal** cubre el dominio raíz y un nivel de comodín (`*.carluve.dev`), junto a un certificado de **respaldo** por si hay que rotarlo de urgencia.

![Edge Certificates en carluve.dev: certificados Advanced con los hostnames tapados, y el Universal desplegado: ECDSA SHA256, validez de 3 meses, validación TXT, Google Trust Services; abajo el certificado Backup](media:blog/cloudflare-ssl-tls-guia/03-universal.png)

Lo que dice la captura cuadra con la documentación:

- **ECDSA**: en Free el Universal es solo ECDSA. Pro, Business y Enterprise reciben además uno RSA para clientes antiguos.
- **3 meses** de validez, con renovación automática 30 días antes.
- **Google Trust Services** como CA. Cloudflare la elige (también usa Let's Encrypt y SSL.com) y puede cambiarla sin avisar.

Los certificados **Advanced** de la lista son de Advanced Certificate Manager: los uso para subdominios concretos y se renuevan solos.

### 5. Ajustes de borde: HTTPS siempre, HSTS y versión mínima

Más abajo, en la misma página:

![Ajustes de borde: Always Use HTTPS desactivado con aviso de bucles de redirección, botón Enable HSTS, Minimum TLS Version en TLS 1.0 (default) y Opportunistic Encryption activado](media:blog/cloudflare-ssl-tls-guia/04-ajustes.png)

- **Always Use HTTPS**: redirige todo el HTTP a HTTPS en el borde. Actívalo y **quita la redirección del servidor** si la tenías, o tendrás bucles (`ERR_TOO_MANY_REDIRECTS`).
- **Minimum TLS Version**: viene en **TLS 1.0**. Súbelo a **TLS 1.2**, lo que pide PCI DSS. TLS 1.3 es el que más tráfico lleva ya (en la captura del resumen, 7.040 peticiones frente a 2 de TLS 1.2).
- **HSTS**: dice al navegador que use siempre HTTPS. Empieza con 6 meses de `max-age` y sube a 12 cuando esté estable. Es difícil de deshacer: si un día quitas HTTPS o sacas el dominio de Cloudflare, la web será inaccesible hasta que caduque el `max-age`. *Preload* exige 12 meses y enviarlo a mano a la lista de los navegadores.
- **Opportunistic Encryption** y **Automatic HTTPS Rewrites**: ayudan con navegadores y enlaces `http://` antiguos, pero no sustituyen a HTTPS.

### Lo mismo, como código

Con el proveedor de Terraform (v5):

```hcl
resource "cloudflare_zone_setting" "ssl" {
  zone_id    = var.zone_id
  setting_id = "ssl"
  value      = "strict" # Full (strict)
}

resource "cloudflare_zone_setting" "min_tls" {
  zone_id    = var.zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}

resource "cloudflare_origin_ca_certificate" "origin" {
  csr                = tls_cert_request.origin.cert_request_pem
  hostnames          = ["example.com", "*.example.com"]
  request_type       = "origin-ecc"
  requested_validity = 5475 # 15 años
}
```

El CSR sale de un recurso `tls_cert_request` del proveedor `hashicorp/tls`.

Con la API, con un token que tenga el permiso *Zone Settings: Edit*:

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/ssl" \
  --request PATCH \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{"value": "strict"}'
```

Los valores son `off`, `flexible`, `full`, `strict` y `origin_pull` (este último, Enterprise). Para crear certificados de Origin CA por API se usa `POST /certificates` con un token que tenga *SSL and Certificates: Edit*. Las antiguas *Origin CA keys* (`v1.0-…`) se retiraron el 30 de septiembre de 2026.

## Cómo comprobarlo

```bash
# Qué certificado presenta el borde (emisor y fechas)
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -issuer -dates

# HTTP redirige a HTTPS y llega la cabecera HSTS
curl -sI http://example.com | grep -i location
curl -sI https://example.com | grep -i strict-transport-security

# Un TLS 1.1 debería fallar si la mínima es 1.2
curl -sI --tls-max 1.1 https://example.com
```

Si algo falla al pasar a Full o Full (strict), los errores te dicen dónde mirar:

- **525**: el apretón de manos TLS con el origen falla. Suele ser que no hay certificado, el 443 está cerrado o no hay SNI.
- **526**: estás en Full (strict) y el certificado del origen no es válido (caducado, nombre que no coincide, cadena incompleta o CA no reconocida).
- **Demasiadas redirecciones**: casi siempre Flexible más una redirección a HTTPS en el servidor. Cloudflare pide por HTTP, el servidor redirige a HTTPS, y vuelta a empezar.

Desde fuera, [SSL Labs](https://www.ssllabs.com/ssltest/) analiza el certificado de borde y las versiones de TLS que acepta Cloudflare para tu dominio.

## Límites y precios

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Universal SSL | Solo ECDSA | ECDSA + RSA | ECDSA + RSA | ECDSA + RSA |
| Modos Off → Full (strict) | ✓ | ✓ | ✓ | ✓ |
| Strict (SSL-Only Origin Pull) | — | — | — | ✓ |
| Origin CA, Always Use HTTPS, HSTS, TLS mínimo de zona | ✓ | ✓ | ✓ | ✓ |
| Advanced Certificate Manager | De pago | De pago | De pago | De pago |
| Certificados propios | — | — | 5 modernos + 1 legacy | 5 + 1, ampliable |

- Universal SSL cubre el dominio raíz y **un nivel** de subdominios. `a.b.example.com` necesita Advanced Certificate Manager, que admite hasta 50 nombres por certificado, nombres de varios niveles, elección de CA y validez de 2 semanas a 3 meses (1 año con SSL.com en Enterprise).
- Todo lo que emite Cloudflare es DV. Para OV o EV hay que subir un certificado propio (Business o Enterprise).
- El Universal tarda **de 15 minutos a 24 horas** en emitirse tras activar el dominio.
- Origin CA: hasta 200 nombres por certificado, sin IPs, comodines de un nivel y sin avisos de caducidad.

## Documentación oficial

- [Modos de cifrado](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/), [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/) y [Strict (SSL-Only Origin Pull)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/ssl-only-origin-pull/)
- [Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/) y [sus limitaciones](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/)
- [Autoridades de certificación](https://developers.cloudflare.com/ssl/reference/certificate-authorities/) y [periodos de validez](https://developers.cloudflare.com/ssl/reference/certificate-validity-periods/)
- [Advanced Certificate Manager](https://developers.cloudflare.com/ssl/edge-certificates/advanced-certificate-manager/) y [certificados propios](https://developers.cloudflare.com/ssl/edge-certificates/custom-certificates/)
- [Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/) y [Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)
- [Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/), [HSTS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/) y [versión mínima de TLS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/minimum-tls/)
- [Intercambio de claves automático con el origen (changelog, 21-jul-2026)](https://developers.cloudflare.com/changelog/post/2026-07-21-automatic-origin-key-exchange/)
- Errores [525](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/), [526](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-526/) y [demasiadas redirecciones](https://developers.cloudflare.com/ssl/troubleshooting/too-many-redirects/)

Documentación consultada el 22 de noviembre de 2026.

**Siguiente en la serie:** CDN y caché, con Cache Rules y Tiered Cache.

## También te puede interesar

- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
