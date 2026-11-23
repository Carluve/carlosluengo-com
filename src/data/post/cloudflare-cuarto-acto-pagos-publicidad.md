---
publishDate: 2026-11-23T09:00:00Z
draft: false
image: 'media:blog/cloudflare-cuarto-acto-pagos-publicidad/portada.png'
title: 'El cuarto acto de Cloudflare: pagos y publicidad para agentes'
excerpt: 'Cloudflare habla de un «Acto 4» para la web de los agentes. Qué productos de pago existen ya (pay per crawl, x402, Monetization Gateway, Pay Per Use), qué es todavía apuesta (publicidad para agentes) y qué puedes hacer hoy si publicas contenido o una API.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'agentes'
  - 'ia'
  - 'pagos'
  - 'publicidad'
lang: 'es'
---

> Trabajo en Cloudflare. Este post es una opinión personal basada en información pública; no representa a la compañía ni usa información interna.

Hace poco leí [«Cloudflare's Fourth Act Is Ads and Payments»](http://viggy28.dev/article/cloudflare-fourth-act-ads-payments/), publicado en viggy28.dev el 6 de noviembre de 2026 por un antiguo empleado de Cloudflare. Su tesis: el cuarto acto de Cloudflare es la capa económica de la web de los agentes, con los pagos primero y la publicidad después. Te recomiendo leerlo entero.

Este post no es una traducción. Es mi lectura del tema con otra pregunta en mente: **qué parte de esa historia puedes tocar hoy y qué parte es todavía una hipótesis.** Por eso lo separo en dos bloques: lo que ya existe, con su documentación, y lo que es apuesta.

## Los cuatro actos

Matthew Prince, CEO de Cloudflare, usó esta división en la [llamada de resultados del segundo trimestre de 2025](https://www.cloudflare.net/files/doc_financials/2025/q2/CORRECTED-TRANSCRIPT_-Cloudflare-Inc-NET-US-Q2-2025-Earnin.pdf) (31 de julio de 2025). El Acto 1 son los productos de proxy inverso, como el WAF o la mitigación de DDoS. El Acto 2, los de proxy directo: Zero Trust, VPN, firewall de red. El Acto 3, las herramientas de desarrollo de Workers. Y sobre el trabajo para ayudar a los editores y dar soporte a las transacciones entre agentes, dijo (traduzco): «hemos empezado a llamarlo internamente Acto 4».

Luego bromeó con que las obras de Shakespeare tienen cinco actos.

![Los cuatro actos de Cloudflare: proxy inverso, Zero Trust y red, plataforma de desarrollo y capa económica para agentes](media:blog/cloudflare-cuarto-acto-pagos-publicidad/01-cuatro-actos.png)

Lo útil del esquema es que los cuatro actos comparten infraestructura. La petición que hoy pasa por Cloudflare para filtrar ataques es la misma a la que el Acto 4 pone precio. La agrupación de productos del diagrama es mía; Prince solo nombró ejemplos.

## El problema: la visita deja de ser la moneda

La web abierta se ha financiado con un bucle simple. Publicas algo, alguien lo encuentra en un buscador, visita tu página y ves un anuncio o pagas una suscripción. La visita es la moneda.

Un agente no visita. Lee, resume y responde en otra parte. En la misma llamada, Prince dio datos. La mayoría de las búsquedas en Google ya incluyen un resumen de IA, y Pew Research ha visto que eso reduce los clics hacia el contenido original. Con las empresas de IA es peor: según el tráfico que observa Cloudflare, de algunas es hasta 30.000 veces más difícil conseguir visitas que del Google de hace años. Su conclusión: la web impulsada por IA acabará con el modelo de negocio de la web antigua.

Si el bucle se rompe, hay dos salidas obvias. O bloqueas a los agentes, o les cobras. Lo que Cloudflare ha ido lanzando desde 2024 cubre las dos.

## Lo que ya existe

Todo lo de esta sección está publicado en el blog o la documentación de Cloudflare. Fíjate en el estado de cada pieza: varias siguen en beta.

### AI Crawl Control y pay per crawl

- **Qué es.** [AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/) (antes AI Audit, [lanzado el 23 de septiembre de 2024](https://blog.cloudflare.com/cloudflare-ai-audit-control-ai-content-crawlers/)) te muestra qué crawlers de IA leen tu web y te deja permitir o bloquear cada uno. Está disponible en todos los planes.
- **Cómo cobra.** Con [pay per crawl](https://blog.cloudflare.com/introducing-pay-per-crawl/) (1 de julio de 2025) fijas un precio por petición. El crawler recibe un `402 Payment Required` con la cabecera `crawler-price`. Si acepta, repite la petición con `crawler-exact-price`. También puede enviar de entrada `crawler-max-price` y recibir directamente un `200` con `crawler-charged`.
- **Quién cobra.** Cloudflare actúa como *merchant of record*: agrega los cargos, factura al crawler y paga al editor.
- **Estado.** [Beta cerrada](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/what-is-pay-per-crawl/).

Lo explico paso a paso en [la guía de AI Crawl Control](/blog/cloudflare-ai-crawl-control-guia).

### Web Bot Auth y agentes firmados

Cobrar no sirve de nada si cualquiera puede hacerse pasar por un crawler. [Web Bot Auth](https://blog.cloudflare.com/signed-agents/) resuelve ese problema: el bot firma sus peticiones con HTTP Message Signatures y Cloudflare valida la firma. Los **agentes firmados** (*signed agents*) actúan por cuenta de un usuario final, y la plataforma que los ejecuta firma sus peticiones del mismo modo. Desde el 1 de julio de 2026 forman parte de [Verified bots](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/), con un campo que distingue el acceso directo del de un intermediario. Es la capa de identidad que hace creíble el cobro.

### x402 y la x402 Foundation

- **Qué es.** [x402](https://blog.cloudflare.com/x402/) es un protocolo abierto para pagar recursos web sobre HTTP. El servidor responde `402` con instrucciones de pago. El cliente repite la petición con una autorización firmada, un *facilitator* liquida el pago y el servidor entrega el recurso. Sin cuentas, sin suscripciones y sin claves de API.
- **Qué anunció Cloudflare** (23 de septiembre de 2025): la intención de crear la x402 Foundation con Coinbase, soporte de x402 en el Agents SDK, herramientas MCP de pago y una propuesta de pagos diferidos para facturar por lotes.
- **Dónde está hoy.** Coinbase aportó el protocolo a la Linux Foundation, que [declaró operativa la x402 Foundation el 14 de julio de 2026](https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications) con 40 miembros. Entre los principales están Cloudflare, Coinbase, Stripe, Google, Visa, Mastercard, American Express, AWS y Shopify.

### Monetization Gateway (beta)

[Monetization Gateway](https://blog.cloudflare.com/monetization-gateway-beta/) (30 de septiembre de 2026) es, en palabras del propio post, un muro de pago para agentes. Sirve para webs, APIs, herramientas MCP o datasets. Defines reglas de precio por URL, cabeceras o parámetros, o dejas que tu origen fije el precio. Usa `402` y x402. La verificación y la liquidación pasan por el facilitator de Coinbase, en USDC sobre la red Base. Está pensado para recursos donde **cada petición es el uso**: APIs, herramientas, datos. Está en beta cerrada y, de momento, solo para vendedores y compradores en EE. UU.

Un ejemplo dentro de Cloudflare: AI Gateway ya permite a clientes de EE. UU. pagar la inferencia de una selección de modelos en cada petición con la cabecera `PAYMENT-METHOD: x402`.

### Pay Per Use (beta)

[Pay Per Use](https://blog.cloudflare.com/pay-per-use/) (30 de septiembre de 2026) cubre el contenido, donde una petición no equivale a un uso. La idea de partida: los productos de IA rastrean mucho más de lo que usan, así que se paga por el uso y no por el rastreo. Una empresa de IA identifica su crawler como Verified bot, define el uso por el que pagará y pone un precio. El editor acepta o rechaza la oferta en el panel (*Monetize → Pay Per Use*), sin tocar su origen. El comprador declara cada uso por API y Cloudflare factura y paga cada mes. Ojo: el uso es **autodeclarado**; Cloudflare comprueba que encaja con un editor inscrito. También está en beta.

![Flujo de pago: el agente pide, Cloudflare devuelve un 402 con precio, el agente paga y recibe el contenido. La publicidad aparece como apuesta](media:blog/cloudflare-cuarto-acto-pagos-publicidad/02-flujo-pago.png)

### Lo que ha dicho Cloudflare sobre los ingresos

En la [llamada del tercer trimestre de 2026](https://stockanalysis.com/stocks/net/transcripts/726816-q3-2026/) (5 de noviembre), Prince anunció (traduzco): «registramos en el tercer trimestre nuestros primeros ingresos de lo que hemos llamado productos del Acto 4». No dio cifras. Es un dato puntual, no una tendencia.

## Lo que es apuesta: publicidad para agentes

Aquí cambia el terreno. No hay producto, ni documentación, ni beta. Hay una tesis y unas declaraciones.

**La tesis del artículo original.** Un agente no trae atención humana, trae **intención estructurada**: «busco un vuelo a Lisboa, menos de 200 euros, salida el viernes». Esa petición vale mucho para un anunciante. En lugar de competir por la atención de una persona, una oferta competiría por entrar en la lista de candidatos del agente; el autor lo llama *machine consideration*. Y Cloudflare, por estar entre el agente y el sitio, «opera la puerta».

**Lo que ha dicho Prince.** En el turno de preguntas de la llamada de noviembre describió cómo lo imagina. Un agente llega a una web de viajes y cuenta que busca vacaciones en Hawái para una familia de cuatro. La web podría dejarle pasar gratis a cambio de esa información, y eso abriría oportunidades de publicidad. Es su visión, formulada como hipótesis en una llamada con analistas. No es un producto anunciado.

**Mi lectura, como preguntas abiertas.** No sé si la publicidad para agentes funcionará, y creo que nadie lo sabe todavía. Estas son las dudas que me parecen honestas:

- **¿Un agente «ve» un anuncio?** Un humano se distrae; un agente optimiza contra unas instrucciones. Si el anuncio no encaja con lo que pidió el usuario, lo descartará.
- **¿A quién sirve el agente?** Si el usuario sospecha que su agente recomienda lo que alguien ha pagado, deja de confiar en él. La transparencia tiene que estar en el diseño, no añadida después.
- **¿Dónde se coloca el anuncio?** Puede ir en la respuesta del sitio, en la del asistente o en ninguna parte. El asistente tiene su propio interés en quedarse ese espacio.

El artículo original separa bien dos flujos que conviene no mezclar: en los pagos, el dinero va del agente al editor; en la publicidad, del anunciante al editor. Son negocios distintos con incentivos distintos.

## Lo que juega a favor y lo que está por resolver

**A favor**, con datos públicos:

- **Está en el camino.** Prince dijo en la llamada de 2025 que más del 20 % de la web está detrás de Cloudflare y que alrededor del 80 % de las empresas de IA líderes la conocen y la usan.
- **Tiene las piezas encadenadas.** Identidad (Web Bot Auth), control (AI Crawl Control), cobro (`402`, x402) y una plataforma donde construir agentes (Workers, Agents SDK).
- **Apuesta por un estándar abierto.** x402 vive ya en la Linux Foundation, no en un repositorio propio.

**Por resolver**, a mi juicio:

- **Adopción.** Todo lo que cobra está en beta, y Monetization Gateway solo en EE. UU. Un mercado necesita compradores. Sin agentes que acepten pagar, un `402` es solo un bloqueo con otro nombre.
- **Otros protocolos.** Google presentó en septiembre de 2025 [AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol), un protocolo de pagos para agentes con más de 60 organizaciones, entre ellas Mastercard, American Express, PayPal y Coinbase. AP2 tiene además una extensión para x402, y Google, Stripe, Visa y Mastercard están en la x402 Foundation. Un estándar compartido es bueno para el ecosistema, pero también significa que nadie tiene el carril en exclusiva.
- **Dependencia de Coinbase y de las stablecoins.** Hoy Monetization Gateway liquida en USDC sobre Base vía Coinbase. Para muchas empresas europeas eso abre preguntas de contabilidad, fiscalidad y cumplimiento que una tarjeta no plantea.
- **Regulación.** Cobrar por acceso automatizado toca derechos de autor, protección de datos, servicios de pago y, si llega la publicidad, normas de transparencia comercial. Cada país tiene sus reglas.
- **Medición.** En Pay Per Use el uso lo declara el comprador. Funciona si hay confianza o auditoría. Es el mismo problema que ha tenido siempre la publicidad digital.
- **Neutralidad.** Si el mismo actor controla el acceso y además cobra por él, agentes y editores querrán reglas claras de trato igual.

## Qué puedes hacer hoy

**Si publicas contenido:**

1. **Mira antes de decidir.** Abre AI Crawl Control y mira una semana de datos: quién entra, qué lee y quién se salta tu `robots.txt`. Está en todos los planes. Tienes los pasos en [la guía de AI Crawl Control](/blog/cloudflare-ai-crawl-control-guia).
2. **Separa a quien te trae visitas de quien no.** Permite los crawlers de búsqueda y asistentes que enlazan. Decide caso por caso con los que solo entrenan modelos.
3. **Ponle precio a tu contenido aunque no cobres aún.** Piensa qué vale un artículo de archivo frente a uno de hoy. Si entras en la beta de pay per crawl o de Pay Per Use, ya tendrás la cifra.

**Si tienes una API o una herramienta MCP:**

1. **Prueba x402 en un entorno de test.** Cloudflare publicó un *playground* con USDC de la testnet de Base. Con el [Agents SDK](/blog/cloudflare-agents-sdk-guia) puedes exponer herramientas de pago y construir un agente que pague.
2. **Diseña el precio por petición.** Monetization Gateway encaja cuando cada llamada es el uso. Si tu API corre en [Workers](/blog/cloudflare-workers-guia), puedes hacer que tu origen fije el precio de cada petición.
3. **Controla el gasto de tus propios agentes.** Si tus agentes llaman a modelos, [AI Gateway](/blog/cloudflare-ai-gateway-guia) te da analítica de costes, registros, límites de peticiones y caché.

**En cualquier caso:** firma tus bots con Web Bot Auth si operas un agente o un crawler. Ser identificable es la condición para que un editor quiera cobrarte en vez de bloquearte.

Las piezas de pago ya se pueden probar, casi todas en beta. Lo que falta es uso real: agentes que paguen y editores que cobren a escala. La publicidad para agentes, hoy, es una pregunta abierta.

## Fuentes

- Artículo original: [«Cloudflare's Fourth Act Is Ads and Payments»](http://viggy28.dev/article/cloudflare-fourth-act-ads-payments/), viggy28.dev, 6 de noviembre de 2026.
- Cloudflare, [transcripción corregida de la llamada de resultados del Q2 2025](https://www.cloudflare.net/files/doc_financials/2025/q2/CORRECTED-TRANSCRIPT_-Cloudflare-Inc-NET-US-Q2-2025-Earnin.pdf), 31 de julio de 2025.
- [Transcripción de la llamada de resultados del Q3 2026](https://stockanalysis.com/stocks/net/transcripts/726816-q3-2026/), 5 de noviembre de 2026.
- Blog de Cloudflare: [AI Audit](https://blog.cloudflare.com/cloudflare-ai-audit-control-ai-content-crawlers/) (23-9-2024), [pay per crawl](https://blog.cloudflare.com/introducing-pay-per-crawl/) (1-7-2025), [signed agents](https://blog.cloudflare.com/signed-agents/) (28-8-2025), [x402 Foundation](https://blog.cloudflare.com/x402/) (23-9-2025), [Monetization Gateway](https://blog.cloudflare.com/monetization-gateway-beta/) (30-9-2026), [Pay Per Use](https://blog.cloudflare.com/pay-per-use/) (30-9-2026).
- Documentación de Cloudflare: [AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/), [pay per crawl](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/what-is-pay-per-crawl/), [Verified bots](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/), [AI Gateway](https://developers.cloudflare.com/ai-gateway/).
- Linux Foundation, [lanzamiento operativo de la x402 Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications), 14 de julio de 2026.
- Google Cloud, [Agent Payments Protocol (AP2)](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol), 16 de septiembre de 2025.
