---
publishDate: 2026-02-17T09:00:00Z
draft: false
image: 'media:blog/cloudflare-ddos-guia/portada.png'
title: 'Protección DDoS en Cloudflare: qué está protegido de serie y cómo ajustarlo'
excerpt: 'Serie Cloudflare, parte 7. Qué hace la protección DDoS de Cloudflare sin que toques nada, qué puedes ajustar en el plan Free (acción y sensibilidad), cuándo encender Under Attack mode, cómo recibir un aviso cuando te atacan y qué queda solo para Enterprise.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'ddos'
  - 'seguridad'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 7 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

En el post del [WAF](/blog/cloudflare-waf-guia) apareció una fase antes que todas las demás: la protección DDoS. No la configuraste y ya estaba ahí. Este post explica qué hace, qué puedes cambiar y qué hacer el día que te ataquen de verdad.

## Qué es

Un ataque DDoS (*Distributed Denial of Service*) intenta tumbar un servicio inundándolo de tráfico desde muchas fuentes a la vez. Puede ser a nivel de red (paquetes SYN o UDP, reflexión) o a nivel de aplicación (miles de peticiones HTTP por segundo contra tu web).

Cloudflare lo detecta y lo mitiga en su red, de forma automática. Tres ideas clave:

- **Está en todos los planes, Free incluido.** Cubre las capas 3, 4 y 7.
- **Es *unmetered*.** No pagas por el tamaño del ataque ni hay un tope de tráfico mitigado.
- **Siempre está activa.** No se puede desactivar. Lo único que puedes hacer es ajustar cómo reacciona.

La protección se expone como dos **rulesets gestionados**, igual que las reglas gestionadas del WAF:

- **HTTP DDoS attack protection** (capa 7). Reglas contra herramientas de ataque conocidas, botnets, violaciones de protocolo, peticiones que provocan muchos errores en el origen y tráfico excesivo contra la caché o el origen.
- **Network-layer DDoS attack protection** (capas 3/4). Inundaciones UDP, SYN floods, reflexión SYN-ACK, inundaciones DNS…

Cloudflare actualiza las reglas por su cuenta. Tú no tienes que desplegar nada.

## Casos de uso

- **Una web pequeña que recibe un ataque.** No haces nada: la red de Cloudflare absorbe y filtra el tráfico antes de que llegue a tu servidor.
- **Picos legítimos que parecen un ataque.** Un lanzamiento, una campaña o una retransmisión pueden disparar reglas DDoS. Bajar la sensibilidad evita falsos positivos.
- **Un ataque de capa 7 que se cuela.** Si el origen sufre y las reglas automáticas no bastan, enciendes **Under Attack mode** para toda la zona o solo para una ruta.
- **Saber que te están atacando.** Un aviso por correo o webhook cuando Cloudflare mitiga un ataque HTTP.

## Arquitectura

![Flujo de una petición: Internet (visitas legítimas y tráfico de ataque) pasa por la protección DDoS de capa 3/4 y de capa 7, siempre activas, luego por el WAF y Under Attack mode, y llega a la caché y al origen; la mitigación de capa 7 dispara un aviso. Debajo, tabla de niveles de sensibilidad: High (por defecto), Medium, Low y Essentially Off](media:blog/cloudflare-ddos-guia/00-arquitectura.png)

Cómo funciona por dentro:

1. **Muestreo fuera de la ruta.** Los sistemas de Cloudflare analizan muestras del tráfico sin ponerse en medio de cada petición, así que no añaden latencia. Miran campos de los paquetes (IP, puertos, protocolo, flags TCP), metadatos HTTP (cabeceras, *user agent*, ruta, método, versión TLS) y las respuestas de tu origen (códigos de error y su ritmo).
2. **Reglas dinámicas.** Cada regla tiene una **sensibilidad** y una **acción** por defecto, según lo segura que esté de que el tráfico es un ataque.
3. **Mitigación en el borde.** Cuando una regla salta, el tráfico se bloquea o recibe un *challenge* en el mismo centro de datos que lo recibió.

Dos matices importantes:

