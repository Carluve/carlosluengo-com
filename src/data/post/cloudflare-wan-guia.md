---
publishDate: 2026-10-20T09:00:00Z
draft: false
image: 'media:blog/cloudflare-wan-guia/portada.png'
title: 'Cloudflare WAN y Network Firewall: tus sedes unidas por la red de Cloudflare'
excerpt: 'Serie Cloudflare, parte 42. Qué son Cloudflare WAN (antes Magic WAN) y Cloudflare Network Firewall (antes Magic Firewall), cómo se conectan las sedes con túneles IPsec o GRE, cómo se enruta entre ellas y cómo se filtra el tráfico en el borde. Todo es Enterprise, así que va con diagramas y código.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'cloudflare wan'
  - 'network firewall'
  - 'redes'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 42 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Con [Tunnel](/blog/cloudflare-tunnel-guia) publicas una aplicación sin abrir puertos y con [WARP](/blog/cloudflare-warp-guia) conectas a cada persona. Pero una empresa con oficinas, tiendas o un centro de datos necesita unir **redes enteras**. Eso hace Cloudflare WAN. Cloudflare Network Firewall filtra lo que circula por ella.

## Qué es

**Cloudflare WAN** (antes Magic WAN) es una WAN como servicio. Cada sede se conecta al centro de datos de Cloudflare más cercano y la red de Cloudflare hace de troncal entre todas. Sustituye a los circuitos MPLS y al modelo en estrella, en el que todo pasa por la sede central.

Las sedes entran por varias vías (*on-ramps*):

- **Túneles IPsec o GRE** desde tu router o cortafuegos. Hay guías para Cisco, Fortinet, Palo Alto, pfSense, Juniper, SonicWall y otros.
- **Cloudflare One Appliance** (antes Magic WAN Connector), en hardware o como máquina virtual. Monta los túneles por ti y se gestiona desde el panel. Es el método que Cloudflare prefiere.
- **Cloudflare Network Interconnect (CNI)**, una conexión directa sin pasar por Internet.
- **Nubes**: IPsec contra la VPN de AWS, Azure, Google Cloud, Oracle o Alibaba.

**Cloudflare Network Firewall** (antes Magic Firewall) es un cortafuegos como servicio de capas 3 y 4. Filtra por protocolo, puerto, IP, longitud del paquete y campos de bits, con el mismo lenguaje de reglas que el [WAF](/blog/cloudflare-waf-guia). Viene incluido con WAN. La versión **Advanced** añade listas de IPs y de amenazas, bloqueo por país y ASN, capturas de paquetes, validación de protocolo e **IDS**.

**Planes.** Todo lo de este post es **solo Enterprise**. WAN se contrata con el equipo comercial y Network Firewall llega con WAN o con Magic Transit.

## Casos de uso

- **Dejar el MPLS.** Cada oficina usa su acceso a Internet y el tráfico entre sedes viaja por la red de Cloudflare.
- **Tiendas sin informático.** Un Appliance en cada local, configurado en remoto.
- **Unir oficina y nube.** La VPC de AWS es una sede más, con su túnel y sus rutas.
- **Un cortafuegos para todas las sedes.** Las reglas se escriben una vez y se aplican en todos los centros de datos de Cloudflare.
- **Base para SASE.** Con el tráfico ya dentro, añades [Gateway](/blog/cloudflare-gateway-guia) para salir a Internet y [Access](/blog/cloudflare-access-guia) para las aplicaciones internas.

## Arquitectura

![Arquitectura de Cloudflare WAN: tres sedes (oficina con router propio por IPsec, tienda con Cloudflare One Appliance y VPC en la nube por IPsec) llegan a la IP anycast de Cloudflare; dentro, el tráfico pasa por la protección DDoS, Network Firewall (reglas propias, gestionadas e IDS) y la tabla de rutas, y sale hacia otra sede o hacia Internet a través de Gateway; abajo, tabla comparativa de GRE, IPsec, Appliance y CNI](media:blog/cloudflare-wan-guia/00-arquitectura.png)

