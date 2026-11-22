---
publishDate: 2026-03-17T09:00:00Z
draft: false
image: 'media:blog/cloudflare-tunnel-guia/portada.png'
title: 'Cloudflare Tunnel: publicar un servicio sin abrir puertos'
excerpt: 'Serie Cloudflare, parte 11. Cómo publicar una web o una API de tu casa, una VM o un contenedor sin abrir puertos: cloudflared, aplicaciones publicadas, redes privadas, réplicas, Access, Quick Tunnels y qué hacer con un 502 o un 1033.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'tunnel'
  - 'zero trust'
  - 'redes'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 11 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En la [parte 10](/blog/cloudflare-access-guia) pusimos un login delante de una aplicación. Quedaba un cabo suelto: si tu servidor tiene una IP pública y un puerto abierto, alguien puede ir directo a él y saltarse Cloudflare. Tunnel cierra esa puerta. Tu origen no acepta conexiones de nadie: es él quien llama a Cloudflare.

## Qué es

Cloudflare Tunnel conecta un servicio (una web, una API, un panel) con la red de Cloudflare sin exponer la IP del servidor. Instalas `cloudflared` en una máquina que llegue al servicio. Abre conexiones **salientes** hacia Cloudflare y por ellas recibe las peticiones de tus visitantes.

Tres ideas clave:

- **Nada entra, todo sale.** No abres puertos en el router ni en el cortafuegos. Solo necesitas salida hacia Cloudflare por el puerto **7844** (UDP para QUIC o TCP para HTTP/2).
- **Túnel gestionado en remoto.** La configuración vive en Cloudflare y la cambias desde el panel, la API o Terraform. En el servidor solo hay un **token**. Es la opción que recomienda Cloudflare. Los túneles gestionados en local (con un `config.yml`) quedan para casos concretos.
- **Dos formas de usarlo.** Como **aplicación publicada**: un nombre de host público (`app.example.com`) apunta a un servicio local (`http://localhost:8080`). O como **red privada**: un rango de IP (`10.0.0.0/24`) al que solo llegan los dispositivos con el cliente de Cloudflare One (el antiguo WARP).

**Planes.** Tunnel está disponible en todos los planes. Cada cuenta incluye **1.000 túneles** sin coste.

## Casos de uso

- **Un servidor en casa.** Un Home Assistant, un NAS o un Portainer detrás de un router con CG-NAT o sin IP fija.
- **Un origen sin IP pública.** Una VM en la nube con solo salida a internet. La caché, el WAF y la protección DDoS de las partes anteriores se aplican igual.
- **Herramientas internas con login.** Tunnel publica, [Access](/blog/cloudflare-access-guia) decide quién entra. Juntos sustituyen a la VPN para aplicaciones web.
- **Acceso a una red privada.** SSH, RDP o una base de datos por su IP interna, solo para tus dispositivos.
- **Enseñar algo en local.** Una URL temporal de `trycloudflare.com`, sin cuenta ni dominio.

## Arquitectura

![Cloudflare Tunnel: el servidor con cloudflared abre cuatro conexiones salientes por el puerto 7844 hacia dos centros de datos de Cloudflare; el visitante llega por app.example.com (CNAME a UUID.cfargotunnel.com) y pasa por WAF, caché y Access antes de bajar por el túnel; un usuario con el cliente de Cloudflare One llega a la red privada 10.0.0.0/24 por la misma conexión. Debajo, tabla de estados del túnel](media:blog/cloudflare-tunnel-guia/00-arquitectura.png)

El recorrido de una petición a una aplicación publicada:

1. `cloudflared` arranca en tu servidor y abre **cuatro conexiones** salientes hacia, al menos, **dos centros de datos** de Cloudflare. Usa QUIC por defecto. Si no puede salir por UDP, pasa a HTTP/2 por TCP. Las conexiones QUIC van cifradas con criptografía poscuántica.
2. Al publicar `app.example.com`, Cloudflare crea un registro **CNAME con proxy** hacia `<UUID>.cfargotunnel.com`. Ese subdominio solo funciona en registros DNS de **tu propia cuenta**: aunque alguien conozca el UUID, no puede usar tu túnel desde otra.
3. La petición del visitante llega al borde y atraviesa todo lo que tengas configurado: WAF, caché, reglas, Access.
4. Cloudflare la envía por una de las conexiones abiertas. `cloudflared` la entrega al servicio local según las **reglas de ingreso** (*ingress*): nombre de host, ruta opcional y dirección del servicio.
5. La respuesta vuelve por el mismo camino.

En una red privada, quien entra es un dispositivo con el cliente de Cloudflare One. Su tráfico hacia `10.0.0.0/24` pasa por las políticas de Gateway y baja por el túnel que anuncia ese rango.

## Implementación paso a paso

Las capturas son de la cuenta de `carluve.dev`, una zona en plan **Free**. El formulario de la captura se canceló sin crear el túnel. En el texto, el ejemplo es `app.example.com`, servido en `http://localhost:8080`.

Antes de empezar, si el servidor está detrás de un cortafuegos estricto, comprueba que puede salir al puerto 7844. Desde la versión 2026.5.2, `cloudflared` lo comprueba al arrancar y te dice qué falla.

### 1. Crea el túnel

Desde febrero de 2026 los túneles se gestionan en el panel principal, en **Networking › Tunnels**:

1. **Create Tunnel**.
2. Ponle un nombre que diga qué conecta: `casa-nas`, `vm-staging`.
3. **Create Tunnel**.

![Networking › Tunnels › Create a Tunnel: campo Tunnel name con el nombre de ejemplo «oficina-madrid» y el botón Create Tunnel](media:blog/cloudflare-tunnel-guia/01-crear-tunel.png)

### 2. Instala cloudflared

En **Setup Environment** eliges sistema operativo y arquitectura. El panel te da el comando de instalación con el token ya incluido. En Linux y macOS queda así:

```bash
sudo cloudflared service install <TOKEN_DEL_TUNEL>
```

Así `cloudflared` queda instalado como servicio y arranca solo al reiniciar la máquina. Con Docker:

```bash
docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <TOKEN_DEL_TUNEL>
```

Cuando el túnel conecta, pulsa **Continue**. En la lista debe aparecer como **Healthy**.

**El token es la llave del túnel.** Quien lo tenga puede levantar un conector y recibir tu tráfico. No lo subas a un repositorio. Si se filtra, genera otro en **Overview › Refresh token**. Con dos réplicas o más, lo rotas sin cortar el servicio.

### 3. Publica una aplicación

Dentro del túnel, pestaña **Routes › Add route › Published application**:

| Campo | Valor |
|---|---|
| Hostname | Subdominio `app` y dominio `example.com` |
| Path | Vacío (o `/api` para publicar solo una ruta) |
| Service URL | `http://localhost:8080` |

Pulsa **Add route**. Cloudflare crea el CNAME por ti y, desde ese momento, **cualquiera** puede abrir `app.example.com`. Si no debe ser público, crea antes la aplicación de Access (paso 5).


Detalles que dan problemas:

- **La ruta no se reescribe.** Si publicas `/api`, tu servicio recibe `/api/...` completo. Para quitarla, usa una regla de reescritura de URL en Cloudflare o un proxy local.
- **Subdominios de varios niveles.** El certificado universal no cubre `a.b.example.com`. Necesitas un certificado avanzado ([parte 3](/blog/cloudflare-ssl-tls-guia)).
- **Origen HTTPS.** Si el certificado de tu servicio es para `app.example.com` y no para `localhost`, rellena **Origin Server Name** en **Additional application settings**. **Disable TLS certificate verification**, solo para pruebas.
- **Vídeo y ficheros grandes.** Las aplicaciones publicadas pasan por el proxy. En Free, Pro y Business, las condiciones del servicio piden un producto específico para servir vídeo y ficheros grandes. En una ruta privada no se aplica.
- **La IP del visitante.** Tu servicio ve las peticiones como si vinieran de `cloudflared`. La IP real llega en la cabecera `CF-Connecting-IP`.

