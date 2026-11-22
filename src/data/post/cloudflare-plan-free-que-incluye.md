---
publishDate: 2026-01-13T09:00:00Z
draft: false
image: 'media:blog/cloudflare-plan-free-que-incluye/portada.png'
title: 'El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites'
excerpt: 'Repaso, límite a límite, de lo que trae gratis una cuenta de Cloudflare: DNS, CDN, certificados, DDoS, WAF, reglas, Workers, almacenamiento, IA y Zero Trust. Con los números de la documentación oficial y cuándo merece la pena pasar a un plan de pago.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'plan free'
  - 'seguridad'
  - 'workers'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare.** Antes de entrar servicio a servicio, conviene saber qué se puede hacer sin pagar nada. Este post sirve de mapa para el resto de la serie.

Una pregunta que me hacen a menudo es «¿qué me da Cloudflare gratis?». La respuesta corta es: mucho más de lo que la gente espera. La larga es este post, con los límites concretos sacados de la documentación oficial.

## Primero, una aclaración: hay varios «Free»

En Cloudflare no hay un único plan gratuito, sino tres que funcionan de forma independiente:

| Plan                | Se aplica a…                          | Qué cubre                                                                |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| **Free (de zona)**  | Cada dominio que añades               | DNS, CDN, certificados, DDoS, WAF, reglas, bots                          |
| **Workers Free**    | Tu cuenta                             | Workers, KV, D1, R2, Durable Objects, Workflows, Workers AI y compañía   |
| **Zero Trust Free** | Tu organización de Zero Trust         | Access, Gateway, Tunnel, cliente WARP                                    |

Puedes tener un dominio en Free y Workers en pago, o al revés. Cada uno se cambia por separado.

![Overview de una zona en el plan Free: la etiqueta «free» junto al nombre del dominio, con visitantes, peticiones y caché de las últimas 24 horas](media:blog/cloudflare-plan-free-que-incluye/01-zona-free.png)

Así se ve una zona en Free: la etiqueta **free** aparece junto al dominio. En la misma cuenta conviven zonas Free y Enterprise.

## El plan Free de zona: tu web, protegida y rápida

### DNS y DNSSEC

DNS autoritativo y DNSSEC incluidos, con la configuración completa (cambiar los nameservers a Cloudflare). Lo tienes paso a paso en el [primer post de la serie](/blog/cloudflare-dns-dnssec-guia).

### Certificados SSL/TLS

Cloudflare emite y renueva **certificados gratuitos** (Universal SSL) para el dominio raíz y los subdominios de primer nivel (`example.com` y `www.example.com`), siempre que el registro vaya con proxy. Dos detalles del plan Free:

- El certificado es solo **ECDSA**; los planes de pago reciben además uno RSA.
- Los subdominios de segundo nivel (`dev.www.example.com`) no están cubiertos; eso requiere Advanced Certificate Manager, que es de pago.

### Protección DDoS

**Sin límite y sin medir**, en capas 3, 4 y 7, en todos los planes. No hay que activar nada y el tráfico de ataque no cuenta para tu consumo.

### WAF y reglas de seguridad

| Función                         | Plan Free                                 |
| ------------------------------- | ----------------------------------------- |
| Reglas gestionadas              | Cloudflare Free Managed Ruleset           |
| Reglas personalizadas           | 5 (sin expresiones regulares)             |
| Reglas de rate limiting         | 1, contando por IP, periodo de 10 s       |
| Reglas sobre la respuesta       | 3                                         |
| Listas personalizadas (de IP)   | 1, hasta 10.000 elementos                 |
| Reglas de acceso por IP         | Sí                                        |
| Detección de credenciales filtradas | Sí (un campo)                         |

El **Free Managed Ruleset** no es un adorno: Cloudflare lo actualiza cuando sale una vulnerabilidad grave. Por ejemplo, el 21 de octubre de 2026 añadió siete reglas de emergencia a ese conjunto.

### Bots

**Bot Fight Mode** está en Free: es un interruptor que desafía el tráfico que coincide con bots conocidos. No se puede personalizar ni saltar con reglas; para eso está Super Bot Fight Mode, desde Pro. También puedes activar **Block AI Bots** para frenar a los rastreadores de IA.

### Reglas de configuración y caché

| Tipo de regla                                  | Plan Free |
| ---------------------------------------------- | --------- |
| Cache Rules                                    | 10        |
| Redirecciones (Single Redirects)               | 10        |
| Redirecciones masivas (en total por cuenta)    | 10.000    |
| Transform Rules                                | 10        |
| Origin Rules                                   | 10        |

Lo que **no** está en Free: Custom Errors (páginas de error propias), Zone Lockdown y las expresiones regulares en reglas.

## Workers Free: una plataforma de desarrollo entera

Aquí es donde el plan gratuito sorprende. Con Workers Free puedes desplegar aplicaciones completas:

| Producto              | Límite gratis                                                           |
| --------------------- | ----------------------------------------------------------------------- |
| **Workers**           | 100.000 peticiones al día, 10 ms de CPU por petición, 100 Workers       |
| **Assets estáticos**  | Peticiones gratis e ilimitadas, 20.000 ficheros por versión             |
| **KV**                | 100.000 lecturas y 1.000 escrituras al día, 1 GB                        |
| **D1** (SQL)          | 5 millones de filas leídas y 100.000 escritas al día, 5 GB, 10 bases    |
| **R2** (objetos)      | 10 GB al mes, 1 M de operaciones de escritura y 10 M de lectura, **sin coste de salida** |
| **Durable Objects**   | Disponibles, hasta 5 GB de almacenamiento                               |
| **Workflows**         | 3.000 pasos al día                                                      |
| **Workers AI**        | 10.000 Neurons al día                                                   |
| **Cron Triggers**     | 5 por cuenta                                                            |

Los límites diarios se reinician a las 00:00 UTC. Cuando un Worker supera las 100.000 peticiones, Cloudflare devuelve el **error 1027**, o deja pasar la petición sin el Worker si configuras la ruta en modo *fail open*.

Dos matices importantes:

- **10 ms de CPU** dan para la mayoría de APIs y redirecciones (la media de un Worker son unos 2,2 ms), pero se quedan cortos para renderizado en servidor (SSR) pesado. Ese es el motivo más habitual para pasar a Workers Paid.
- Desde julio de 2026, algunos modelos grandes de Workers AI (como Kimi K2.6 o GLM-5.2) solo están en Workers Paid. Muchos otros siguen disponibles en Free.

![Página Workers plans del panel: comparativa Free (0 $), Paid (5 $ al mes más uso) y Enterprise, con 100.000 peticiones al día y 10 ms de CPU en Free](media:blog/cloudflare-plan-free-que-incluye/02-workers-planes.png)

La comparativa está en el propio panel, en **Compute › Workers plans**.

## Zero Trust Free: seguridad para un equipo pequeño

Cloudflare One también tiene un plan gratuito pensado para equipos pequeños, con **Access** (proteger aplicaciones internas sin VPN), **Gateway** (filtrado DNS y HTTP), **Tunnel** (publicar servicios sin abrir puertos) y el cliente **WARP**. Al darlo de alta te pide un método de pago, pero no te cobra.

Lo que cambia respecto a los planes de pago es sobre todo la **retención de logs**: 24 horas en Free frente a 30 días en Standard. Para una pyme o un laboratorio en casa es suficiente para empezar; para auditoría, no.

## Y además, gratis

- **Turnstile**, la alternativa a los CAPTCHA: hasta 20 widgets por cuenta.
- **Email Routing**: recepción y reenvío de correo ilimitados.
- **AI Gateway**: analítica, caché y rate limiting para tus llamadas a modelos de IA.
- **Web Analytics**: sin límite de sitios si pasan por el proxy de Cloudflare.

## ¿Cuándo pasar a pago?

| Si necesitas…                                                        | Mira…              |
| -------------------------------------------------------------------- | ------------------ |
| Más de 5 reglas WAF, el Cloudflare Managed Ruleset completo u OWASP  | Pro                |
| Super Bot Fight Mode, páginas de error propias                       | Pro                |
| Expresiones regulares en reglas, configuración parcial (CNAME)      | Business           |
| Más de 100.000 peticiones al día o más de 10 ms de CPU en Workers    | Workers Paid (5 $/mes) |
| Logs de Zero Trust más de 24 horas                                   | Zero Trust de pago |
| Bot Management, Advanced Rate Limiting, contrato y SLA               | Enterprise         |

Mi recomendación: empieza en Free, mide y sube solo lo que se te quede corto. Al ser planes independientes, puedes pagar Workers sin tocar el plan de tus dominios.

## Documentación oficial

- [Límites de Workers](https://developers.cloudflare.com/workers/platform/limits/) y [precios de Workers (KV, D1, R2, Workflows)](https://developers.cloudflare.com/workers/platform/pricing/)
- [Disponibilidad del WAF por plan](https://developers.cloudflare.com/waf/), [reglas personalizadas](https://developers.cloudflare.com/waf/custom-rules/) y [rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Protección DDoS](https://developers.cloudflare.com/ddos-protection/about/)
- [Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/) y [sus limitaciones](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/)
- [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/) y [redirecciones](https://developers.cloudflare.com/rules/url-forwarding/)
- [Precios de R2](https://developers.cloudflare.com/r2/pricing/) y [de Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Retención de logs de Zero Trust](https://developers.cloudflare.com/cloudflare-one/insights/logs/) y [planes de Zero Trust](https://www.cloudflare.com/plans/zero-trust-services/)
- [Planes de Turnstile](https://developers.cloudflare.com/turnstile/plans/) y [precios de Email Service](https://developers.cloudflare.com/email-service/platform/pricing/)

Límites consultados en la documentación el 22 de noviembre de 2026. Cloudflare los cambia a menudo (casi siempre al alza), así que revisa los enlaces antes de tomar una decisión.

## También te puede interesar

- [DNS y DNSSEC en Cloudflare: el primer paso para cualquier dominio](/blog/cloudflare-dns-dnssec-guia)
- [Cloudflare: Why a Simpler, Faster and Safer Internet Actually Matters](/blog/cloudflare-simpler-faster-safer-internet)