1. **Anycast.** Cloudflare asigna a tu cuenta una IP anycast como extremo de los túneles. La anuncian todos sus centros de datos, así que el túnel no depende de un servidor concreto. En IPsec, un servidor negocia la sesión IKEv2 y reparte las claves al resto.
2. **El paquete entra por el centro de datos más cercano.** Pasa primero la mitigación DDoS y luego **Network Firewall**: tus reglas y después las gestionadas. La primera que coincide decide. Sin reglas, todo pasa.
3. **La tabla de rutas** de tu red virtual elige el siguiente salto. Gana la ruta más específica. A igual prefijo, la de menor número de prioridad. A igual prioridad, ECMP reparte entre túneles.
4. **Sale por el túnel de destino.** Si la IP es pública, va a Internet. Si es privada y no hay ruta, se descarta.

Cada centro de datos envía sondas ICMP (*health checks*) por los túneles. Si uno se degrada, Cloudflare le baja la prioridad y el tráfico pasa al otro. Por eso se recomiendan **dos túneles desde routers distintos** por sede.

**Unified Routing** es el modo de enrutamiento recomendado desde el 18 de septiembre de 2026. Une en una tabla las rutas de WAN, Tunnel, Mesh y WARP, y es requisito para BGP sobre IPsec y GRE, disponible en general desde el 5 de octubre de 2026. En este modo, el IDS y varias funciones Advanced siguen en beta, y el rate limiting de Network Firewall no está disponible.

## Implementación paso a paso

WAN no se puede activar en una cuenta Free, así que no hay capturas de un túnel funcionando. Las dos capturas muestran pantallas de cuenta que ve cualquiera.

El ejemplo: Madrid (`10.10.0.0/16`) y Barcelona (`10.20.0.0/16`), cada una con un router IPsec.

### 1. Elige el conector

En **Networking › Connectors** conviven Tunnel, Mesh, los túneles IPsec/GRE y los Appliances. El criterio de Cloudflare: Mesh para acceso privado, Tunnel para publicar aplicaciones, WAN para **sedes enteras**.

### 2. Crea los túneles

Reúne tres datos por túnel:

- **Cloudflare endpoint**: tu IP anycast, en **Address Space › Leased IPs**.
- **Customer endpoint**: la IP pública del router. En IPsec solo hace falta si el router usa un IKE ID `ID_IPV4_ADDR`.
- **Interface address**: una `/31` (recomendada) o `/30` privada, de RFC 1918 o de `169.254.240.0/20`.

En **IPsec/GRE tunnels › Create a tunnel** eliges el tipo. **GRE** no cifra ni autentica: resérvalo para redes de confianza o CNI. **IPsec** cifra con una clave precompartida (PSK) y solo admite **IKEv2**. En la fase 1, Cloudflare recomienda el intercambio híbrido poscuántico **ML-KEM-768 + DH 20**, o DH 20 si tu equipo no lo soporta. En la fase 2, PFS con DH 20 y una vida de entre 30 minutos y 8 horas.

**Replay protection** viene desactivado. Actívalo solo en equipos que no permiten quitarlo, como Meraki, VeloCloud o la VPN de AWS. Guarda la PSK en un gestor de secretos.

### 3. Ajusta el MSS

El encapsulado añade cabeceras. En la interfaz interna del túnel, fija el **MSS en 1.360 bytes para IPsec** y **1.436 para GRE**. Si no, las conexiones TCP se cuelgan con paquetes grandes.

### 4. Crea las rutas

En **Networking › Routes › Create route**, tipo **WAN**: prefijo, túnel, prioridad (menor número, más preferida) y, opcionalmente, peso ECMP (hasta 256) y región. **Test routes** comprueba la ruta antes de guardarla.

Con dos túneles, crea la misma ruta hacia cada uno. Con igual prioridad, reparten el tráfico. Con distinta, uno queda de respaldo. Si tus redes cambian a menudo, activa **Allow BGP peering**. Las rutas BGP entran con prioridad 100. A igualdad, gana la estática. Solo se admiten prefijos RFC 1918; el resto, bajo petición.