### 4. Conecta una red privada

Para llegar por IP a máquinas de tu red no publicas un nombre de host: anuncias un rango.

1. **Networking › Routes › Create route › Tunnel CIDR**.
2. Elige el túnel y escribe el rango en **Network**: `10.0.0.0/24` o una sola IP.
3. **Create route**.


Con eso `cloudflared` ya sabe enrutar ese tráfico, pero todavía no llega nadie. Faltan tres cosas en Zero Trust:

- **Split tunnels.** El cliente de Cloudflare One excluye por defecto los rangos privados RFC 1918. Saca tu rango de esa exclusión (o inclúyelo, si usas el modo Include).
- **Proxy de Gateway.** En **Traffic controls › Traffic settings › Proxy and inspection**, activa **Allow Secure Web Gateway to proxy traffic** con **TCP** y **UDP**. UDP es necesario para los servidores DNS internos.
- **Políticas.** Sin una política de red de Gateway, **cualquier dispositivo inscrito llega a toda la red**. Pon un bloqueo general para el rango y, por encima, reglas Allow para cada grupo.

Si dos redes usan el mismo rango (dos oficinas con `192.168.1.0/24`), sepáralas con **redes virtuales**.

Para el acceso privado que sustituye a la VPN, la documentación de Tunnel ahora también recomienda Cloudflare Mesh.

### 5. Ponle Access delante

Una aplicación publicada es pública hasta que le pones Access. El orden importa: **crea primero la aplicación de Access** con su política (lo vimos en la [parte 10](/blog/cloudflare-access-guia)) y **después** la ruta del túnel. Si lo haces al revés, la aplicación queda abierta mientras tanto.

Después, haz que `cloudflared` compruebe el JWT de Access. En la ruta publicada, **Additional application settings › Access**, activa **Protect with Access** e indica el nombre del equipo y el **AUD** de la aplicación. Sin un JWT válido, nadie llega al servicio aunque encuentre otro camino hasta `cloudflared`.


Dos matices:

- Tunnel **no valida** el JWT por sí solo. O lo activas aquí, o lo hace tu aplicación.
- Desde la versión 2026.10.0, `cloudflared` puede normalizar la URL (`..`, barras dobles) antes de comparar con las reglas de ingreso. Viene desactivado. Cloudflare prevé activarlo por defecto el 8 de febrero de 2027. Mantén `cloudflared` actualizado.

### 6. Réplicas y alta disponibilidad

Un solo `cloudflared` es un punto único de fallo. Para tener redundancia, ejecuta el **mismo token** en otra máquina: **Overview › Add a replica** te da el comando. Cada réplica abre sus propias cuatro conexiones.

- Si una réplica cae, Cloudflare reintenta con otra. Es *failover*, no reparto de carga: cada petición va a la réplica más cercana a donde entró.
- Para repartir carga con comprobaciones de salud, usa un **Load Balancer** con los túneles como orígenes.
- Máximo **25 réplicas** activas por túnel.

### Quick Tunnels: para probar, no para producción

Sin cuenta y sin dominio:

```bash
cloudflared tunnel --url http://localhost:8080
```

`cloudflared` imprime una URL de `trycloudflare.com` que dura lo que dure el proceso. Desde octubre de 2026 puedes exigir un código por correo antes de entrar:

```bash
cloudflared tunnel --url http://localhost:8080 --allowed-mail 'tu@example.com'
```

Admite varios correos separados por comas o todo un dominio (`'*@example.com'`). Sus límites: **200 peticiones en vuelo** (las demás reciben un 429), **sin Server-Sent Events**, sin garantía de disponibilidad y una URL distinta cada vez.

