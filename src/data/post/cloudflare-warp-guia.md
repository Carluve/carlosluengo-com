---
publishDate: 2026-03-31T09:00:00Z
draft: false
image: 'media:blog/cloudflare-warp-guia/portada.png'
title: 'WARP: el cliente de Zero Trust y la postura del dispositivo'
excerpt: 'Serie Cloudflare, parte 13. Qué es el Cloudflare One Client (antes WARP) y en qué se diferencia de la app 1.1.1.1, cómo inscribir dispositivos en tu organización, perfiles, modos de servicio, Split Tunnels y cómo exigir un disco cifrado o una versión mínima del sistema en tus políticas de Access y Gateway.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'zero trust'
  - 'warp'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 13 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Con [Access](/blog/cloudflare-access-guia) ya sabes **quién** entra en una aplicación. Falta saber **desde qué** entra. No es lo mismo tu portátil, cifrado y actualizado, que el ordenador de un cibercafé. Para saberlo hace falta un programa en el dispositivo: WARP, que ahora se llama **Cloudflare One Client**.

## Qué es

El Cloudflare One Client es una aplicación para Windows, macOS, Linux, iOS, Android y ChromeOS que conecta el dispositivo con tu organización de Zero Trust. Hace dos cosas:

- **Envía el tráfico a Cloudflare.** Crea un túnel cifrado (WireGuard o MASQUE) y un proxy DNS cifrado. Las políticas de Gateway te siguen estés donde estés.
- **Informa del estado del dispositivo.** Versión del sistema, cifrado de disco, cortafuegos, ficheros o aplicaciones instaladas… Es lo que Cloudflare llama **postura del dispositivo** (*device posture*), y puedes exigirla en las políticas de Access y Gateway.

**No lo confundas con la app 1.1.1.1.** El WARP de consumo (la app 1.1.1.1, o el cliente sin inscribir en ninguna organización) cifra tu conexión y usa el resolvedor 1.1.1.1, pero no aplica políticas. En el ordenador, la versión de empresa es la misma aplicación inscrita en tu organización; en el móvil es una app aparte, **Cloudflare One Agent**. En la documentación, la de consumo está en *WARP client* y la de empresa, en *Cloudflare One Client*.

Tres piezas que conviene separar:

- **Permisos de inscripción.** Quién puede unir un dispositivo a tu organización.
- **Perfiles de dispositivo.** Qué configuración recibe cada dispositivo: modo, Split Tunnels, si el usuario puede desconectarlo…
- **Comprobaciones de postura.** Qué condiciones debe cumplir el dispositivo para pasar una política.

**Plan.** Todo lo de este post funciona en Zero Trust Free, que cubre hasta 50 usuarios. Los asientos van **por usuario, no por dispositivo**: una persona con portátil y móvil ocupa un asiento. Lo único exclusivo de Enterprise es exigir un certificado mTLS al inscribir el dispositivo.

## Casos de uso

- **Exigir un dispositivo sano para entrar.** El panel interno solo abre si el disco está cifrado y el sistema está al día.
- **Filtrar la navegación fuera de la oficina.** Las políticas DNS y HTTP de Gateway siguen al portátil, no a la red.
- **Sustituir la VPN.** El cliente lleva el tráfico hasta tus redes privadas publicadas con Cloudflare Tunnel, sin abrir puertos.
- **Convivir con otra VPN o con tu filtro DNS.** Con Split Tunnels y el modo adecuado, el cliente solo toca lo que le pides.

## Arquitectura

![Esquema del Cloudflare One Client: el dispositivo con su perfil y sus comprobaciones de postura envía DNS y tráfico cifrados a la red de Cloudflare, donde Gateway filtra hacia internet y Access decide la entrada a las aplicaciones privadas; abajo, tabla de los cinco modos de servicio con lo que filtra cada uno](media:blog/cloudflare-warp-guia/00-arquitectura.png)

