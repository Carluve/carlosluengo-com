---
publishDate: 2026-05-12T09:00:00Z
draft: false
image: 'media:blog/cloudflare-queues-guia/portada.png'
title: 'Queues: mensajes y tareas en segundo plano'
excerpt: 'Serie Cloudflare, parte 19. Qué es Cloudflare Queues, cómo enviar mensajes desde un Worker y consumirlos por lotes, cómo funcionan los reintentos, los retrasos y la dead-letter queue, cómo leer una cola por HTTP desde tu servidor y qué cuesta, también en el plan Free.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'queues'
  - 'workers'
  - 'desarrollo'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 19 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Un [Worker](/blog/cloudflare-workers-guia) tiene que responder rápido. Si para contestar a un formulario tiene que mandar un correo, redimensionar una imagen y avisar a un webhook, el usuario espera a todo eso. Y si uno de los servicios falla, el trabajo se pierde. Queues separa las dos cosas: el Worker deja un mensaje en una cola y responde. Otro proceso hace el trabajo después, con reintentos.

## Qué es

Cloudflare Queues es un servicio de colas de mensajes gestionado. Tiene tres piezas:

- **Productor.** Quien escribe en la cola. Normalmente un Worker con `send()` o `sendBatch()`, pero también R2 (cuando se sube o se borra un objeto) y otros productos de Cloudflare mediante suscripciones a eventos.
- **Cola.** Guarda los mensajes y garantiza la entrega **al menos una vez**. El orden es de mejor esfuerzo, no garantizado.
- **Consumidor.** Quien procesa los mensajes. Puede ser un Worker al que la cola le **empuja** lotes (*push*) o cualquier servidor que los **pide** por HTTP (*pull*). Cada cola tiene un solo consumidor activo.

**Planes.** Queues está en el plan Workers Free desde el 4 de febrero de 2026, con todas sus funciones. La diferencia con Workers Paid está en el volumen incluido y en la retención: en Free los mensajes duran 24 horas como máximo; en Paid, 4 días por defecto y hasta 14.

## Casos de uso

- **Correos transaccionales.** El formulario encola el aviso y responde al momento. Si el proveedor de correo devuelve un `429`, el mensaje se reintenta más tarde.
- **Webhooks salientes.** Notificar a un sistema externo que a veces está caído. Con reintentos espaciados y una dead-letter queue no se pierde ningún aviso.
- **Procesar imágenes o ficheros.** Cada subida a un bucket de [R2](/blog/cloudflare-r2-guia) genera un mensaje; un consumidor crea las miniaturas o extrae los metadatos.
- **Absorber picos.** Mil peticiones en un minuto son mil mensajes que el consumidor procesa a su ritmo.

## Arquitectura

![Flujo de Cloudflare Queues: un Worker productor, las notificaciones de R2 y las suscripciones a eventos escriben en la cola; la cola entrega lotes a un Worker consumidor o a un consumidor HTTP; ack borra el mensaje, retry lo devuelve a la cola y, tras agotar los reintentos, va a la dead-letter queue. Debajo, tabla con los valores por defecto y máximos de lote, reintentos, retraso, tamaño y retención](media:blog/cloudflare-queues-guia/00-arquitectura.png)

1. El productor escribe un mensaje de hasta **128 KB**. Cuando la promesa de `send()` se resuelve, el mensaje ya está guardado en disco.
2. La cola agrupa los mensajes en **lotes**. Entrega un lote cuando se llena (`max_batch_size`, 10 por defecto, máximo 100) o cuando pasa el tiempo de espera (`max_batch_timeout`, 5 segundos por defecto, máximo 60), lo que ocurra antes.
3. El consumidor recibe el lote y confirma cada mensaje con `ack()` o lo devuelve con `retry()`. Si el handler lanza una excepción y no había confirmado nada, se reintenta **el lote entero**.
4. Tras `max_retries` intentos (3 por defecto, máximo 100), el mensaje va a la **dead-letter queue** si la tienes configurada. Si no, se borra para siempre.