### Lo mismo, como código

Con el proveedor de Terraform (v5), el túnel, su configuración, el DNS y la ruta privada:

```hcl
resource "cloudflare_zero_trust_tunnel_cloudflared" "casa" {
  account_id = var.account_id
  name       = "casa-nas"
  config_src = "cloudflare" # gestionado en remoto
}

data "cloudflare_zero_trust_tunnel_cloudflared_token" "casa" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.casa.id
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "casa" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.casa.id
  config = {
    ingress = [
      {
        hostname = "app.example.com"
        service  = "http://localhost:8080"
        origin_request = {
          access = {
            required  = true
            team_name = "tuequipo"
            aud_tag   = [cloudflare_zero_trust_access_application.app.aud]
          }
        }
      },
      {
        service = "http_status:404" # regla final obligatoria
      },
    ]
  }
}

resource "cloudflare_dns_record" "app" {
  zone_id = var.zone_id
  name    = "app"
  type    = "CNAME"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.casa.id}.cfargotunnel.com"
  ttl     = 1
  proxied = true
}

resource "cloudflare_zero_trust_tunnel_cloudflared_route" "lan" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.casa.id
  network    = "10.0.0.0/24"
  comment    = "Red de casa"
}

output "tunnel_token" {
  value     = data.cloudflare_zero_trust_tunnel_cloudflared_token.casa.token
  sensitive = true
}
```

La aplicación de Access (`cloudflare_zero_trust_access_application.app`) es la del post anterior. Tres detalles:

- La lista `ingress` **necesita una regla final sin hostname**, aquí un 404, para lo que no coincida con nada.
- Con Terraform o la API, **el CNAME no se crea solo**. Por eso está el `cloudflare_dns_record`.
- El token de API necesita *Cloudflare Tunnel: Edit*, *DNS: Edit* y, para la aplicación de Access, *Access: Apps and Policies Edit*. El token del túnel queda en el estado de Terraform: trátalo como un secreto.

Por API, la configuración se sustituye entera con `PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations`, y el token se lee con `GET /accounts/{account_id}/cfd_tunnel/{tunnel_id}/token`.

## Cómo comprobarlo

Primero, el estado del túnel en **Networking › Tunnels**:

| Estado | Qué significa |
|---|---|
| **Healthy** | Conectado, con sus cuatro conexiones. |
| **Inactive** | Creado, pero `cloudflared` no ha conectado nunca. |
| **Down** | Estuvo conectado y el proceso se ha parado. |
| **Degraded** | Sirve tráfico, pero alguna conexión ha fallado. |

En el servidor, que el servicio esté vivo:

```bash
sudo systemctl status cloudflared
```

Desde fuera, que la aplicación responda a través de Cloudflare:

```bash
curl -sI https://app.example.com | grep -iE "^HTTP|^server|^cf-ray"
# HTTP/2 200 (o 302 hacia el login de Access)
# server: cloudflare
# cf-ray: ...
```

Y lo más importante: que el servidor **no responda** directamente. Cierra los puertos del router y las reglas de entrada del cortafuegos que tuvieras. Ya no hacen falta.

Para ver qué pasa sin entrar en la máquina, usa la pestaña **Live logs** del túnel: registros de los conectores en tiempo real, con filtros.

### Los dos errores de siempre

**Error 1033.** Cloudflare sabe que ese nombre va a un túnel, pero **no hay ningún `cloudflared` sano** para recibir el tráfico. Mira el estado: si está *Inactive*, instala el conector; si está *Down*, arranca el servicio y revisa la máquina. Si el túnel está bien y sigue el 1033, comprueba que el CNAME apunta al UUID correcto.

**502 Bad Gateway.** El túnel está conectado, pero **`cloudflared` no llega a tu servicio**. Las causas habituales:

