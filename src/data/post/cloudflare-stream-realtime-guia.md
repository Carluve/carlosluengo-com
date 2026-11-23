---
publishDate: 2026-06-23T09:00:00Z
draft: false
image: 'media:blog/cloudflare-stream-realtime-guia/portada.png'
title: 'Stream y Realtime: vídeo y comunicación en tiempo real'
excerpt: 'Serie Cloudflare, parte 25. Cómo subir, codificar y servir vídeo con Cloudflare Stream (subidas directas, reproductor, URLs firmadas y directos por RTMPS, SRT o WHIP), cómo montar llamadas con Realtime SFU, TURN y RealtimeKit, y cuánto cuesta cada pieza.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'stream'
  - 'realtime'
  - 'webrtc'
  - 'video'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 25 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Servir un MP4 desde [R2](/blog/cloudflare-r2-guia) funciona hasta que alguien lo abre con el móvil en el metro. Hace falta codificarlo en varias calidades y adaptarlo a la red de cada espectador. Una videollamada es otro problema: necesita menos de un segundo de latencia y conexiones que atraviesen cualquier NAT. Para lo primero está **Stream**; para lo segundo, **Realtime**.

## Qué es

**Stream** codifica, guarda y sirve vídeo, con su reproductor o con HLS/DASH en el tuyo. No necesitas un dominio en Cloudflare.

- **Bajo demanda.** Subida desde tu servidor, desde una URL o directamente desde el navegador de tus usuarios (*Direct Creator Uploads*).
- **Directos.** Un *live input* recibe por **RTMPS** o **SRT** y se reproduce por HLS/DASH, con grabación si la activas. O recibe por **WHIP** y se reproduce por **WHEP**, con menos de medio segundo de latencia (GA desde el 15 de octubre de 2026).
- **Control de acceso.** URLs firmadas con caducidad y lista de dominios que pueden incrustar el vídeo.

**Realtime** son las piezas para comunicación de muchos a muchos sobre WebRTC:

- **Realtime SFU.** Un *Selective Forwarding Unit* gestionado: cada participante publica sus pistas una vez y el SFU las reenvía a quien se suscriba. La señalización y los permisos los pones tú.
- **TURN.** Un relé anycast para cuando un NAT o un cortafuegos impide la conexión directa.
- **RealtimeKit.** Llamadas con SDK e interfaz ya hechos, grabación y transcripción opcionales. Es la opción recomendada si no conoces WebRTC.

**Planes.** Stream necesita una suscripción de pago, salvo que tengas una zona Pro o Business, que incluye 100 minutos de almacenamiento y 10.000 de entrega. Pasarse de la cuota de almacenamiento solo es posible en **Enterprise**. Realtime se paga por uso, con una cuota incluida en todas las cuentas, también en las Free.

## Casos de uso

- **Cursos.** Los profesores suben vídeos desde el navegador y solo los alumnos con sesión los ven, con URLs firmadas.
- **Eventos.** Una conferencia emitida desde OBS por RTMPS, con grabación. O una subasta por WHIP, donde un segundo de retraso importa.
- **Videollamadas.** Con RealtimeKit si quieres la interfaz hecha; con el SFU si la quieres a medida.

## Arquitectura

![Arriba, Stream: subida o directo, Worker que firma, codificación y entrega por reproductor, HLS/DASH o WHEP. Abajo, Realtime: participantes, tu backend, SFU, TURN y RealtimeKit. Debajo, precios](media:blog/cloudflare-stream-realtime-guia/00-arquitectura.png)

**Bajo demanda.** Tu backend pide una URL de subida de un solo uso, el navegador sube el fichero y Stream lo codifica hasta dejarlo en `ready`. Si el vídeo exige firma, tu backend genera un token y el reproductor lo usa en lugar del ID.

**En directo.** Por RTMPS o SRT, Stream empaqueta HLS/DASH y, con `recording.mode` en `automatic`, graba; la grabación está lista unos 60 segundos después de acabar. Por WHIP, la emisión solo se ve por WHEP y no se graba.

**Realtime.** El navegador habla con **tu backend**, que guarda el App Secret y llama a la API del SFU. El SFU no tiene salas ni presencia: eso lo pones tú, por ejemplo con un [Durable Object](/blog/cloudflare-durable-objects-guia) por sala. Si un participante no puede conectar directamente, el tráfico pasa por TURN.

## Implementación paso a paso

Stream y Realtime son productos de cuenta, no de zona. La captura es de mi cuenta, en tema claro; los formularios se cancelaron sin guardar nada.

### 1. Crea un live input

En **Stream › Live inputs**, el botón de crear abre un formulario con el nombre y la grabación. Sin suscripción a Stream, el panel te pide comprarla antes.

![Formulario Create Live Input: nombre de ejemplo directo-demo, grabación HLS/DASH, HLS de baja latencia, borrado automático y URL firmadas](media:blog/cloudflare-stream-realtime-guia/01-panel.png)

El input creado muestra la URL RTMPS, la clave, los datos SRT y la URL WHIP. **La clave y la URL WHIP son credenciales**: quien las tenga puede emitir. Por RTMPS o SRT, Stream exige H.264 y AAC, entre 2 y 14 Mbps, con un fotograma clave cada 2 a 10 segundos.