- **Solo protege los registros con proxy.** Un registro en **solo DNS** (nube gris) expone la IP de tu servidor, y un ataque contra esa IP no pasa por Cloudflare. Lo vimos en la [parte 1](/blog/cloudflare-dns-dnssec-guia).
- **Estás protegido hasta la capa en la que opera tu servicio.** Una web detrás del proxy (capa 7) tiene protección de capa 7 hacia abajo, incluida la 3/4. Proteger redes enteras o tráfico que no es HTTP es cosa de Magic Transit y Spectrum, que no entran en este post.

### Sensibilidad y acción

Los dos parámetros que ajustas son:

- **Sensibilidad.** *High* (por defecto, valor `default` en la API), *Medium* (`medium`), *Low* (`low`) y *Essentially Off* (`eoff`). Más sensibilidad significa un umbral más bajo: la regla actúa antes. Con *Essentially Off* la regla casi nunca actúa, pero Cloudflare sigue parando los ataques muy grandes para proteger su red.
- **Acción.** *Block* (`block`), *Managed Challenge* (`managed_challenge`) e *Interactive Challenge* (`challenge`). *Log* (`log`) solo registra y es de Enterprise con Advanced DDoS Protection.

La documentación avisa de que algunas acciones o niveles de sensibilidad pueden no estar disponibles en todos los planes. El panel solo te ofrece los que tienes.

### Una regla que conviene conocer: Origin Protect

Dentro del ruleset HTTP hay una regla para **peticiones que provocan muchos errores en el origen** (ID `dd42da7baabe4e518eaf11c393596a9d`). Funciona en cualquier plan:

- Por defecto actúa a partir de **1.000 errores por segundo**.
- En Pro, Business y Enterprise, además, el ritmo de errores tiene que ser al menos **cinco veces** el tráfico normal del origen.
- Cuenta todos los errores 52x y los 53x salvo el 530. No puedes excluir códigos concretos.

Si tu origen falla mucho por un motivo legítimo (un despliegue roto, por ejemplo), esta es la regla que puede saltar.

## Implementación paso a paso

Las capturas son de `carluve.dev`, una zona en plan **Free**, y de la cuenta que la contiene. El override del paso 2 lo rellené para la captura y lo cancelé sin desplegarlo.

### 1. Mira qué tienes ya

En el panel nuevo, la protección DDoS de capa 7 está en **Security › Security rules**, pestaña **DDoS protection**. Ahí aparece el ruleset **HTTP DDoS attack protection**, activo, con el botón **Create override**.

![Security › Security rules, pestaña DDoS protection en una zona Free: rulesets de capa de red y SSL/TLS activos y, en HTTP protection, ningún override creado y el botón Create override](media:blog/cloudflare-ddos-guia/01-ddos-protection.png)

La protección de capa 3/4 está a nivel de cuenta, en **Account home › L3/4 DDoS › Network-layer DDoS Protection**. En una web normal no hay nada que tocar ahí: solo pueden personalizarla los clientes de Magic Transit y Spectrum en Enterprise.

### 2. Ajusta la sensibilidad (solo si lo necesitas)

La configuración por defecto es la recomendada. Solo merece la pena cambiarla si ves falsos positivos o esperas un pico legítimo muy grande.

**DDoS protection › HTTP DDoS attack protection › Create override.** Puedes cambiar la acción y la sensibilidad de todo el ruleset, de una etiqueta o de una regla concreta.

![Formulario New DDoS override rule: nombre, alcance (todas las peticiones de la zona) y los desplegables de acción y sensibilidad del ruleset, ambos en Default](media:blog/cloudflare-ddos-guia/02-override.png)

Lo que importa saber en un plan que no es Enterprise:

- **Tienes un solo override.** Puede llevar varios ajustes dentro (el ruleset, etiquetas, reglas), pero siempre se aplica a **todo** el tráfico de la zona. No puedes limitarlo a una ruta o a una IP.
- **No puedes desactivar reglas.** Un override con `enabled: false` no funciona aquí. Lo más parecido es *Essentially Off*.
- **Algunas reglas son de solo lectura** y no se pueden cambiar.
- **Prioridad:** lo que pones en una regla o etiqueta pesa más que lo que pones para todo el ruleset.