Como la entrega es al menos una vez, un mensaje puede llegar dos veces. Diseña el consumidor para que repetir un mensaje no haga daño: guarda el `id` del mensaje procesado o usa una clave de idempotencia con la API externa.

## Implementación paso a paso

La captura es del formulario de creación de una cola, en tema claro, rellenado con un nombre de ejemplo y cancelado. En el texto, la cola de ejemplo es `serie-correos`.

### 1. Crea la cola

En el panel, **Queues › Create queue**. Solo hace falta un nombre. La jurisdicción (`eu`, `us` o `fedramp`) es opcional y no se puede cambiar después: si tus mensajes llevan datos personales de clientes europeos, elige `eu` desde el principio.

![Formulario Create Queue: nombre de ejemplo «envio-emails» y selector de jurisdicción en None](media:blog/cloudflare-queues-guia/01-crear-cola.png)

Desde la terminal es lo mismo:

```bash
npx wrangler queues create serie-correos
```

### 2. Revisa los ajustes de la cola

En la pestaña **Settings** de la cola están la **retención** y el **retraso de entrega** por defecto. En Free la retención está fijada en 24 horas. El retraso (de 0 a 24 horas) se aplica a todos los mensajes salvo que el productor indique otro.


### 3. Conecta productor y consumidor

El fichero `wrangler.jsonc` declara las dos cosas. Aquí el mismo Worker produce y consume, que es lo más simple para empezar:

```jsonc
{
  "name": "correos",
  "main": "src/index.ts",
  "queues": {
    "producers": [{ "queue": "serie-correos", "binding": "CORREOS" }],
    "consumers": [{
      "queue": "serie-correos",
      "max_batch_size": 20,
      "max_batch_timeout": 10,
      "max_retries": 5,
      "retry_delay": 60,
      "dead_letter_queue": "serie-correos-dlq"
    }]
  }
}
```

La DLQ no hace falta crearla antes: si no existe, Cloudflare la crea en la misma jurisdicción que la cola original. `max_concurrency` es opcional; sin él, el número de consumidores simultáneos escala solo hasta el máximo de la plataforma (250).

El productor encola y responde sin esperar al proveedor de correo:

```ts
export default {
  async fetch(req, env): Promise<Response> {
    let datos: { email?: unknown; nombre?: unknown };
    try {
      datos = await req.json();
    } catch {
      return new Response("JSON no válido", { status: 400 });
    }
    const { email, nombre } = datos;
    if (typeof email !== "string" || typeof nombre !== "string") {
      return new Response("Faltan email o nombre", { status: 400 });
    }
    await env.CORREOS.send({ tipo: "bienvenida", email, nombre });
    return new Response("Recibido", { status: 202 });
  },
```

Para varios mensajes, `sendBatch()` admite hasta 100 por llamada (256 KB en total). Los dos métodos aceptan `delaySeconds` para retrasar la entrega, hasta 24 horas:

```ts
await env.CORREOS.send(recordatorio, { delaySeconds: 3600 }); // dentro de una hora
```

El consumidor, en el mismo fichero, con confirmación por mensaje y reintento con espera creciente:

