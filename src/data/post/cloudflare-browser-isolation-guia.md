---
publishDate: 2026-09-22T09:00:00Z
draft: false
image: 'media:blog/cloudflare-browser-isolation-guia/portada.png'
title: 'Browser Isolation: navegación aislada'
excerpt: 'Serie Cloudflare, parte 38. Qué es Browser Isolation, cómo dibuja la web en tu navegador sin ejecutar su código (Network Vector Rendering), cuándo usarlo con el cliente Cloudflare One y cuándo sin cliente, cómo escribir una política Isolate, cómo bloquear copiar, pegar, descargar o imprimir, cómo aislar una aplicación de Access y qué planes lo incluyen.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'zero trust'
  - 'browser isolation'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 38 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Con [Gateway](/blog/cloudflare-gateway-guia) bloqueas o permites webs. Pero hay una zona gris: dominios recién registrados, o una IA que quieres permitir sin que nadie pegue en ella datos de clientes. Browser Isolation es la tercera opción.

## Qué es

Browser Isolation abre la web en un **navegador remoto** que corre en la red de Cloudflare. El JavaScript y cualquier otro código activo se ejecutan allí, no en tu ordenador. A tu navegador solo llega lo necesario para dibujar la página.

Protege de dos cosas:

- **Malware y ataques de día cero.** Si una web aprovecha un fallo del navegador, lo hace en el remoto, no en el tuyo.
- **Fuga de datos.** Puedes impedir copiar, pegar, descargar, subir, escribir o imprimir en una web aislada.

El usuario sigue con su navegador de siempre. Al cerrar el navegador remoto, la sesión se borra.

**Planes.** Es un **complemento de pago** para Zero Trust **Pay-as-you-go** y **Enterprise**. No viene en Zero Trust Free.

## Casos de uso

- **Webs de riesgo sin bloquearlas.** Riesgos de seguridad, dominios nuevos o contenido sin categoría.
- **Medios con publicidad.** Contra el *malvertising*: un anuncio malicioso no ejecuta nada en tu equipo.
- **IA generativa con control.** Usar ChatGPT sin pegar desde el portapapeles local ni subir ficheros.
- **Contratistas.** Una aplicación interna en modo lectura, sin descargas al portátil personal.

## Arquitectura

![Flujo de Browser Isolation: el navegador del usuario llega por el cliente Cloudflare One, por la URL sin cliente o por una aplicación de Access; Gateway evalúa la política HTTP Isolate; el navegador remoto en el borde de Cloudflare ejecuta la web y devuelve solo instrucciones de dibujo (NVR); debajo, tabla con los controles de copiar, pegar, descargas, subidas, teclado e imprimir](media:blog/cloudflare-browser-isolation-guia/00-arquitectura.png)

1. El tráfico llega a Cloudflare por una **vía de entrada** (*on-ramp*).
2. **Gateway** evalúa tus políticas HTTP. Si coincide una con la acción **Isolate**, la página la abre el navegador remoto.
3. El **navegador remoto** descarga la web y ejecuta su código en el borde.
4. A ti no te llega un vídeo ni la página original. Con **Network Vector Rendering (NVR)**, Cloudflare intercepta las órdenes de dibujo del navegador remoto, las comprime, las cifra y las manda a un cliente ligero en tu navegador, que las pinta.
5. Desde abril de 2026, **Canvas Remoting** hace lo mismo con las aplicaciones que dibujan con HTML5 Canvas (Google Sheets, Office web). Viene activado y solo cubre Canvas 2D: WebGL sigue llegando como mapa de bits.

Hay dos modos de entrada:

- **En línea.** El usuario navega con URLs normales y Gateway decide qué aislar: [cliente Cloudflare One](/blog/cloudflare-warp-guia), *proxy endpoints* con PAC o Cloudflare WAN. Con el cliente, las políticas pueden usar la identidad; con proxy por IP de origen o con WAN, no.
- **URL con prefijo (sin cliente).** El usuario abre `https://<tu-equipo>.cloudflareaccess.com/browser/https://www.example.com/`, se autentica con [Access](/blog/cloudflare-access-guia) y navega aislado sin instalar nada.

También puedes **aislar una aplicación de Access**: tras el login, se abre siempre en el navegador remoto.

Isolate solo se aplica a peticiones de páginas (`Accept: text/html*`); las llamadas a APIs pasan sin aislar. Y para aislar webs HTTPS, Gateway necesita la **inspección TLS** activada y el certificado raíz de Cloudflare en el dispositivo.

## Implementación paso a paso

Todo se configura a nivel de **cuenta**, en Cloudflare One, sin depender de ninguna zona. La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Prepara Gateway

Si vas a usar el modo en línea, sigue la [parte 12](/blog/cloudflare-gateway-guia): cliente Cloudflare One instalado, proxy de Gateway activo y certificado raíz desplegado. Después activa la inspección TLS en **Zero Trust › Traffic policies › Traffic settings › Proxy and inspection**, con **Inspect HTTPS requests with TLS decryption**.

