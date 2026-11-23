---
publishDate: 2026-06-02T09:00:00Z
draft: false
image: 'media:blog/cloudflare-containers-guia/portada.png'
title: 'Containers y Sandboxes: contenedores junto a tus Workers'
excerpt: 'Serie Cloudflare, parte 22. Qué son Cloudflare Containers y Sandboxes, por qué cada contenedor vive detrás de un Durable Object, cómo se arranca, se duerme y se escala, cómo ejecutar código que no es tuyo sin darle Internet ni secretos, y cuánto cuesta en Workers Paid.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'containers'
  - 'sandbox'
  - 'workers'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 22 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Un [Worker](/blog/cloudflare-workers-guia) ejecuta JavaScript, Python o WebAssembly. Pero `ffmpeg`, un binario en Go, un `npm test` o el código que acaba de escribir un modelo necesitan Linux. Containers te lo da sin salir de Workers.

## Qué es

**Containers** ejecuta una imagen `linux/amd64` en la red de Cloudflare, cada instancia en una microVM Firecracker con su propio kernel y red. La arranca tu código, no un orquestador.

La clave: **cada contenedor pertenece a un [Durable Object](/blog/cloudflare-durable-objects-guia)**. Tu Worker lo llama por su nombre y el Durable Object controla el contenedor con `this.ctx.container`: lo arranca, le reenvía peticiones, ejecuta comandos y lo para. Mismo nombre, mismo contenedor.

**Sandboxes** es usar Containers para ejecutar código que no es de fiar: el de un agente de IA, un usuario o un repositorio ajeno. El paquete `@cloudflare/sandbox` 1.0 añade `Files` (ficheros), `S3Mount` (montar R2) y `DirectoryBackup` (copias en R2). Si el código es solo JavaScript, la alternativa son los Dynamic Workers.

Antes de seguir un tutorial antiguo, ten en cuenta lo que cambió en 2026:

- **13 de abril:** disponibilidad general de Containers y Sandboxes.
- **30 de septiembre:** política de planificación `durable_object` (beta pública), en la que tu Durable Object elige imagen y tamaño en cada arranque; `default` queda obsoleta. Sale el Sandbox SDK 1.0; la 0.x recibe correcciones hasta el 31 de diciembre de 2026.
- La clase `Container` de `@cloudflare/containers`, con su `sleepAfter`, está obsoleta. Hoy se usa `this.ctx.container` con `setInactivityTimeout()`.

**Planes.** Containers y Sandboxes solo están en **Workers Paid** (5 $ al mes por cuenta). No hay nada exclusivo de Enterprise: los límites de cuenta son valores por defecto y se amplían pidiéndolo a soporte o a tu equipo de cuenta.

## Casos de uso

- **Lo que no cabe en un Worker:** `ffmpeg`, binarios nativos, Python con extensiones en C.
- **Un backend por usuario o sesión:** cada nombre es una instancia aislada.
- **Código generado por IA**, ejecutado sin Internet y sin secretos.
- **Agentes de código y previews:** clonar, instalar, pasar tests y enseñar el servidor de desarrollo.
- **Trabajos por lotes** desde un cron, una [cola](/blog/cloudflare-queues-guia) o un [Workflow](/blog/cloudflare-workflows-guia).

## Arquitectura

![Arquitectura: la petición llega al Worker, que autentica y elige un nombre con getByName; el Durable Object arranca el contenedor con ctx.container.start, reenvía tráfico con getTcpPort, ejecuta comandos con exec y fija la inactividad; el contenedor es una microVM con disco efímero; debajo, el ciclo de vida y la tabla de tipos de instancia](media:blog/cloudflare-containers-guia/00-arquitectura.png)

1. Tu **Worker** autentica, valida y decide el nombre.
2. Llama al **Durable Object** con ese nombre. Obtenerlo no arranca nada.
3. El Durable Object llama a `ctx.container.start()`, que vuelve **antes** de que el contenedor esté listo: comprueba que el puerto responde.
4. Cloudflare elige una ubicación con la imagen preparada, **no necesariamente la del Durable Object**, y mantiene ahí la instancia mientras viva.
5. El contenedor recibe HTTP o WebSocket por `getTcpPort(puerto).fetch()`, o comandos por `exec()`.