```ts
  async queue(batch, env): Promise<void> {
    for (const msg of batch.messages) {
      const r = await fetch("https://api.proveedor-correo.example/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.MAIL_TOKEN}` },
        body: JSON.stringify(msg.body),
      });
      if (r.ok) {
        msg.ack();
      } else {
        // attempts empieza en 1: espera 60 s, 120 s, 240 s…
        msg.retry({ delaySeconds: 30 * 2 ** msg.attempts });
      }
    }
  },
} satisfies ExportedHandler<Env>;
```

Tres reglas de `ack()` y `retry()`:

- La **primera** llamada sobre un mensaje gana; las siguientes se ignoran.
- Una llamada sobre un mensaje concreto manda sobre `batch.ackAll()` o `batch.retryAll()`.
- Confirma cada mensaje en cuanto termines con él. Así, si el handler falla a mitad de lote, no repites los que ya salieron bien.

El consumidor tiene 15 minutos de reloj y 30 segundos de CPU por defecto (ampliables a 5 minutos con `limits.cpu_ms`). Despliega con `npx wrangler deploy`.

### 4. Envía un mensaje de prueba desde el panel

En la pestaña **Messages** de la cola, el botón **Send** permite escribir un mensaje en texto o JSON sin tener productor. Es la forma más rápida de probar un consumidor.


### 5. Consume por HTTP desde tu servidor

Si el trabajo pesado vive fuera de Cloudflare (un servidor con una GPU, un proceso en Python), cambia el consumidor a **pull**. Primero quita el consumidor Worker (y el bloque `consumers` del `wrangler.jsonc`, o el siguiente despliegue fallará) y añade el HTTP:

```bash
npx wrangler queues consumer worker remove serie-correos correos
npx wrangler queues consumer http add serie-correos
```

Tu servidor pide lotes con un token que tenga permisos de lectura y escritura en Queues:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/queues/$QUEUE_ID/messages/pull" \
  -H "Authorization: Bearer $QUEUES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "batch_size": 10, "visibility_timeout_ms": 60000 }'
```

Cada mensaje llega con un `lease_id`. Mientras dura el *visibility timeout* (30 segundos por defecto, hasta 12 horas), nadie más recibe ese mensaje. Al terminar, confirmas o reintentas:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/queues/$QUEUE_ID/messages/ack" \
  -H "Authorization: Bearer $QUEUES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "acks": [{ "lease_id": "..." }], "retries": [{ "lease_id": "...", "delay_seconds": 600 }] }'
```

Lo que no confirmes vuelve a la cola cuando vence el plazo. Envía los mensajes como `json`, `text` o `bytes`: el tipo `v8` solo se puede leer desde un Worker. Los cuerpos `json` y `bytes` llegan en base64.

### 6. Haz que R2 escriba en la cola

Para procesar cada imagen que se sube a un bucket, crea una notificación de eventos de R2 que apunte a la cola:

```bash
npx wrangler r2 bucket notification create fotos \
  --event-type object-create --queue serie-imagenes --suffix ".jpg"
```

Cada mensaje trae `bucket`, `action` (por ejemplo `PutObject`), `eventTime` y un `object` con `key`, `size` y `eTag`. Los eventos son `object-create` (también al sobrescribir) y `object-delete`. En el panel está en **R2 › tu bucket › Settings › Event notifications › Add notification**.

Las **suscripciones a eventos** son otra cosa: eventos de la cuenta, no de objetos. Por ejemplo, `build.failed` de Workers Builds, `instance.errored` de Workflows o `bucket.created` de R2. Se crean en la pestaña **Subscriptions** de la cola:

```bash
npx wrangler queues subscription create serie-avisos --source r2 --events bucket.created
```


### Lo mismo, como código

Con el proveedor de Terraform (v5), la cola y su consumidor Worker:

```hcl
resource "cloudflare_queue" "correos" {
  account_id = var.account_id
  queue_name = "serie-correos"
  jurisdiction = "eu"
}