1. La persona instala el cliente, escribe el **nombre de equipo** y se identifica en tu proveedor de identidad. Si una política de **inscripción** la deja, el dispositivo queda registrado.
2. El cliente recibe un **perfil**. Los perfiles se evalúan de arriba abajo y gana el primero que coincide. El perfil **Default** siempre está el último.
3. Según el **modo de servicio** del perfil, el cliente manda a Cloudflare el DNS, el tráfico o ambos. Lo que esté excluido en **Split Tunnels** sale directamente por la red local.
4. Cada cinco minutos (por defecto), el cliente revisa la **postura** del dispositivo y envía el resultado.
5. **Access** y **Gateway** usan ese resultado en sus políticas.

Los modos de servicio:

| Modo | DNS | Red | HTTP | Postura | Para qué |
|---|---|---|---|---|---|
| **Traffic and DNS** (por defecto) | ✓ | ✓ | ✓ | ✓ | Cobertura completa |
| **DNS only** | ✓ | — | — | — | Solo filtrado DNS |
| **Traffic only** | — | ✓ | ✓ | ✓ | Mantener tu filtro DNS actual |
| **Local proxy** | — | — | ✓ | — | Solo las apps que apunten al proxy local |
| **Posture only** | — | — | — | ✓ | Solo postura, sin tocar el tráfico |

Algunos matices:

- **Traffic only** y **Local proxy** solo existen en Windows, macOS y Linux. El proxy local escucha en `127.0.0.1`, por defecto en el puerto `40000`.
- En **DNS only** no hay comprobaciones de postura: el cliente no las envía en ese modo.
- **Posture only** sirve para aplicaciones *self-hosted* de Access. Se apoya en un certificado de cliente que el propio cliente instala en el dispositivo, y requiere activar antes la emisión de certificados en la zona por API.

## Implementación paso a paso

Las capturas son de la cuenta de `carluve.dev`, con Zero Trust en plan **Free**: formularios y ajustes, nunca listas de dispositivos ni de usuarios. En el texto, la organización es `tuequipo` y el dominio, `example.com`. Doy por hecho que ya tienes una organización de Zero Trust, como vimos en [Access](/blog/cloudflare-access-guia).

### 1. Decide quién puede inscribir dispositivos

En **Zero Trust › Team & Resources › Devices › Device profiles › Management**, sección **Device enrollment › Device enrollment permissions › Manage**.

- En **Policies**, añade una política de Access. Por ejemplo, **Include › Emails ending in** `@example.com`.
- En **Login methods**, marca los proveedores de identidad que aceptas. Si solo hay uno, **Apply instant authentication** lleva directamente a su login.

Dos detalles:

- Las comprobaciones de postura **no** funcionan en la política de inscripción. El cliente solo puede comprobar la postura después de inscribirse.
- Para dispositivos sin persona detrás (un servidor Linux, un quiosco), usa un **service token** con una política *Service Auth*. Esos dispositivos aparecen con el correo `non_identity@tuequipo.cloudflareaccess.com` y no ocupan asiento.


### 2. Inscribe tu primer dispositivo

Descarga el cliente desde la página oficial de descargas e instálalo.

- **Windows, macOS y Linux (interfaz gráfica).** Al abrirlo, en **What would you like to use the Cloudflare One Client for?** elige **Zero Trust security**, escribe el nombre de equipo e inicia sesión.
- **Linux o terminal.** Como usuario normal, no como root:

```bash
warp-cli registration new tuequipo
# se abre el navegador para iniciar sesión
warp-cli registration show
```

Que `registration new` diga que todo fue bien no garantiza la inscripción. Compruébala con `registration show`.

- **iOS, Android y ChromeOS.** Instala **Cloudflare One Agent**, acepta la política de privacidad, escribe el nombre de equipo, inicia sesión y acepta instalar el perfil de VPN. Para no teclear el nombre de equipo, puedes repartir este enlace (o un código QR con él):

```txt
cf1app://oneapp.cloudflare.com/team?name=tuequipo
```