### 5. Escribe las reglas del cortafuegos

Ve a **Networking › Firewall policies › Add a policy**. Una regla bloquea (**Block**) o permite (**Skip**). Se evalúan en orden y manda la primera que coincide. El máximo por defecto es de **200** políticas.

- **No bloquees todo el ICMP.** Los health checks llegan desde IPs de Cloudflare. Permítelos antes, o los túneles parecerán caídos.
- **Reglas gestionadas, primero en Log.** Están en **Managed Rulesets** y casi todas vienen desactivadas. Actívalas en modo registro, revisa los resultados y pásalas a bloqueo. Así lo propuso Cloudflare con la regla contra CVE-2026-98432 del 4 de noviembre de 2026.
- **El IDS solo detecta.** Se activa en la pestaña **IDS** y sus hallazgos llegan por **Logpush**. Sin destino configurado no verás nada.

## Lo mismo, como código

Con Terraform (proveedor v5): un túnel IPsec y su ruta. La PSK entra como variable sensible. El proveedor la guarda en el estado, así que protege el backend.

```hcl
variable "account_id" { type = string }
variable "cf_anycast_ip" { type = string } # Address Space › Leased IPs
variable "router_mad_ip" { type = string } # IP pública del router de Madrid

variable "psk_mad" {
  type      = string
  sensitive = true # pásala con TF_VAR_psk_mad desde tu gestor de secretos
  validation {
    condition     = length(var.psk_mad) >= 32
    error_message = "Usa una PSK aleatoria de 32 caracteres o más."
  }
}

resource "cloudflare_magic_wan_ipsec_tunnel" "madrid_1" {
  account_id          = var.account_id
  name                = "madrid_1"
  cloudflare_endpoint = var.cf_anycast_ip
  customer_endpoint   = var.router_mad_ip
  interface_address   = "10.252.0.0/31" # .0 lado Cloudflare, .1 lado router
  psk                 = var.psk_mad
  replay_protection   = false
  health_check = {
    enabled   = true
    rate      = "mid"
    type      = "reply"
    direction = "bidirectional"
  }
}

resource "cloudflare_magic_wan_static_route" "madrid" {
  account_id  = var.account_id
  description = "Oficina de Madrid por madrid_1"
  prefix      = "10.10.0.0/16"
  nexthop     = "10.252.0.1" # lado del router en la /31
  priority    = 100
}
```

El cortafuegos es un `cloudflare_ruleset` de cuenta, `root`, en la fase `magic_transit`:

```hcl
resource "cloudflare_ruleset" "network_firewall" {
  account_id = var.account_id
  name       = "Network Firewall"
  kind       = "root"
  phase      = "magic_transit"
  rules = [
    {
      ref               = "https_bcn_a_intranet"
      description       = "Barcelona llega a la intranet de Madrid por HTTPS"
      expression        = "ip.src in {10.20.0.0/16} and ip.dst in {10.10.5.0/24} and tcp.dstport in {443}"
      action            = "skip"
      action_parameters = { ruleset = "current" }
    },
    {
      ref         = "sin_rdp_smb_entre_sedes"
      description = "Sin RDP ni SMB de Barcelona a Madrid"
      expression  = "ip.src in {10.20.0.0/16} and ip.dst in {10.10.0.0/16} and tcp.dstport in {445 3389}"
      action      = "block"
    }
  ]
}
```

Para túneles y rutas, el token necesita **Magic WAN Write**. Como en el WAF, Terraform asume que controla **todas** las reglas de la fase: importa antes las que crearas en el panel. En la API, `POST /accounts/{account_id}/rulesets` puede sobrescribir políticas existentes. Para añadir una regla suelta, usa `POST /accounts/{account_id}/rulesets/{ruleset_id}/rules`.

## Cómo comprobarlo

**Network health › Connector health** muestra cada túnel medido desde cada centro de datos. **Up** significa más del 80 % de health checks correctos; **Degraded**, más del 40 %. Que algunos centros fallen es normal: mira los que tienen tráfico en **Traffic volume (1 hour)**. Para más de una hora de historial, usa la API de GraphQL.