resource "cloudflare_queue_consumer" "correos" {
  account_id        = var.account_id
  queue_id          = cloudflare_queue.correos.queue_id
  type              = "worker"
  script_name       = "correos"
  dead_letter_queue = "serie-correos-dlq"
  settings = {
    batch_size       = 20
    max_wait_time_ms = 10000
    max_retries      = 5
    retry_delay      = 60
  }
}
```

Terraform usa otros nombres: `batch_size` y `max_wait_time_ms` (en milisegundos). Para un consumidor HTTP, `type = "http_pull"` y, en `settings`, `visibility_timeout_ms`. El token necesita *Queues Write* y *Workers Scripts Write*. Elige una sola vía para declarar el consumidor: o el bloque `consumers` de Wrangler, o Terraform.

## Cómo comprobarlo

Con `npx wrangler tail correos` ves en directo cada invocación del consumidor, sus `console.log` y sus errores.

Desde el propio Worker, `metrics()` devuelve el estado de la cola en tiempo real:

```ts
const { backlogCount, backlogBytes, oldestMessageTimestamp } = await env.CORREOS.metrics();
```

Si `backlogCount` no para de crecer, el consumidor no da abasto o está fallando. Si `oldestMessageTimestamp` se acerca a la retención (24 horas en Free), vas a perder mensajes.

El panel de la cola también muestra los mensajes pendientes (*backlog*) en tiempo real.


Para probar la DLQ, haz que el consumidor llame siempre a `retry()`. Tras `max_retries` intentos, el mensaje tiene que aparecer en `serie-correos-dlq`.

## Límites y precios

Queues se cobra por **operaciones**. Cada escritura, lectura o borrado de un trozo de 64 KB es una operación. Entregar un mensaje cuesta normalmente **tres**: escribir, leer y borrar. Cada reintento añade una lectura. No hay cargos por tráfico de salida.

| | Workers Free | Workers Paid |
|---|---|---|
| Operaciones incluidas | 10.000 al día | 1 millón al mes |
| Precio adicional | — | 0,40 $ por millón |
| Retención | 24 h, fija | 4 días por defecto, hasta 14 |
| Colas por cuenta | Hasta 10.000 | 10.000 incluidas; 0,10 $/mes cada una más |

Con 10.000 operaciones diarias, el plan Free da para unos 3.300 mensajes al día sin reintentos. Un ejemplo de la documentación en Paid: un millón de mensajes al día de menos de 64 KB son 90 millones de operaciones al mes; quitando el millón incluido, 35,60 $. Un mensaje de 127 KB cuenta doble. Workers Paid cuesta desde 5 $ al mes.

**Límites comunes a los dos planes:**

- Mensajes de hasta 128 KB, de los que unos 100 bytes son metadatos internos.
- 5.000 mensajes por segundo por cola. Por encima, `send()` devuelve `Too Many Requests`.
- Hasta 25 GB pendientes por cola. Por encima, `Storage Limit Exceeded`.
- Hasta 250 invocaciones simultáneas del consumidor (solo *push*).

## Documentación oficial

- [Queues: visión general](https://developers.cloudflare.com/queues/) y [primeros pasos](https://developers.cloudflare.com/queues/get-started/)
- [Configuración de productores y consumidores](https://developers.cloudflare.com/queues/configuration/configure-queues/) y [API de JavaScript](https://developers.cloudflare.com/queues/configuration/javascript-apis/)
- [Lotes, reintentos y retrasos](https://developers.cloudflare.com/queues/configuration/batching-retries/) y [dead-letter queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/)
- [Consumidores pull por HTTP](https://developers.cloudflare.com/queues/configuration/pull-consumers/)
- [Suscripciones a eventos](https://developers.cloudflare.com/queues/event-subscriptions/) y [eventos y esquemas](https://developers.cloudflare.com/queues/event-subscriptions/events-schemas/)
- [Notificaciones de eventos de R2](https://developers.cloudflare.com/r2/buckets/event-notifications/)
- [Ubicación de los datos (jurisdicciones)](https://developers.cloudflare.com/queues/configuration/data-location/)
- [Precios](https://developers.cloudflare.com/queues/platform/pricing/) y [límites](https://developers.cloudflare.com/queues/platform/limits/)
- Changelog: [Queues en el plan Workers Free](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/) (febrero de 2026), [métricas en tiempo real](https://developers.cloudflare.com/changelog/post/2026-04-28-improved-queues-metrics/) (abril de 2026) y [jurisdicciones](https://developers.cloudflare.com/changelog/post/2026-09-18-queues-jurisdictions/) (septiembre de 2026)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** Workflows: procesos duraderos paso a paso.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
- [Rate limiting en Cloudflare: limitar peticiones sin bloquear a tus usuarios](/blog/cloudflare-rate-limiting-guia)