- El servicio no está arrancado (`connection refused` en los registros).
- Protocolo equivocado: pusiste `http://` y el servicio solo habla HTTPS, o al revés.
- Puerto equivocado en **Service URL**.
- Certificado del origen que `cloudflared` no acepta. `x509: certificate signed by unknown authority` indica una CA que no conoce. `certificate is valid for example.com, not localhost` se arregla con **Origin Server Name**.

Si `cloudflared` corre en Docker, `localhost` es el propio contenedor, no tu máquina. Usa el nombre del servicio en la red de Docker (`http://portainer:9000`).

## Límites y precios

| | Límite |
|---|---|
| Túneles por cuenta | 1.000 incluidos |
| Réplicas activas por túnel | 25 |
| Aplicaciones publicadas por túnel | Hasta 1 MB de configuración (unas 5.000–10.000) |
| Rutas privadas (CIDR y hostname) por cuenta | 50.000 |
| Redes virtuales por cuenta | 1.000 |
| Quick Tunnel | 200 peticiones en vuelo, sin SSE |

- Las aplicaciones publicadas **no cuentan** como rutas. El límite de 50.000 (1.000 hasta octubre de 2026) es solo para rutas privadas.
- Si necesitas más de 1.000 túneles (uno por cliente o por dispositivo), **Tunnels for Platforms** cuesta 4,50 $ por túnel adicional y mes. Se compra en la tarjeta **Usage** de **Networking › Tunnels**. Cuentan todos los túneles, también los inactivos: borra los que no uses.
- Si usas Access o la red privada, cada persona que entra ocupa una **plaza de Zero Trust**: el plan Free cubre hasta 50 usuarios ([parte 10](/blog/cloudflare-access-guia)).

## Documentación oficial

- [Cloudflare Tunnel: visión general](https://developers.cloudflare.com/tunnel/) y [primeros pasos](https://developers.cloudflare.com/tunnel/get-started/)
- [Crear un túnel desde el panel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) y [desde la API](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel-api/)
- [Enrutado, registros DNS y límites de aplicaciones publicadas](https://developers.cloudflare.com/tunnel/concepts/routing/)
- [Conectar una red privada por IP o CIDR](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/cloudflared/connect-cidr/) y [redes virtuales](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/cloudflared/tunnel-virtual-networks/)
- [Réplicas y disponibilidad](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/) y [tokens del túnel](https://developers.cloudflare.com/tunnel/reference/tunnel-tokens/)
- [Parámetros de origen, incluido Protect with Access](https://developers.cloudflare.com/tunnel/reference/origin-parameters/)
- [Cortafuegos y puertos](https://developers.cloudflare.com/tunnel/configuration/#firewall-rules) y [parámetros de ejecución](https://developers.cloudflare.com/tunnel/reference/run-parameters/)
- [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Terraform con Tunnel](https://developers.cloudflare.com/tunnel/guides/terraform/)
- [Solución de problemas](https://developers.cloudflare.com/cloudflare-one/troubleshooting/tunnel/), [orígenes HTTPS](https://developers.cloudflare.com/tunnel/troubleshooting/https-origins/) y [error 1033](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1033/)
- [Límites de la cuenta](https://developers.cloudflare.com/cloudflare-one/account-limits/#cloudflare-tunnel) y [Tunnels for Platforms](https://developers.cloudflare.com/tunnel/features/tunnels-for-platforms/)
- [Changelog de Tunnel](https://developers.cloudflare.com/changelog/product/tunnel/), con [Quick Tunnels con correo](https://developers.cloudflare.com/changelog/post/2026-10-02-protected-quick-tunnels/) y [50.000 rutas por cuenta](https://developers.cloudflare.com/changelog/post/2026-10-16-tunnels-for-platforms-and-50k-routes/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Gateway: filtrado DNS y HTTP para tu equipo.

## También te puede interesar

- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
- [SSL/TLS en Cloudflare: certificados de borde, Origin CA y modos de cifrado](/blog/cloudflare-ssl-tls-guia)
- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