Lo que cambia cómo diseñas:

- **Arranque en frío:** de 1 a 3 segundos, según la imagen y el punto de entrada.
- **Parada:** `setInactivityTimeout()` lo mantiene vivo hasta 6 horas tras la última actividad del Durable Object; sin él, se para enseguida. Lo que corre *dentro* no cuenta como actividad. Al parar llega `SIGTERM`.
- **Disco efímero:** cada arranque parte de la imagen. Para conservar ficheros, usa *snapshots* (beta) o [R2](/blog/cloudflare-r2-guia).
- **Escalado:** no hay autoescalado. Escalas con más nombres: uno por usuario, o uno al azar de un grupo fijo.

## Implementación paso a paso

Montamos un **ejecutor de código**: recibe JavaScript, lo ejecuta en un contenedor sin Internet y devuelve la salida. Necesitas Workers Paid y Docker en tu máquina: `wrangler deploy` construye la imagen localmente.

### 1. La sección Containers del panel

**Workers & Pages › Containers** muestra estado, métricas y logs. Antes del primer despliegue está vacía: los contenedores se crean con Wrangler.

![Página de Containers sin contenedores: el panel propone crear el primero con la plantilla oficial de npm create cloudflare](media:blog/cloudflare-containers-guia/01-panel.png)

### 2. La imagen y la configuración

Crea un proyecto de Worker en TypeScript e instala el paquete de Sandbox con la versión exacta que usará la imagen:

```bash
npm create cloudflare@latest -- caja-de-arena --category=hello-world --type=hello-world --lang=ts
cd caja-de-arena
npm i @cloudflare/sandbox@1.0.1
```

El `Dockerfile` copia el binario auxiliar de `@cloudflare/sandbox` (misma versión) y `sleep infinity` mantiene vivo el contenedor:

```dockerfile
FROM node:24-trixie-slim
COPY --from=docker.io/cloudflare/sandbox:1.0.1 /usr/local/bin/sandbox-shim /usr/local/bin/sandbox-shim
RUN mkdir /workspace
CMD ["sleep", "infinity"]
```

En `wrangler.jsonc`, el contenedor se asocia a la clase `Caja`, que es un Durable Object con SQLite:

```jsonc
{
  "name": "caja-de-arena",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-23",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "containers": [{
    "class_name": "Caja",
    "scheduling_policy": "durable_object",
    "images": { "workspace": { "dockerfile": "./Dockerfile" } }
  }],
  "durable_objects": { "bindings": [{ "name": "CAJA", "class_name": "Caja" }] },
  "exports": { "Caja": { "type": "durable-object", "storage": "sqlite" } }
}
```

### 3. El Durable Object y el Worker

El Durable Object arranca el contenedor sin Internet, escribe el código y lo ejecuta. El tiempo y la salida se limitan **dentro** con `timeout` y `head`, porque matar el proceso desde fuera no detiene sus hijos.