Sin ella, la URL sin cliente funciona, pero no aplica tus políticas HTTP.

### 2. Activa la navegación sin cliente

En **Browser isolation › Browser isolation settings**, activa **Allow users to open a remote browser without the device client**. Lo necesitas para la URL con prefijo y para aislar aplicaciones de Access.

Luego, en **Manage remote browser permissions**, elige quién puede abrir el navegador remoto: métodos de login y una política de Access (por ejemplo, correos de tu dominio).

![Browser isolation Overview: acciones rápidas, recomendaciones, métricas de sesiones y bloqueos de copiar, pegar, descargar o imprimir, y sin políticas de aislamiento todavía](media:blog/cloudflare-browser-isolation-guia/01-panel.png)

El campo **Launch browser** de esa página abre cualquier URL aislada. Es la forma más rápida de probar.

### 3. Escribe una política Isolate

Por defecto no se aísla nada. Ve a **Traffic policies › Firewall policies › HTTP** y pulsa **Add a policy**. El ejemplo aísla todo lo que Gateway marca como riesgo de seguridad.

| Selector | Operador | Valor | Acción |
|---|---|---|---|
| Security Categories | in | All security risks | Isolate |

Al elegir **Isolate** aparecen sus ajustes. En una web de riesgo conviene cortar el paso de datos en los dos sentidos:

- **Copy (de remoto a local):** *Allow*, *Allow only within isolated browser* o *Do not allow*.
- **Paste (de local a remoto):** las mismas tres opciones. Con *Allow only within isolated browser* en las dos, solo se copia y pega entre webs aisladas.
- **File downloads:** *Allow*, *Do not allow* o *View in remote browser* (el fichero se ve, pero no se guarda en el equipo).
- **File uploads:** *Allow* o *Do not allow*.
- **Keyboard:** *Allow*, *Do not allow* o, en beta desde el 4 de noviembre de 2026, *Allow read-only actions*: impide escribir, pero deja buscar en la página, seleccionar, copiar, imprimir y hacer zoom (copiar e imprimir siguen sujetos a sus propios ajustes).
- **Printing:** *Allow* o *Do not allow*.

Por defecto, todo está en *Allow*. Ojo: bloquear el teclado no bloquea el ratón, y bloquear descargas no impide que el fichero llegue al navegador remoto. Para eso, bloquea por tipo MIME en otra política HTTP.

Algunas pautas:

- Para excluir algo de una política amplia, crea otra con **Do Not Isolate** y colócala antes.
- Las cookies locales no pasan al navegador remoto. Si la web inicia sesión con un proveedor externo (Google Workspace, por ejemplo), aísla también ese proveedor.
- **Destination IP**, **Destination Country** y **Destination Continent** no sirven para aislar. Además, el tráfico aislado ignora las demás políticas que los usan.

### 4. Aísla una aplicación de Access

Para que una aplicación interna se abra siempre aislada, sin instalar nada en el equipo del usuario:

1. Comprueba que está activo el ajuste del paso 2.
2. En **Access controls › Applications**, edita la aplicación *self-hosted* y ve a **Policies**.
3. Edita una política **Allow** y, en **Additional settings**, activa **Isolate application**.

El tráfico de esa aplicación pasa por tus políticas HTTP de Gateway. Puedes, por ejemplo, desactivar las descargas solo si el dispositivo no supera tus comprobaciones de postura. Para los equipos gestionados, añade otra política Allow sin aislamiento.

Para aplicaciones **privadas** (IP o nombre interno), desde febrero de 2026 existe **Allow clientless access**: quien pase la política ve en el App Launcher un enlace a la URL con prefijo.

## Lo mismo, como código

Con el proveedor de Terraform (v5), primero activa la navegación sin cliente y la inspección TLS de la cuenta:

```hcl
resource "cloudflare_zero_trust_gateway_settings" "cuenta" {
  account_id = var.account_id
  settings = {
    tls_decrypt = {
      enabled = true
    }
    browser_isolation = {
      url_browser_isolation_enabled = true
    }
  }
}
```

Después, la política Isolate con los controles de datos. `version = "v2"` activa los valores con nombre (`enabled`, `disabled`, `remote_only`); `v1` usa los antiguos booleanos `dcp`, `dd`, `dk`…

```hcl
resource "cloudflare_zero_trust_gateway_policy" "aislar_riesgos" {
  account_id  = var.account_id
  name        = "Aislar riesgos de seguridad"
  description = "Webs de malware y phishing, en el navegador remoto y sin sacar datos"
  enabled     = true
  action      = "isolate"
  filters     = ["http"]
  precedence  = 1000
  traffic     = "any(http.request.uri.security_category[*] in {68 178 80 83 176 175 117 131 134 151 153})"

  rule_settings = {
    biso_admin_controls = {
      version  = "v2"
      copy     = "remote_only"
      paste    = "remote_only"
      download = "disabled"
      upload   = "disabled"
      keyboard = "enabled"
      printing = "disabled"
    }
  }
}
```

