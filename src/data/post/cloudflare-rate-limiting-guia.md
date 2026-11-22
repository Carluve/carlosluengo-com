---
publishDate: 2026-03-03T09:00:00Z
draft: false
image: 'media:blog/cloudflare-rate-limiting-guia/portada.png'
title: 'Rate limiting en Cloudflare: limitar peticiones sin bloquear a tus usuarios'
excerpt: 'Serie Cloudflare, parte 9. Cómo cuenta Cloudflare las peticiones, qué son las características, el periodo y la duración, qué te deja hacer el plan Free con su única regla, recetas para el login y para una API, y cómo probarlo con un bucle de curl hasta ver el 429.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'rate limiting'
  - 'waf'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 9 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En la [parte 5](/blog/cloudflare-waf-guia) vimos que el WAF tiene tres capas: reglas personalizadas, rate limiting y reglas gestionadas. Las reglas personalizadas deciden **qué** peticiones no quieres. El rate limiting decide **cuántas** aceptas de cada cliente. Una petición a `/login` es normal; cien en diez segundos desde la misma IP, no.

## Qué es

Una regla de rate limiting cuenta las peticiones que cumplen una condición y, cuando un cliente pasa del límite, le aplica una acción durante un tiempo. Tiene estas piezas:

- **Expresión.** Qué peticiones se cuentan. Por ejemplo, las que van a `/login`.
- **Características (*characteristics*).** Cómo se agrupa el contador. Con **IP**, cada IP tiene su propio contador. Cloudflare añade siempre el **centro de datos** como característica, aunque el panel no lo muestre.
- **Periodo.** La ventana de tiempo en la que se cuenta, en segundos.
- **Peticiones por periodo.** El umbral. Al superarlo, salta la acción.
- **Acción.** Block, Managed Challenge, Non-Interactive (JS) Challenge o Interactive Challenge. **Log** es solo de Enterprise.
- **Duración (*mitigation timeout*).** Cuánto tiempo se aplica la acción a ese cliente una vez superado el límite.
- **Expresión de recuento (opcional).** Qué peticiones suman al contador, si quieres que no sean las mismas que la expresión de la regla. Puede usar campos de la respuesta, como el código de estado. Es de Business en adelante.

Si la acción es **Block**, el visitante recibe por defecto un **429** (*Too Many Requests*) con la página de error 1015 de Cloudflare.

**Planes.** Todos los planes tienen reglas de rate limiting: 1 en Free, 2 en Pro, 5 en Business y 100 en Enterprise. Lo que cambia mucho es qué puedes configurar. Free cuenta solo por IP, con un periodo y una duración fijos de 10 segundos, y su expresión solo admite la ruta y si el cliente es un bot verificado. Contar por otros campos (cabecera, cookie, país…) requiere **Advanced Rate Limiting**, un complemento de Enterprise. Lo detallo en *Límites y precios*.

## Casos de uso

- **Login y recuperación de contraseña.** Frenar la fuerza bruta y el *credential stuffing* sin molestar a quien se equivoca de contraseña una o dos veces.
- **Formularios.** Un formulario de contacto o de registro que no debería recibir más de unos pocos envíos por minuto desde la misma IP.
- **APIs.** Poner un techo a lo que un solo cliente puede pedir, para que un script mal hecho (o malintencionado) no tumbe el origen.
- **Rutas caras.** Búsquedas, exportaciones o cualquier endpoint que haga trabajar de verdad a la base de datos.

## Arquitectura

![Flujo de una regla de rate limiting: la petición llega tras las reglas personalizadas, se comprueba si coincide con la expresión (en Free, solo ruta y bot verificado), se suma a un contador por IP y centro de datos (en Free, periodo de 10 s) y, si supera el límite, se aplica Block con 429 durante la duración; si no, sigue hacia reglas gestionadas, caché y origen. Debajo, tabla de parámetros con su valor en Free y lo que es solo Enterprise](media:blog/cloudflare-rate-limiting-guia/00-arquitectura.png)