```ts
import { DurableObject } from "cloudflare:workers";
import { Files } from "@cloudflare/sandbox";

const INACTIVIDAD_MS = 10 * 60 * 1000;
const MAX_CODIGO = 64 * 1024;
const NOMBRE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export class Caja extends DurableObject<Env> {
  private files: Files;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const c = ctx.container;
    if (!c) throw new Error("No hay contenedor configurado");
    this.files = new Files(c);
    if (c.running) void ctx.blockConcurrencyWhile(() => c.setInactivityTimeout(INACTIVIDAD_MS));
  }

  async ejecutar(codigo: string) {
    const c = this.ctx.container!;
    if (!c.running) {
      c.start({ image: c.images.workspace, instance: "lite", enableInternet: false });
      await c.setInactivityTimeout(INACTIVIDAD_MS);
    }
    await this.files.writeFile("/workspace/main.js", codigo);
    const proc = await c.exec(
      ["bash", "-c", "set -o pipefail; timeout -s KILL 10 node main.js 2>&1 | head -c 65536"],
      { cwd: "/workspace" },
    );
    const out = await proc.output();
    return { exitCode: out.exitCode, salida: new TextDecoder().decode(out.stdout) };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/run") {
      return new Response("Not found", { status: 404 });
    }
    const auth = request.headers.get("Authorization") ?? "";
    if (!env.API_TOKEN || !(await iguales(auth, `Bearer ${env.API_TOKEN}`))) {
      return new Response("Unauthorized", { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("JSON no válido", { status: 400 });
    }
    const { sandbox, codigo } = (body ?? {}) as Record<string, unknown>;
    if (typeof sandbox !== "string" || !NOMBRE.test(sandbox)) {
      return new Response("Nombre de sandbox no válido", { status: 400 });
    }
    if (typeof codigo !== "string" || codigo.length === 0 || codigo.length > MAX_CODIGO) {
      return new Response("Código vacío o demasiado largo", { status: 400 });
    }
    try {
      return Response.json(await env.CAJA.getByName(sandbox).ejecutar(codigo));
    } catch (err) {
      console.error(err);
      return new Response("Error al ejecutar", { status: 502 });
    }
  },
} satisfies ExportedHandler<Env>;

// Compara en tiempo constante
async function iguales(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all(
    [a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))),
  );
  return crypto.subtle.timingSafeEqual(ha, hb);
}
```

Tres reglas de la documentación:

- **El sandbox es la unidad mínima de confianza.** Dentro, todo proceso tiene capacidades de `root`. Usa un sandbox por usuario o tarea y deriva el nombre de la identidad autenticada, no de lo que mande el cliente.
- **Nada de secretos dentro.** Si el código debe llamar a una API autenticada, intercepta su salida desde el Worker (`interceptOutboundHttps()`) y añade ahí la credencial.
- **La salida también es entrada no fiable.** Valídala antes de guardarla o mostrarla.

Genera los tipos y guarda el secreto, que nunca va en el código:

```bash
npx wrangler types
npx wrangler secret put API_TOKEN
```

O en el panel: **Settings › Variables and Secrets**, tipo **Secret**.

### 4. Desplegar

```bash
npx wrangler deploy
```

Wrangler sube el Worker y la imagen al registro de Cloudflare. Tras el **primer** despliegue, espera unos minutos: mientras se aprovisionan los contenedores, las llamadas pueden fallar.

### 5. Previews: abrir un servidor del sandbox

Un sandbox no tiene puertos públicos. Tu Worker enruta, por ejemplo, `/previews/<nombre>/` al Durable Object, y este reenvía al puerto:

```ts
// En el Durable Object, después de comprobar que el servidor responde
return this.ctx.container!.getTcpPort(8080).fetch(request);
```

El servidor debe escuchar en `0.0.0.0`. Autentica antes de reenviar y sirve las previews desde **otro dominio**: en el tuyo, la página podría usar tus cookies.

### Lo mismo, como código

La configuración vive en `wrangler.jsonc`; la documentación de Containers no ofrece recurso de Terraform. Con Wrangler:

```bash
npx wrangler containers list                 # aplicaciones y estado
npx wrangler containers instances <APP_ID>   # instancias
npx wrangler containers images list          # imágenes del registro
npx wrangler containers ssh <INSTANCE_ID>    # entrar en una instancia viva
```

`wrangler dev` ejecuta el contenedor en tu Docker local.

## Cómo comprobarlo

```bash
curl -s https://caja-de-arena.<tu-subdominio>.workers.dev/run \
  -H "Authorization: Bearer $API_TOKEN" \
  --json '{"sandbox":"ada","codigo":"console.log(process.version)"}'
# {"exitCode":0,"salida":"v24…\n"}
```