Para aislar una aplicación de Access, añade `isolation_required = true` a su `cloudflare_zero_trust_access_policy`. El token necesita permisos de escritura de Zero Trust: guárdalo en una variable de entorno o en tu gestor de secretos, nunca en el `.tf`.

Con la API, una política Isolate es un `POST /accounts/{account_id}/gateway/rules`:

```bash
: "${ACCOUNT_ID:?Falta ACCOUNT_ID}" "${CLOUDFLARE_API_TOKEN:?Falta CLOUDFLARE_API_TOKEN}"

curl -sS --fail-with-body \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/gateway/rules" \
  --request POST \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{
    "name": "Aislar noticias y medios",
    "enabled": true,
    "action": "isolate",
    "filters": ["http"],
    "traffic": "any(http.request.uri.content_category[*] in {122})",
    "rule_settings": {
      "biso_admin_controls": {
        "version": "v2",
        "download": "remote_only",
        "upload": "disabled"
      }
    }
  }'
```

La primera línea corta el script si falta alguna variable. La categoría 122 es *News and Media*.

## Cómo comprobarlo

En un equipo con el cliente conectado, o abriendo la URL con prefijo, entra en una web que coincida con tu política:

- **Clic derecho.** En una web aislada el menú contextual es más corto.
- **Candado de la barra de direcciones.** El certificado lo emite la CA raíz de Cloudflare.
- **La acción bloqueada.** Pegar o descargar no funciona.

Para volver a la versión sin aislar, desconecta el cliente y recarga.

En los registros:

- Las peticiones HTTP y las consultas DNS del navegador remoto aparecen en el **registro de actividad de Gateway**.
- Los inicios de sesión por la URL sin cliente, en el **registro de autenticación de Access**.
- Las acciones del usuario (copiar, pegar, descargar, subir, imprimir) solo se exportan por **Logpush**.

## Límites y precios

- **Licencias:** el complemento se asigna por usuario.
- **Solo HTTPS.** Las webs por HTTP sin cifrar no se aíslan.
- **Una ventana activa.** Las pestañas del mismo navegador comparten sesión y solo se procesa la que tiene el foco; el audio o vídeo de otra se pausa.
- **Sin cámara ni micrófono.** WebGL puede fallar, Netflix y Spotify Web no funcionan y no hay H.265/HEVC.
- **Descargas:** viven en la memoria del navegador remoto y se borran al cerrar la sesión. Máximo recomendado: 512 MB por fichero.
- **Navegadores:** Chrome, Firefox, Safari, Edge y otros basados en Chromium. No funciona en Internet Explorer 11 ni en máquinas virtuales.
- **URL sin cliente:** sin llaves de seguridad (YubiKey, WebAuthn), porque cambia el dominio. En una aplicación de Access aislada sí funcionan.
- **Aplicaciones privadas** en puertos distintos del 443: no son compatibles.
- **Fuentes:** el navegador remoto corre en Linux, sin Arial ni Times New Roman. Declara siempre una familia de reserva (`sans-serif`).
- **Solo Enterprise:** *resolver policies* para DNS privado desde la URL sin cliente, y tu propio certificado raíz para la inspección TLS.
- **Beta o bajo petición:** teclado *Allow read-only actions*, diálogos de bloqueo personalizados y la extensión de Chrome que sincroniza cookies.

## Documentación oficial

- [Browser Isolation: visión general y planes](https://developers.cloudflare.com/cloudflare-one/remote-browser-isolation/)
- [Configurar Browser Isolation](https://developers.cloudflare.com/cloudflare-one/remote-browser-isolation/setup/) y [Clientless Web Isolation](https://developers.cloudflare.com/cloudflare-one/remote-browser-isolation/setup/clientless-browser-isolation/)
- [Políticas de aislamiento y sus ajustes](https://developers.cloudflare.com/cloudflare-one/remote-browser-isolation/isolation-policies/)
- [Aislar una aplicación de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/isolate-application/)
- [Limitaciones conocidas](https://developers.cloudflare.com/cloudflare-one/remote-browser-isolation/known-limitations/)
- [Changelog de Browser Isolation](https://developers.cloudflare.com/cloudflare-one/changelog/browser-isolation/): [Canvas Remoting](https://developers.cloudflare.com/changelog/post/2026-04-10-canvas-remoting-performance/), [permisos por política](https://developers.cloudflare.com/changelog/post/2026-09-30-browser-isolation-rbac/) y [teclado en solo lectura](https://developers.cloudflare.com/changelog/post/2026-11-04-granular-keyboard-controls/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** CASB: postura de seguridad de las aplicaciones SaaS.

## También te puede interesar

- [Gateway: filtrado DNS y HTTP para tu equipo](/blog/cloudflare-gateway-guia)
- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
- [WARP: el cliente de Zero Trust y la postura del dispositivo](/blog/cloudflare-warp-guia)