1. La petición pasa primero por las **reglas personalizadas**. Después llegan las de rate limiting, que se evalúan **en orden**. Una que bloquea corta la evaluación de las siguientes.
2. Si la petición **no coincide** con la expresión, no cuenta y sigue su camino.
3. Si coincide, Cloudflare suma uno al **contador** que corresponde a sus características.
4. Si el contador **supera** el umbral dentro del periodo, se aplica la acción a ese cliente durante la **duración** configurada, sin volver a mirar la tasa.
5. Si no lo supera, la petición sigue hacia las reglas gestionadas, la caché y el origen.

Dos detalles antes de poner números:

- **Los contadores no son globales.** Cada centro de datos de Cloudflare lleva los suyos (salvo los que comparten ubicación geográfica). Un atacante repartido por muchos países puede quedarse por debajo del límite en cada uno.
- **No es un contador exacto.** Entre que llega la petición y se actualiza el contador puede pasar algún segundo, así que algunas peticiones de más pueden llegar al origen antes de que salte el bloqueo.

Con los *challenges* hay otra particularidad: en Free, Pro y Business no se elige duración. La regla **limita el ritmo** (*throttling*): cuando el visitante resuelve el *challenge*, su contador vuelve a cero, y si vuelve a pasar del límite, recibe otro. Mantener la acción durante una duración con un *challenge*, o limitar el ritmo con **Block**, es solo de Enterprise.

## Implementación paso a paso

Las capturas son de `carluve.dev`, una zona en plan **Free**.

### 1. Mira qué tienes ya

En **Security › Security rules** están todas las reglas de la zona, incluidas las de rate limiting.

![Security › Security rules en una zona Free: Rate limiting rules 1/1 ocupado por la regla Leaked credential check en Block](media:blog/cloudflare-rate-limiting-guia/01-reglas.png)

En Free es probable que la única regla ya esté ocupada por la **plantilla de credenciales filtradas**. La detección de credenciales filtradas viene activada por defecto en Free y compara las contraseñas que se envían en los formularios de inicio de sesión con bases de datos de filtraciones. La plantilla de rate limiting bloquea a las IPs que intentan entrar con una contraseña filtrada **más de cinco veces en 10 segundos**.

¿Cuál te protege mejor?

- **Deja la de credenciales filtradas** si tu login es de un CMS conocido (WordPress, Drupal, Joomla, Ghost, Magento…), porque la detección ya sabe dónde buscar el usuario y la contraseña.
- **Cámbiala por una tuya** si tu problema es otro: un formulario que reciben bots, una API o un login propio con un formato que la detección no reconoce. Las ubicaciones de detección personalizadas son solo de Enterprise.

### 2. Crea la regla

**Security rules › Create rule › Rate limiting rules**. El ejemplo: limitar los intentos contra `/login`.

El formulario es el mismo para cualquier regla. En la captura, la de credenciales filtradas que ya trae esta zona Free:

![Formulario de una regla de rate limiting (la de credenciales filtradas que trae la zona): campo Password Leaked, la expresión resultante y la característica IP](media:blog/cloudflare-rate-limiting-guia/02-nueva-regla.png)

En Free, la expresión queda así:

```
(http.request.uri.path eq "/login")
```

El método (`POST`), el host o la IP de origen se pueden usar desde Business. Por eso, en Free, la regla cuenta también los `GET` a la página de login: tenlo en cuenta al poner el umbral, porque cada visita a la página suma.

En la parte inferior del formulario eliges el umbral, la acción y la duración.

![Parte inferior del formulario: 5 peticiones cada 10 segundos, acción Block, duración de 10 segundos y orden de ejecución](media:blog/cloudflare-rate-limiting-guia/03-umbral-accion.png)

Algunas pautas:

- **Piensa en personas, no en bots.** Alguien que se equivoca de contraseña tres veces no debería ver un bloqueo. Con un periodo de 10 segundos, 5 peticiones es un punto de partida razonable para un login.
- **Block o Managed Challenge.** Para un formulario que usa una persona desde un navegador, Managed Challenge le deja seguir si demuestra que no es un bot. Para una API, el *challenge* no tiene sentido: un cliente de API no puede resolverlo. Ahí, Block.
- **No limites a los buscadores sin querer.** Si la regla cubre páginas públicas, añade `and not cf.client.bot`. Aplicar rate limiting a bots verificados puede afectar al SEO.
- **Ojo con los Workers (Business o superior).** Si desactivas la opción de contar también lo que sale de la caché y un Worker hace subpeticiones a la misma zona, esas subpeticiones pueden contar como peticiones separadas y la regla salta antes de lo esperado.