Si vas a inspeccionar HTTPS, el dispositivo tiene que confiar en el **certificado raíz de Cloudflare**. El ajuste **Install CA to system certificate store** hace que el cliente lo instale solo.

### 3. Ajusta el perfil

En **Zero Trust › Team & Resources › Devices › Device profiles › General profiles**. Puedes editar el **Default** o crear uno nuevo con **Create new profile**, que empieza como copia del Default.

Un perfil tiene:

- **Reglas de asignación.** Por correo, grupo del proveedor de identidad, sistema operativo, versión del sistema, red gestionada o service token. Por ejemplo, un perfil solo para `os.name == "linux"`.
- **Service mode.** Uno de los cinco modos de la tabla.
- **Controles de usuario.** Los más útiles:
  - **Lock device client switch**: el usuario no puede desconectar el cliente.
  - **Auto connect**: si lo desconecta, se reconecta solo tras los minutos que digas (de 1 a 1.440; con 0, nunca). Basta un valor bajo, lo justo para el wifi de un hotel.
  - **Allow device to leave organization**: permite salir de la organización. Desactívalo si no lo quieres.
  - **Captive portal detection**: desconecta un rato ante un portal cautivo para que aceptes las condiciones del wifi.
- **Device tunnel protocol.** WireGuard o MASQUE. MASQUE va sobre HTTP/3 y usa un cifrado compatible con FIPS 140-3.

Los cambios tardan **hasta 10 minutos** en llegar. Cambiar el modo, Split Tunnels o Local Domain Fallback reinicia la conexión: puede haber un corte breve.


### 4. Split Tunnels: qué entra en el túnel

Dentro del perfil, en **Split Tunnels**. Hay dos modos:

- **Exclude IPs and domains** (por defecto). Todo va por Cloudflare menos lo que excluyas. Ya vienen excluidos los rangos privados y locales (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, enlace local, multicast…), para que sigas viendo la impresora y el router.
- **Include IPs and domains.** Solo va por Cloudflare lo que incluyas. Incluye también tu proveedor de identidad, `tuequipo.cloudflareaccess.com` y las aplicaciones protegidas, o fallarán la postura y las sesiones.

Pautas:

- **Prefiere IP antes que dominios.** Un dominio en un CDN comparte IP con muchos otros: excluirlo puede abrir más de lo que crees. En el móvil, además, los dominios solo se resuelven al arrancar el túnel.
- **No uses Split Tunnels para arreglar una web que va mal.** Lo excluido desaparece de los registros de Gateway.
- **Al cambiar de modo, la lista vuelve a la de por defecto.** Copia tus entradas antes.
- Split Tunnels solo afecta al tráfico IP. El DNS de esos dominios sigue pasando por Gateway salvo que lo añadas a **Local Domain Fallback**.


### 5. Crea comprobaciones de postura

En **Zero Trust › Reusable components › Posture checks › Cloudflare One Client checks › Add a check**. Dos ejemplos para empezar:

- **OS version.** Sistema operativo, operador y versión. La versión va en formato SemVer: si tu sistema es la `15.2`, escribe `15.2.0`. En Windows puedes exigir además un número de UBR (la cuarta parte de la versión) para comprobar parches.
- **Disk encryption.** Todos los volúmenes o uno concreto. En macOS mira FileVault y en Windows, BitLocker. En iOS, Android y ChromeOS no existe porque esos sistemas siempre cifran.

Qué comprobaciones hay en cada sistema:

| Comprobación | macOS | Windows | Linux | iOS | Android / ChromeOS |
|---|---|---|---|---|---|
| OS version | ✓ | ✓ | ✓ | ✓ | ✓ |
| Disk encryption | ✓ | ✓ | ✓ | — | — |
| Firewall | ✓ | ✓ | — | — | — |
| File check y Application check | ✓ | ✓ | ✓ | — | — |
| Device serial numbers | ✓ | ✓ | ✓ | — | — |
| Client certificate | ✓ | ✓ | ✓ | — | — |
| Antivirus y Domain joined | — | ✓ | — | — | — |
| Require WARP y Require Gateway | ✓ | ✓ | ✓ | ✓ | ✓ |