### 2. Subidas directas desde un Worker

Desde mayo de 2026, Stream tiene *binding* para [Workers](/blog/cloudflare-workers-guia): crea subidas y firma tokens sin poner un token de API en el código. En `wrangler.jsonc`:

```jsonc
{
  "stream": { "binding": "STREAM" }
}
```

Este Worker da una URL de subida, firma un token de reproducción y entrega credenciales TURN. La clave TURN va como secreto (`wrangler secret put TURN_KEY_ID` y `TURN_KEY_API_TOKEN`).

```ts
interface Env {
  STREAM: StreamBinding;
  TURN_KEY_ID: string;
  TURN_KEY_API_TOKEN: string;
}

const ID_VIDEO = /^[a-z0-9]{32}$/i;
const error = (msg: string, status: number) =>
  Response.json({ error: msg }, { status });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    // Comprueba aquí la sesión del usuario. Sin sesión válida: 401.

    if (req.method === "POST" && url.pathname === "/api/subida") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return error("JSON no válido", 400);
      }
      const duracion = (body as { duracion?: unknown } | null)?.duracion;
      if (typeof duracion !== "number" || !Number.isInteger(duracion) ||
          duracion < 1 || duracion > 3600) {
        return error("duracion debe ser un entero entre 1 y 3600", 400);
      }
      const subida = await env.STREAM.createDirectUpload({
        maxDurationSeconds: duracion,
        requireSignedURLs: true,
        expiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      return Response.json({ uploadURL: subida.uploadURL, id: subida.id });
    }

    if (req.method === "GET" && url.pathname === "/api/token") {
      const id = url.searchParams.get("video");
      if (!id || !ID_VIDEO.test(id)) return error("video no válido", 400);
      // Comprueba aquí que este usuario puede ver este vídeo.
      try {
        const token = await env.STREAM.video(id).generateToken();
        return Response.json({ token });
      } catch {
        return error("vídeo no encontrado", 404);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/turn") {
      const r = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: 3600 }),
        },
      );
      if (r.status !== 201) return error("TURN no disponible", 502);
      let datos: unknown;
      try {
        datos = await r.json();
      } catch {
        return error("respuesta TURN no válida", 502);
      }
      const ice = (datos as { iceServers?: unknown } | null)?.iceServers;
      if (!Array.isArray(ice)) return error("respuesta TURN no válida", 502);
      return Response.json({ iceServers: ice },
        { headers: { "Cache-Control": "no-store" } });
    }

    return error("no encontrado", 404);
  },
} satisfies ExportedHandler<Env>;
```

- `maxDurationSeconds` se **reserva** de tu almacenamiento al crear la URL. Al procesar el vídeo cuenta la duración real; si el enlace caduca sin usarse, se libera todo.
- La subida básica admite hasta **200 MB**. Por encima hay que usar **tus** (reanudable), que el binding aún no crea: se hace con la API REST (`POST /accounts/{account_id}/stream?direct_user=true`).
- El navegador envía el fichero a `uploadURL` como formulario, en el campo `file`.

### 3. Reprodúcelo con firma

El token sustituye al ID en la URL del reproductor. `<CODE>` es tu código de cliente, que aparece en el panel de Stream:

```html
<iframe
  src="https://customer-<CODE>.cloudflarestream.com/<TOKEN>/iframe"
  title="Vídeo del curso"
  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
></iframe>
```

Con tu propio reproductor, el manifiesto sigue el mismo patrón: `/<TOKEN>/manifest/video.m3u8`. Para limitar en qué dominios se incrusta, usa `allowedOrigins`; una lista vacía permite cualquiera.

### 4. Crea una app del SFU

En **Realtime › Serverless SFU** se crea una app, que da un **App ID** y un **App Secret**. El secreto solo vive en tu backend.