Desde un equipo de Barcelona:

```bash
ping -c 3 10.10.5.10                                         # hay ruta y pasa ICMP
curl -s -o /dev/null -w "%{http_code}\n" https://intranet.mad.example/  # 443 permitido
nc -vz -w 3 10.10.5.10 3389                                  # debe fallar: RDP bloqueado
```

Si `traceroute` solo devuelve asteriscos, revisa que el túnel del router no herede el TTL del paquete interior. En Linux es el comportamiento por defecto.

## Límites y precios

| | Valor |
|---|---|
| Disponibilidad | Solo Enterprise |
| Políticas de Network Firewall | 200 por defecto, ampliable |
| Acciones en reglas propias | Block y Skip |
| IKE | Solo IKEv2; Cloudflare siempre responde, nunca inicia |
| Interface address | `/31` o `/30` de RFC 1918 o `169.254.240.0/20` |
| Prefijos en rutas | RFC 1918; el resto, bajo petición |
| Peso ECMP | Hasta 256 |
| MSS | 1.360 (IPsec) / 1.436 (GRE) |

- **Network Firewall estándar** (incluido): reglas por protocolo, puerto, IP, longitud y bits, cambios propagados en menos de un minuto, API, Terraform y analítica por regla.
- **Advanced** (de pago): listas, país, ASN, capturas de paquetes, validación de protocolo, filtrado con Gateway e IDS.
- Cloudflare no publica precios: van por contrato.

## Documentación oficial

- [Cloudflare WAN](https://developers.cloudflare.com/cloudflare-wan/) y [primeros pasos](https://developers.cloudflare.com/cloudflare-wan/get-started/)
- [Configurar túneles](https://developers.cloudflare.com/cloudflare-wan/configuration/how-to/configure-tunnel-endpoints/) y [parámetros de GRE e IPsec](https://developers.cloudflare.com/cloudflare-wan/reference/gre-ipsec-tunnels/)
- [Rutas](https://developers.cloudflare.com/cloudflare-wan/configuration/how-to/configure-routes/) y [traffic steering y Unified Routing](https://developers.cloudflare.com/cloudflare-wan/reference/traffic-steering/)
- [Cloudflare One Appliance](https://developers.cloudflare.com/cloudflare-wan/configuration/appliance/) y [equipos de terceros](https://developers.cloudflare.com/cloudflare-wan/configuration/third-party/)
- [MTU y MSS](https://developers.cloudflare.com/cloudflare-wan/reference/mtu-mss/), [health checks](https://developers.cloudflare.com/cloudflare-wan/reference/tunnel-health-checks/) y [salud de los túneles](https://developers.cloudflare.com/cloudflare-wan/configuration/common-settings/check-tunnel-health-dashboard/)
- [Network Firewall](https://developers.cloudflare.com/cloudflare-network-firewall/), [planes](https://developers.cloudflare.com/cloudflare-network-firewall/plans/), [lógica de las reglas](https://developers.cloudflare.com/cloudflare-network-firewall/about/ruleset-logic/), [reglas gestionadas](https://developers.cloudflare.com/cloudflare-network-firewall/how-to/enable-managed-rulesets/) e [IDS](https://developers.cloudflare.com/cloudflare-network-firewall/how-to/enable-ids/)
- Changelog: [WAN](https://developers.cloudflare.com/cloudflare-wan/changelog/), [Network Firewall](https://developers.cloudflare.com/cloudflare-network-firewall/changelog/) y [BGP sobre IPsec y GRE (5-oct-2026)](https://developers.cloudflare.com/changelog/post/2026-10-05-bgp-over-tunnels-ga/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Workers AI: modelos en las GPU de Cloudflare.

## También te puede interesar

- [Cloudflare Tunnel: publicar un servicio sin abrir puertos](/blog/cloudflare-tunnel-guia)
- [Gateway: filtrado DNS y HTTP para tu equipo](/blog/cloudflare-gateway-guia)
- [Protección DDoS en Cloudflare: qué está protegido de serie y cómo ajustarlo](/blog/cloudflare-ddos-guia)