Hay más: integraciones con SentinelOne, Carbon Black o Tanium, y comprobaciones de terceros (Intune, CrowdStrike, Kolide…) que consulta Cloudflare directamente.

Antes de usarla en una política, mira si da el resultado esperado en **Team & Resources › Devices › View details › Posture checks** (lo vemos en «Cómo comprobarlo»).

![Add device posture attribute: tipos de comprobación disponibles, entre ellos OS Version, Disk Encryption, Firewall, Antivirus, Application Check y File Check, además de integraciones como SentinelOne o Tanium](media:blog/cloudflare-warp-guia/04-postura.png)

### 6. Úsalas en Access y en Gateway

**En Access**, edita la política de tu aplicación (**Access controls › Policies**) y añade una regla **Require › Device posture**. Así la persona debe cumplir la identidad **y** la postura. Si combinas varias comprobaciones, crea un grupo de reglas («Dispositivo corporativo») y reutilízalo.


**En Gateway**, las políticas de red y HTTP tienen el selector **Passed Device Posture Checks**: por ejemplo, para bloquear una aplicación interna a quien no lo pase.

Ten en cuenta los tiempos:

- El cliente revisa la postura cada **5 minutos** por defecto (se cambia por API con `schedule`; el mínimo es 1 minuto).
- **Access** ve los cambios a ese ritmo. **Gateway** tiene una caché de 5 minutos, que se suma.
- Gateway evalúa la postura **al empezar la sesión**. Una sesión SSH abierta no se corta aunque la postura falle después.

### Despliegue con MDM

Para una flota, usa tu gestor de dispositivos (Intune, Jamf, Kandji, JumpCloud…):

- **Windows**: el instalador `.msi` acepta propiedades como `ORGANIZATION`, `SERVICE_MODE` o `SWITCH_LOCKED`:

```bash
msiexec /i "Cloudflare_WARP_<VERSION>.msi" /qn ORGANIZATION="tuequipo"
```

- **macOS**: un fichero `com.cloudflare.warp.plist` en `/Library/Managed Preferences`, normalmente dentro de un `.mobileconfig`.
- **Sin persona que inicie sesión**: añade `auth_client_id` y `auth_client_secret` de un service token.

Los parámetros del fichero MDM **mandan sobre el panel**. Cloudflare recomienda poner solo `organization` y gestionar el resto en los perfiles. Si no, cambiarás un ajuste en el panel y no pasará nada.

### Lo mismo, como código

Con el proveedor de Terraform (v5). Un perfil para portátiles Linux, en modo Traffic and DNS, con una exclusión propia:

```hcl
resource "cloudflare_zero_trust_device_custom_profile" "linux" {
  account_id      = var.account_id
  name            = "Portátiles Linux"
  enabled         = true
  precedence      = 101
  match           = "os.name == \"linux\""
  service_mode_v2 = { mode = "warp" }
  switch_locked   = true
  auto_connect    = 10
  exclude = [{
    address     = "192.168.0.0/16"
    description = "Red local"
  }]
}
```

`exclude` e `include` no pueden ir juntos en un perfil. Además, `exclude` es la lista completa: declara en un `locals` los rangos por defecto de Cloudflare y concaténalos con los tuyos, como recomienda la documentación.

Las comprobaciones de postura y la política de Access que las exige:

```hcl
resource "cloudflare_zero_trust_device_posture_rule" "macos_reciente" {
  account_id = var.account_id
  name       = "macOS 15 o superior"
  type       = "os_version"
  match      = [{ platform = "mac" }]
  input = {
    operating_system = "mac"
    operator         = ">="
    version          = "15.0.0"
  }
}

resource "cloudflare_zero_trust_device_posture_rule" "disco_cifrado" {
  account_id = var.account_id
  name       = "Disco cifrado (macOS)"
  type       = "disk_encryption"
  match      = [{ platform = "mac" }]
  input      = { require_all = true }
}

resource "cloudflare_zero_trust_access_policy" "equipo_dispositivo_sano" {
  account_id = var.account_id
  name       = "Equipo con dispositivo sano"
  decision   = "allow"
  include = [{
    email_domain = { domain = "@example.com" }
  }]
  require = [
    { device_posture = { integration_uid = cloudflare_zero_trust_device_posture_rule.macos_reciente.id } },
    { device_posture = { integration_uid = cloudflare_zero_trust_device_posture_rule.disco_cifrado.id } },
  ]
}
```

El token necesita *Zero Trust Write* para perfiles y postura, y *Access: Apps and Policies Write* para la política. Por API, los perfiles se crean con `POST /accounts/{account_id}/devices/policy`. En una política de Gateway, la condición de postura se escribe así:

```txt
any(device_posture.checks.passed[*] in {"<UUID_DE_LA_COMPROBACION>"})
```

## Cómo comprobarlo

En el dispositivo:

```bash
warp-cli registration show   # ¿está inscrito y en qué organización?
warp-cli settings            # perfil aplicado (Profile ID) y modo
curl -s https://www.cloudflare.com/cdn-cgi/trace | grep warp
# warp=on
```

Con Split Tunnels en modo Include, `warp=off` es normal para destinos fuera de la lista: prueba con uno incluido. En DNS only no hay túnel; basta con `registration show`.

En el panel, **Team & Resources › Devices › View details** muestra el **último perfil activo** de cada dispositivo y, en la pestaña **Posture checks**, el resultado de cada comprobación. El histórico está en **Insights › Logs › Posture logs**.

Para diagnosticar, `warp-diag` reúne registros y configuración en un fichero que puedes adjuntar a una incidencia.

## Límites y precios

| | Límite |
|---|---|
| Caracteres por expresión de perfil | 10.000 |
| Entradas de Split Tunnels + Local Domain Fallback por perfil | 1.000 |
| Perfiles de IP de dispositivo por cuenta | 30 |
| Propagación de cambios de perfil | hasta 10 minutos |
| Revisión de postura por defecto | cada 5 minutos (mínimo 1) |
| Retraso extra de Gateway con la postura | hasta 5 minutos |
| Certificado mTLS en la inscripción | Solo Enterprise |

- Son los límites por defecto. En Enterprise se pueden ampliar.
- **Mantén las listas cortas.** Cada entrada de Split Tunnels tarda en procesarse, y los dominios más que las IP.
- **Conflictos conocidos.** Algunas VPN (Ivanti Secure Access, por ejemplo) bloquean el proxy DNS local del cliente. Desactiva el DNS de la otra VPN o usa Traffic only.

## Documentación oficial

- [Cloudflare One Client: visión general](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/) y [primera configuración](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/set-up/)
- [WARP de consumo (app 1.1.1.1)](https://developers.cloudflare.com/warp-client/)
- [Permisos de inscripción](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/deployment/device-enrollment/) e [inscripción manual](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/deployment/manual-deployment/)
- [Modos del cliente](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/modes/) y [Posture only mode](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/modes/device-information-only/)
- [Perfiles de dispositivo](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/device-profiles/) y [ajustes del cliente](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/settings/)
- [Split Tunnels](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/configure/route-traffic/split-tunnels/)
- [Comprobaciones de postura](https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/) y [comprobaciones del cliente por sistema](https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/client-checks/)
- [Despliegue con MDM](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/deployment/mdm-deployment/) y [parámetros](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/deployment/mdm-deployment/parameters/)
- [Límites de la cuenta](https://developers.cloudflare.com/cloudflare-one/account-limits/)
- [Changelog del Cloudflare One Client](https://developers.cloudflare.com/cloudflare-one/changelog/cloudflare-one-client/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Workers: de hola mundo a producción.

## También te puede interesar

- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