- Con `"codigo":"fetch('https://example.com').then(r => console.log(r.status))"` debe salir un `exitCode` distinto de 0: no hay Internet.
- Sin `Authorization`: **401**. Con un cuerpo que no es JSON: **400**.
- La primera llamada a un nombre nuevo tarda más (arranque en frío); las siguientes reutilizan la instancia.
- Los logs están en **Workers & Pages › Containers** durante siete días.

## Límites y precios

Tipos de instancia predefinidos (también puedes definir uno a medida):

| Tipo | vCPU | Memoria | Disco |
|---|---|---|---|
| lite | 1/16 | 256 MiB | 2 GB |
| basic | 1/4 | 1 GiB | 4 GB |
| standard-1 | 1/2 | 4 GiB | 8 GB |
| standard-2 | 1 | 6 GiB | 12 GB |
| standard-3 | 2 | 8 GiB | 16 GB |
| standard-4 | 4 | 12 GiB | 20 GB |

Límites por cuenta, ampliables bajo petición:

- Por instancia: hasta 4 vCPU, 12 GiB de memoria y 20 GB de disco.
- En paralelo: 15.000 vCPU, 60 TiB de memoria y 300 TB de disco.
- Imagen: como máximo, el disco de su tipo de instancia; 50 GB de imágenes por cuenta.
- Snapshots: hasta 20 GB, caducan a los 30 días. Gratis durante la beta.
- Cuerpo de cada petición HTTP saliente: 100 MiB.

Precio en Workers Paid, facturado cada 10 ms con la instancia en marcha:

| Recurso | Incluido al mes | Después |
|---|---|---|
| Memoria | 25 GiB-hora | 0,0000025 $ por GiB-segundo |
| CPU | 375 vCPU-minuto | 0,000020 $ por vCPU-segundo |
| Disco | 200 GB-hora | 0,00000007 $ por GB-segundo |
| Salida (Norteamérica y Europa) | 1 TB | 0,025 $ por GB |
| Salida (Oceanía, Corea, Taiwán) | 500 GB | 0,05 $ por GB |
| Salida (resto) | 500 GB | 0,04 $ por GB |

- **CPU por uso real; memoria y disco por lo aprovisionado.** Un contenedor ocioso en marcha sigue costando: ajusta la inactividad.
- Se suma el uso del Worker y del Durable Object.
- Desde el 1 de diciembre de 2026, los logs se facturan con los precios de Cloudflare Observability.

## Documentación oficial

- [Containers](https://developers.cloudflare.com/containers/), [ciclo de vida](https://developers.cloudflare.com/containers/concepts/architecture/) y [API del Durable Object](https://developers.cloudflare.com/containers/api/durable-object-container/)
- [Políticas de planificación](https://developers.cloudflare.com/containers/configuration/scheduling-policy/) y [migrar desde la clase Container](https://developers.cloudflare.com/containers/guides/migrate-to-durable-object-container-api/)
- [Sandboxes](https://developers.cloudflare.com/sandbox/), [vida de un sandbox](https://developers.cloudflare.com/sandbox/concepts/lifetime/), [seguridad](https://developers.cloudflare.com/sandbox/concepts/security/) y [previews](https://developers.cloudflare.com/sandbox/previews/)
- [`@cloudflare/sandbox`](https://developers.cloudflare.com/sandbox/reference/) y [comandos de Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/containers/)
- [Límites](https://developers.cloudflare.com/containers/platform/limits/), [precios](https://developers.cloudflare.com/containers/platform/pricing/) y [FAQ](https://developers.cloudflare.com/containers/faq/)
- [Changelog de Containers](https://developers.cloudflare.com/changelog/product/containers/) y [Sandbox SDK 1.0](https://developers.cloudflare.com/changelog/post/2026-09-30-sandbox-sdk-1-0/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

**Siguiente en la serie:** Browser Run: navegadores sin interfaz en el borde.

## También te puede interesar

- [Durable Objects: estado y coordinación en el borde](/blog/cloudflare-durable-objects-guia)
- [Workers: de hola mundo a producción](/blog/cloudflare-workers-guia)
- [Workflows: procesos duraderos paso a paso](/blog/cloudflare-workflows-guia)