Una pauta: si una sola regla te da falsos positivos, baja la sensibilidad **solo de esa regla**, no de todo el ruleset. Los eventos de Security Analytics te dicen qué regla saltó.

### 3. Under Attack mode: el botón de emergencia

Si el origen sigue sufriendo, **Under Attack mode** añade comprobaciones extra: cada visitante recibe una página intermedia con un *challenge* que, en unos cinco segundos, decide si lo deja pasar. Después no ve otro hasta que caduca el tiempo de **Challenge Passage**.

Está apagado por defecto. Para encenderlo en toda la zona:

- En la página de la zona, **Quick Actions › Under Attack Mode**, o
- **Security › Settings**, en *Security level*.


Úsalo con cuidado:

- Es un **último recurso**. Pausa temporalmente el acceso normal a la web y afecta a tu analítica de terceros, porque la página intermedia necesita JavaScript.
- **Rompe las APIs** y cualquier cliente que no sea un navegador. También puede bloquear previsualizaciones de enlaces (Facebook, por ejemplo) y las peticiones *loopback* de WordPress.
- **Mejor por partes.** Con una **regla de configuración** (*Rules › Configuration Rules*, ajuste *I'm Under Attack*) puedes encenderlo solo para `/admin` o `/login` y dejar el resto de la web normal.
- **Apágalo** en cuanto pase el ataque.

### 4. Configura el aviso

**Account home › Notifications › Add › HTTP DDoS Attack Alert.** Avisa cuando Cloudflare mitiga un ataque HTTP de más de **100 peticiones por segundo**. Está incluido en todos los planes y no tiene filtros.


Lo que trae cada aviso: hora de detección y mitigación, tipo de ataque, ritmo máximo, objetivo (zona o host), regla que coincidió y el override aplicado, si lo hay. Llega en torno a un minuto después de detectarse y no se repite dentro de la misma hora.

El correo y los webhooks están en todos los planes. Las alertas **Advanced HTTP DDoS Attack Alert**, con filtros por zona, host y umbral de peticiones por segundo, son de Enterprise con Advanced DDoS Protection.

### Lo mismo, como código

Con el proveedor de Terraform (v5), un override que baja la sensibilidad de todo el ruleset HTTP a *Medium*. El ID del ruleset es fijo y público, y en un plan que no es Enterprise la expresión tiene que ser `true`:

```hcl
resource "cloudflare_ruleset" "ddos_l7" {
  zone_id = var.zone_id
  name    = "HTTP DDoS: override"
  kind    = "zone"
  phase   = "ddos_l7"
  rules = [{
    ref         = "ddos_l7_override"
    description = "Sensibilidad Medium para toda la zona"
    expression  = "true"
    action      = "execute"
    action_parameters = {
      id = "4d21379b4f9f4bb088e0729962c8b3cf" # HTTP DDoS Attack Protection
      overrides = {
        sensitivity_level = "medium"
      }
    }
  }]
}
```

El token necesita el permiso *HTTP DDoS Managed Ruleset Write*. Igual que con el WAF, Terraform asume que controla toda la fase `ddos_l7`: si ya creaste un override en el panel, impórtalo antes con `cf-terraforming`.

Y Under Attack mode solo para `/admin`, con una regla de configuración:

```hcl
resource "cloudflare_ruleset" "config_rules" {
  zone_id = var.zone_id
  name    = "Reglas de configuración"
  kind    = "zone"
  phase   = "http_config_settings"
  rules = [{
    ref         = "under_attack_admin"
    description = "Under Attack mode en /admin"
    expression  = "starts_with(http.request.uri.path, \"/admin\")"
    action      = "set_config"
    action_parameters = {
      security_level = "under_attack"
    }
  }]
}
```

Este token necesita *Zone › Config Rules › Edit*.

Con la API, el override va en `PUT /zones/{zone_id}/rulesets/phases/ddos_l7/entrypoint`, que **sustituye la lista entera** de esa fase. También existe un override a nivel de cuenta (`/accounts/{account_id}/rulesets/phases/ddos_l7/entrypoint`), solo por API. Si una zona tiene su propio override, el de la cuenta no se evalúa para ella.

## Cómo comprobarlo

Con Under Attack mode activo para una ruta, la respuesta trae la cabecera `cf-mitigated: challenge`. Es la forma fiable de saber que Cloudflare devolvió un *challenge* y no tu página:

```bash
curl -s -o /dev/null -D - https://www.example.com/admin | grep -i cf-mitigated
# cf-mitigated: challenge
```

En el panel, **Security › Analytics** muestra el tráfico mitigado. Las mitigaciones de la protección DDoS de capa 7 aparecen como eventos **HTTP DDoS** en la pestaña **Events**, con la regla que saltó.


En Free, los eventos son una **muestra**. Si la lista está vacía, lo normal es que nadie te haya atacado: no significa que la protección esté apagada.

## Límites y precios

La protección DDoS no tiene coste extra ni tope de tráfico mitigado en ningún plan. Lo que cambia es cuánto puedes ajustarla:

| | Todos los planes | Solo Enterprise |
|---|---|---|
| Protección de capa 3/4 y capa 7, sin límite | ✓ | |
| Overrides HTTP DDoS | 1, para todo el tráfico | Hasta 10, con expresión propia (con Advanced DDoS Protection) |
| Acciones Block y challenges, niveles de sensibilidad | ✓ | |
| Acción Log | | ✓ (con Advanced DDoS Protection) |
| Adaptive DDoS Protection | | ✓ (con Advanced DDoS Protection) |
| Overrides de capa 3/4 | | ✓ (Magic Transit y Spectrum) |
| Under Attack mode | ✓ | |
| HTTP DDoS Attack Alert (> 100 rps) | ✓ | |
| Advanced HTTP DDoS Attack Alert, con filtros | | ✓ (con Advanced DDoS Protection) |
| Network Analytics (capa 3/4) | | ✓ (Spectrum, BYOIP, Magic Transit) |

- **Adaptive DDoS Protection** aprende el perfil de tu tráfico de los últimos 7 días (por origen, por *user agent* y por país o región, usando el percentil 95) y actúa contra lo que se sale de él. Sus reglas empiezan en *Log*. Las de capa 3/4 son para Magic Transit y Spectrum BYOIP.
- **Advanced DDoS Protection** (Advanced TCP Protection, Advanced DNS Protection y Programmable Flow Protection) es para clientes de Magic Transit.
- Las alertas solo cubren ataques detectados por los rulesets gestionados, no los de los sistemas avanzados.

## Documentación oficial

- [Protección DDoS: visión general](https://developers.cloudflare.com/ddos-protection/about/) y [cómo funciona](https://developers.cloudflare.com/ddos-protection/about/how-ddos-protection-works/)
- [Cobertura de ataques](https://developers.cloudflare.com/ddos-protection/about/attack-coverage/)
- [HTTP DDoS Attack Protection](https://developers.cloudflare.com/ddos-protection/managed-rulesets/http/), [parámetros (acción y sensibilidad)](https://developers.cloudflare.com/ddos-protection/managed-rulesets/http/override-parameters/) y [overrides en el panel](https://developers.cloudflare.com/ddos-protection/managed-rulesets/http/http-overrides/configure-dashboard/)
- [Network-layer DDoS Attack Protection](https://developers.cloudflare.com/ddos-protection/managed-rulesets/network/)
- [Adaptive DDoS Protection](https://developers.cloudflare.com/ddos-protection/managed-rulesets/adaptive-protection/)
- [Under Attack mode](https://developers.cloudflare.com/fundamentals/reference/under-attack-mode/) y [ajuste I'm Under Attack en reglas de configuración](https://developers.cloudflare.com/rules/configuration-rules/settings/)
- [Alertas DDoS](https://developers.cloudflare.com/ddos-protection/reference/alerts/) y [analítica DDoS](https://developers.cloudflare.com/ddos-protection/reference/analytics/)
- [Terraform: rulesets gestionados DDoS](https://developers.cloudflare.com/terraform/additional-configurations/ddos-managed-rulesets/)
- [Detectar una respuesta de challenge (cf-mitigated)](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)
- [Changelog de las reglas HTTP DDoS](https://developers.cloudflare.com/ddos-protection/change-log/http/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** bots, con Bot Fight Mode y Super Bot Fight Mode.

## También te puede interesar

- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