El backend llama a `https://rtc.live.cloudflare.com/v1` con `Authorization: Bearer <App Secret>`. Crea una sesión con `POST /apps/{appId}/sessions/new` y publica o se suscribe con `POST /apps/{appId}/sessions/{sessionId}/tracks/new`. Para publicar, la pista va con `location: "local"` y un `trackName`; para suscribirse, con `location: "remote"`, el `sessionId` del que publica y el mismo `trackName`. Conocer un ID de sesión **no da permiso**: tu backend decide quién puede pedir qué. En [realtime-examples](https://github.com/cloudflare/realtime-examples) hay una sala de vídeo completa.

### 5. Crea una clave TURN

La clave TURN también se crea en el panel de Realtime. Es un secreto de larga duración que nunca llega al navegador: sirve para generar credenciales cortas, como hace la ruta `/api/turn` del paso 2.

El `ttl` debe superar la llamada más larga que esperes; una credencial se puede revocar antes de que caduque. Puedes tener hasta 1.000 claves por cuenta: usa una por entorno.

Con **RealtimeKit** te ahorras todo esto: tu backend crea una reunión, añade participantes con un *preset* (anfitrión, espectador…) y pasa al navegador su `authToken`.

### Lo mismo, como código

Con el proveedor de Terraform (v5), un live input con grabación, una app del SFU y una clave TURN:

```hcl
resource "cloudflare_stream_live_input" "evento" {
  account_id                  = var.account_id
  enabled                     = true
  meta                        = jsonencode({ name = "evento-junio" })
  delete_recording_after_days = 45
  recording = {
    mode                = "automatic"
    require_signed_urls = true
    allowed_origins     = ["example.com"]
  }
}

resource "cloudflare_calls_sfu_app" "produccion" {
  account_id = var.account_id
  name       = "sfu-produccion"
}

resource "cloudflare_calls_turn_app" "produccion" {
  account_id = var.account_id
  name       = "turn-produccion"
}
```

El token necesita *Stream Write* y *Calls Write*. El `secret` del SFU y la `key` de TURN quedan en el *state* de Terraform: guárdalo cifrado y con acceso restringido.

## Cómo comprobarlo

Pide una URL de subida (con la sesión que exija tu Worker) y sube un vídeo de prueba:

```bash
curl -s -X POST https://videos.example.com/api/subida \
  -H "Content-Type: application/json" -d '{"duracion": 120}'

curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -F file=@prueba.mp4 "<uploadURL>"
# 200
```

Cuando `readyToStream` es `true`, el vídeo ya se puede ver:

```bash
curl -s https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/stream/$VIDEO_ID \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result.readyToStream'
```

Sin token, el reproductor no debe cargar; con el de `/api/token`, sí. En una llamada, `chrome://webrtc-internals` muestra si los candidatos ICE son de tipo `relay` (TURN).

## Límites y precios

| | Stream | Realtime SFU y TURN | RealtimeKit |
|---|---|---|---|
| Se paga por | Minutos almacenados y entregados | GB de salida | Minutos de participante |
| Precio | 5 $ por 1.000 min almacenados (prepago, al mes); 1 $ por 1.000 min entregados | 0,05 $/GB | 0,002 $/min (vídeo); 0,0005 $/min (solo audio) |
| Incluido | 100 min almacenados y 10.000 entregados con zona Pro o Business | 1.000 GB al mes entre SFU y TURN | 10.000 min de cada tipo al mes |
| Gratis | Subida, codificación y salida de datos | Entrada al SFU | Crear reuniones y tokens |

- **Stream cobra por duración, no por tamaño.** Las calidades extra y los vídeos con error no cuentan.
- **Sin almacenamiento libre no puedes subir** ni emitir, salvo en **Enterprise**.
- **Ficheros de hasta 30 GB** y hasta 120 vídeos codificándose a la vez. Los directos se graban hasta siete días.
- **WHIP/WHEP** se cobra como minutos entregados y no consume almacenamiento. Aún no admite grabación, HLS, *simulcast* ni contador de espectadores.
- **El tráfico entre TURN y el SFU, o entre TURN y WHIP/WHEP, no se cobra dos veces.**
- **Grabaciones de RealtimeKit:** 100 minutos incluidos y luego 0,010 $/min. La transcripción se factura como Workers AI.
- **Tokens:** la API `/token` de Stream firma tokens de una hora; para más de 1.000 al día, fírmalos tú con una clave de firma (24 horas como máximo). Los de RealtimeKit valen 100 días por defecto; desde noviembre de 2026 se pueden limitar con `not_before` y `expires_on`.

## Documentación oficial

- [Stream](https://developers.cloudflare.com/stream/), [precios](https://developers.cloudflare.com/stream/pricing/) y [límites (FAQ)](https://developers.cloudflare.com/stream/faq/)
- [Direct Creator Uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/) y [binding para Workers](https://developers.cloudflare.com/stream/manage-video-library/bindings/)
- [URLs firmadas y orígenes permitidos](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)
- [Directos con RTMPS y SRT](https://developers.cloudflare.com/stream/stream-live/start-stream-live/) y [WebRTC con WHIP y WHEP](https://developers.cloudflare.com/stream/webrtc/)
- [Realtime SFU](https://developers.cloudflare.com/realtime/sfu/get-started/), [API de conexión](https://developers.cloudflare.com/realtime/sfu/api/) y [precios del SFU y TURN](https://developers.cloudflare.com/realtime/sfu/pricing/)
- [Credenciales TURN](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
- [RealtimeKit](https://developers.cloudflare.com/realtime/realtimekit/) y [precios](https://developers.cloudflare.com/realtime/realtimekit/platform/pricing/)
- Changelog: [binding de Stream](https://developers.cloudflare.com/changelog/post/2026-05-07-stream-workers-binding/), [WebRTC en Stream, GA](https://developers.cloudflare.com/changelog/post/2026-10-15-stream-live-webrtc-ga/) y [tokens de RealtimeKit](https://developers.cloudflare.com/changelog/post/2026-11-12-realtimekit-auth-token-validity/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Observabilidad: logs, trazas y Logpush.

## También te puede interesar

- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Durable Objects: estado y coordinación en el borde](/blog/cloudflare-durable-objects-guia)
- [R2: almacenamiento de objetos sin costes de salida](/blog/cloudflare-r2-guia)