### 3. Recetas para planes de pago

En los planes de pago, la misma idea se afina mucho. Estas recetas salen de la documentación de Cloudflare.

**Login con penalización creciente (Business o superior).** Tres reglas que solo cuentan los intentos **fallidos**, gracias a la expresión de recuento con el código de respuesta:

| Regla | Expresión | Cuenta cuando | Límite | Acción |
|---|---|---|---|---|
| 1 | `POST` a `/login` | respuesta 401 o 403 | 4 por minuto | Managed Challenge |
| 2 | `POST` a `/login` | respuesta 401 o 403 | 10 en 10 minutos | Managed Challenge |
| 3 | todo el host | `POST` a `/login` con 401 o 403 | 20 en una hora | Block durante un día |

La expresión de recuento de las tres es:

```
http.request.uri.path eq "/login" and http.request.method eq "POST" and http.response.code in {401 403}
```

Un login correcto (200) no suma. Quien se equivoca cuatro veces ve un *challenge*; quien insiste veinte veces en una hora se queda sin acceso a toda la web durante un día. La regla 3 muestra algo útil: la expresión de recuento (qué suma) y la de la regla (a qué se aplica la acción) pueden ser distintas.

Ojo: la expresión de recuento **no amplía** la de la regla. Si escribes solo `http.response.code eq 403`, cualquier 403 de cualquier URL sumará al contador.

**API por clave (Advanced Rate Limiting, Enterprise).** En una API, varios clientes pueden compartir IP y un mismo cliente puede usar varias. Lo que identifica al cliente es su clave:

- Expresión: `http.request.uri.path eq "/endpoint1" and http.request.method eq "POST"`
- Característica: **Header value of** `x-api-key`
- Acción: Block

Si la clave no viene en la petición, esas peticiones comparten un contador propio. Para no contarlas, añade `and len(http.request.headers["x-api-key"]) > 0` a la expresión de recuento.

### Lo mismo, como código

Las reglas de rate limiting viven en la fase `http_ratelimit`. Con el proveedor de Terraform (v5), la regla de `/login` tal como se puede desplegar en Free:

```hcl
resource "cloudflare_ruleset" "rate_limiting" {
  zone_id = var.zone_id
  name    = "Rate limiting"
  kind    = "zone"
  phase   = "http_ratelimit"
  rules = [{
    ref         = "limitar_login"
    description = "Limitar /login por IP"
    expression  = "(http.request.uri.path eq \"/login\")"
    action      = "block"
    ratelimit = {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 10
      requests_per_period = 5
      mitigation_timeout  = 10
    }
  }]
}
```

Tres cosas que el panel hace por ti y aquí tienes que escribir:

- **`cf.colo.id` es obligatorio** en `characteristics`. Es el centro de datos, la característica que el panel añade sin mostrarla.
- **Con un *challenge* en Free, Pro o Business**, `mitigation_timeout` tiene que ser `0`: esas acciones siempre limitan el ritmo, sin duración.
- **Una sola fase, un solo recurso.** Cada zona tiene un ruleset de entrada por fase. Pon todas las reglas de rate limiting en el mismo `cloudflare_ruleset`.

El token necesita el permiso *Zone WAF: Edit*. Como con las reglas personalizadas, Terraform asume que controla todas las reglas de la fase: si ya tienes la de credenciales filtradas u otra creada en el panel, impórtala antes con `cf-terraforming`.

Con la API, el flujo es este:

1. `GET /zones/{zone_id}/rulesets/phases/http_ratelimit/entrypoint` para ver si el ruleset de la fase existe y obtener su ID.
2. Si existe, añade la regla con `POST /zones/{zone_id}/rulesets/{ruleset_id}/rules`, con el mismo objeto `ratelimit` que en Terraform.
3. Si devuelve 404, crea el ruleset de la fase con la regla dentro.

## Cómo comprobarlo

Con la regla desplegada, un bucle de `curl` contra la ruta protegida. Lánzalo desde una IP que no te importe bloquear durante 10 segundos:

```bash
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" https://www.example.com/login
done
```

Las primeras peticiones devuelven el código normal de tu web (200, o 404 si `/login` no existe) y, al pasar del límite, empiezan los **429**. Que se cuele alguna petición de más antes del primer 429 es normal: el contador tarda un poco en actualizarse. Espera a que acabe la duración y vuelve a probar: deberías recibir de nuevo el código normal.

En el navegador, el bloqueo se ve como la página de error 1015 de Cloudflare.


En Pro y superiores puedes sustituir esa página por una respuesta propia (HTML, texto, JSON o XML, hasta 30 KB) y cambiar el código por cualquiera entre 400 y 499. Para una API, un JSON con el 429 es más útil que una página HTML.

En **Security › Analytics**, la pestaña **Events** lista cada petición mitigada con la regla que la disparó. Filtra por las reglas de rate limiting para ver solo las suyas.


Cuando termines, borra o desactiva la regla de prueba y, si estás en Free, vuelve a desplegar la plantilla de credenciales filtradas si era la que tenías.

## Límites y precios

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Reglas de rate limiting | 1 | 2 | 5 | 100 |
| Periodo máximo | 10 s | 1 min | 10 min | 65.535 s |
| Duración máxima | 10 s | 1 h | 1 día | 1 día |
| Contar por | IP | IP | IP o IP con NAT | IP o IP con NAT |

- Los periodos y duraciones se eligen de una lista fija de valores (10, 15, 20, 30, 40, 45 y 60 segundos; 2, 3, 4, 5 y 10 minutos; y así hasta un día). No todos están en todos los planes.
- La **expresión de recuento**, los campos de respuesta y la opción de **no contar lo que sale de la caché** son de Business en adelante. La **respuesta personalizada** es de Pro en adelante.
- **IP con NAT** usa una cookie para distinguir visitantes que comparten IP. Quien borra cookies o navega en privado comparte un contador con los demás en su misma situación.
- En momentos de sobrecarga, Cloudflare puede dejar de aplicar el rate limiting en un centro de datos antes que bloquear tráfico legítimo (*fail-open*). No hay aviso visible cuando pasa.

Solo Enterprise:

- **Advanced Rate Limiting** (complemento): contar por cabecera, cookie, parámetro de consulta, host, ruta, ASN, país, JA3/JA4 (con Bot Management), valor de un campo JSON o del cuerpo, o una expresión propia.
- **Rate limiting por complejidad** (con Advanced Rate Limiting): tu origen devuelve en una cabecera la "puntuación" de cada petición y la regla limita la suma, no el número.
- **Limitar el ritmo con Block** y elegir duración con un *challenge*.
- Acción **Log**, para probar una regla sin bloquear a nadie.
- **Rulesets de rate limiting a nivel de cuenta**, para desplegar las mismas reglas en varias zonas Enterprise.
- **Duración personalizada** por API.

## Documentación oficial

- [Reglas de rate limiting: visión general y disponibilidad por plan](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Parámetros](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/) y [cómo se calcula la tasa](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/)
- [Crear una regla en el panel](https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/) y [con la API](https://developers.cloudflare.com/waf/rate-limiting-rules/create-api/)
- [Ejemplos](https://developers.cloudflare.com/waf/rate-limiting-rules/use-cases/) y [buenas prácticas](https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/)
- [Solución de problemas](https://developers.cloudflare.com/waf/rate-limiting-rules/troubleshooting/)
- [Detección de credenciales filtradas](https://developers.cloudflare.com/waf/detections/leaked-credentials/) y [cómo empezar](https://developers.cloudflare.com/waf/detections/leaked-credentials/get-started/)
- [Terraform: reglas de rate limiting](https://developers.cloudflare.com/terraform/additional-configurations/rate-limiting-rules/)
- [Error 1015](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1015/)
- [Changelog del WAF](https://developers.cloudflare.com/waf/change-log/changelog/) y [credenciales filtradas en la cabecera Authorization (20-ago-2026)](https://developers.cloudflare.com/changelog/post/2026-08-20-leaked-credentials-authorization-header/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Access, para proteger una aplicación sin VPN.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
