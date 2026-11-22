---
publishDate: 2026-04-07T09:00:00Z
draft: false
image: 'media:blog/cloudflare-workers-guia/portada.png'
title: 'Workers: de hola mundo a producción'
excerpt: 'Serie Cloudflare, parte 14. Qué es un Worker y por qué arranca tan rápido, cómo crearlo con C3 y Wrangler, qué va en wrangler.jsonc, cómo conectarlo a KV, D1, R2 y secretos, cuándo usar workers.dev, un Custom Domain o una ruta, cómo publicar por porcentajes y qué cabe en el plan Free.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'workers'
  - 'serverless'
  - 'desarrollo'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 14 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Hasta aquí, la serie ha tratado lo que Cloudflare hace con el tráfico que va hacia tu servidor: [DNS](/blog/cloudflare-dns-dnssec-guia), [caché](/blog/cloudflare-cdn-cache-guia), [WAF](/blog/cloudflare-waf-guia), [Access](/blog/cloudflare-access-guia). Con Workers cambia la pregunta: ¿y si el código corre en Cloudflare y no hace falta servidor?

## Qué es

Un Worker es código (JavaScript, TypeScript, Python o WebAssembly) que se ejecuta en la red de Cloudflare, en el centro de datos que recibe la petición. No eliges región ni gestionas máquinas.

La pieza clave son los **isolates de V8**, el mismo motor de JavaScript de Chrome. En lugar de levantar un contenedor o una máquina virtual por función, una sola instancia del runtime ejecuta cientos o miles de isolates, cada uno con su memoria separada. Crear un isolate cuesta muy poco, y por eso un Worker apenas tiene arranque en frío.

Tres consecuencias prácticas:

- **No guardes estado en variables globales.** Un isolate puede desaparecer en cualquier momento. El estado va en KV, D1, R2 o Durable Objects.
- **Se mide la CPU, no el tiempo de espera.** Esperar a un `fetch()` o a una consulta a la base de datos no cuenta como tiempo de CPU.
- **El código y su configuración van juntos.** Cada despliegue crea una **versión** con el código, los *bindings* y los ajustes. Por eso se puede volver atrás en segundos.

**Planes.** Workers tiene su propio plan, de cuenta y no de zona: **Workers Free** y **Workers Paid** (desde 5 $ al mes). Que tu dominio esté en el plan Free de Cloudflare no te limita aquí. Los contratos **Enterprise** se facturan según lo pactado.

## Casos de uso

- **Una API pequeña.** Un formulario de contacto, un webhook, un *endpoint* que consulta una base de datos D1. Sin servidor que parchear.
- **Una web estática o una SPA con algo de lógica.** Los ficheros se sirven como *static assets*, gratis y sin límite de peticiones, y el Worker solo responde a `/api/*`.
- **Delante de tu aplicación actual.** Con una ruta, el Worker intercepta las peticiones a tu dominio y puede reescribir cabeceras, hacer pruebas A/B o redirigir antes de llegar al origen.

## Arquitectura

![Recorrido de una petición a un Worker: el visitante llega al centro de datos más cercano por workers.dev, un Custom Domain o una ruta; los ficheros estáticos se sirven sin ejecutar código; el resto lo atiende el Worker en un isolate de V8, que usa bindings (KV, D1, R2, variables y secretos) y puede llamar al origen con fetch(); debajo, tabla con los límites de Workers Free y Workers Paid](media:blog/cloudflare-workers-guia/00-arquitectura.png)

1. La petición llega al **centro de datos más cercano** al visitante por una de tres puertas: el subdominio `workers.dev`, un **Custom Domain** o una **ruta** en una zona tuya.
2. Si el proyecto tiene **static assets** y la ruta coincide con un fichero, Cloudflare lo sirve **sin ejecutar tu código**. Esas peticiones no se cobran.
3. Si no, se ejecuta el **fetch handler** del Worker en un isolate.
4. El Worker usa sus **bindings** (`env.MI_KV`, `env.DB`, `env.API_TOKEN`…) para leer y escribir datos sin claves ni URLs en el código.
5. Si va detrás de una **ruta**, puede pasar la petición al **origen** con `fetch(request)`.

Las tres puertas no son equivalentes:

- **`workers.dev`**: `<worker>.<tu-subdominio>.workers.dev`. Viene activado y sirve para probar. Cloudflare lo trata como una web de plan Free pensada para proyectos personales. Tiene siempre activo el *Browser Integrity Check*, que no se puede desactivar y devuelve el error 1010 a algunos clientes automáticos que usan el *User-Agent* por defecto de su librería.
- **Custom Domain**: el Worker **es** el origen. Cloudflare crea el registro DNS y el certificado. No admite comodines, y no se puede crear sobre un nombre que ya tenga un CNAME.
- **Ruta**: un patrón como `www.example.com/api/*` en un registro DNS **con proxy**. El Worker va **delante** de tu servidor. El único comodín es `*`, sin comodines en medio (`example.com/*.jpg` no vale) ni parámetros.

## Implementación paso a paso

Las capturas son de mi cuenta, en tema claro: la pantalla de creación y los ajustes de un Worker real sin bindings. En el texto, el ejemplo es un Worker llamado `hola-mundo`.

### 1. Crea el proyecto con C3

C3 (`create-cloudflare`) genera el proyecto e instala Wrangler, la CLI de Workers:

```bash
npm create cloudflare@latest -- hola-mundo
# What would you like to start with?  Hello World example
# Which template would you like to use?  Worker only
# Which language do you want to use?  JavaScript
cd hola-mundo
npx wrangler dev      # http://localhost:8787
```

También puedes empezar desde el panel, en **Workers & Pages › Create application**, con una plantilla o un repositorio de GitHub o GitLab.

![Workers & Pages › Create an app: opciones Continue with Artifacts, Connect GitHub o GitLab, Start with Hello World!, Select a template y Upload your static files](media:blog/cloudflare-workers-guia/01-crear.png)

### 2. El código y wrangler.jsonc

Un Worker es un módulo que exporta un objeto con un `fetch`. Recibe la petición, los bindings (`env`) y el contexto (`ctx`):

```js
// src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/hola") {
      const visitas = Number((await env.VISITAS.get("total")) ?? 0) + 1;
      ctx.waitUntil(env.VISITAS.put("total", String(visitas)));
      return Response.json({ entorno: env.ENTORNO, visitas });
    }

    return new Response("No encontrado", { status: 404 });
  },
};
```

`ctx.waitUntil()` deja que la escritura termine después de responder, hasta 30 segundos más. (Un contador en KV no es exacto con mucho tráfico; para eso están D1 o Durable Objects. Aquí solo sirve de ejemplo.)

La configuración va en `wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "hola-mundo",
  "main": "src/index.js",
  "compatibility_date": "2026-11-22",
  "observability": { "enabled": true },
  "vars": { "ENTORNO": "produccion" },
  "kv_namespaces": [{ "binding": "VISITAS" }],
  "secrets": { "required": ["API_TOKEN"] },
  "assets": { "directory": "./public" },
  "routes": [{ "pattern": "hola.example.com", "custom_domain": true }]
}
```

Lo importante de cada línea:

- **`compatibility_date`** fija el comportamiento del runtime. Pon la fecha de hoy al empezar. Desde fechas `2026-08-04` o posteriores, la compatibilidad con Node.js (`node:crypto`, `node:buffer`…) viene activada sin añadir `nodejs_compat`.
- **`observability.enabled`** activa Workers Logs.
- **`vars`** son variables en claro, para configuración.
- **`kv_namespaces`** sin `id`: Wrangler **crea el namespace** en el primer `deploy` y escribe el ID en el fichero. Lo mismo con `d1_databases` y `r2_buckets`. Si ya los tienes, pon su `id`, `database_id` o `bucket_name`.
- **`secrets.required`** declara qué secretos necesita el Worker. Si falta alguno, `wrangler deploy` falla en vez de desplegar algo roto.
- **`assets.directory`**: los ficheros de `./public` se suben como static assets.
- **`routes`** con `custom_domain: true` crea el Custom Domain. Si añades `routes` y no pones `workers_dev`, Wrangler entiende `workers_dev: false` en el siguiente despliegue.

Los secretos nunca van en el fichero:

```bash
npx wrangler secret put API_TOKEN      # crea una versión y la despliega
# En local, los secretos van en .dev.vars o .env (fuera de git)
```

Despliega:

```bash
npx wrangler deploy
```

### 3. Conecta un dominio

En el panel: **Workers & Pages ›** tu Worker **› Settings › Domains & Routes › Add**. Ahí eliges **Custom Domain** o **Route**.

![Settings de un Worker: Runtime variables and secrets, Bindings (sin ninguno conectado) y Observability con Logs, Traces e Issues](media:blog/cloudflare-workers-guia/02-ajustes.png)


Cómo elegir:

- **No tienes servidor**: Custom Domain.
- **Tienes servidor y quieres poner lógica delante**: ruta. El registro DNS tiene que existir y estar **con proxy**.
- **Un Worker llama a otro de la misma zona**: con `fetch()` solo funciona si el destino es un Custom Domain. Si es una ruta o `workers.dev`, usa un *service binding*. Ojo: esas subpeticiones de la misma zona **no pasan por las reglas del WAF** del destino, así que valida en el propio Worker.

En una ruta puedes elegir qué pasa cuando una cuenta Free agota las peticiones del día: **fail open** (la petición sigue hacia tu origen como si no hubiera Worker) o **fail closed** (error 1027). Para un Worker que hace de control de seguridad, fail closed.

### 4. Publica por porcentajes

`wrangler deploy` crea una versión y la pone al 100 % del tráfico. Para ir con cuidado, separa subir de desplegar:

```bash
npx wrangler versions upload                 # nueva versión, sin tráfico
npx wrangler versions deploy                 # eliges versiones y porcentajes
# Sin preguntas:
npx wrangler versions deploy <id-nueva>@10% <id-actual>@90% -y
```

En el panel: tu Worker **› Deployments › Promote deployment**.


Qué conviene saber:

- Un despliegue tiene **una o dos versiones**. Cada petición se asigna por porcentaje, así que el mismo usuario puede ver las dos. Para que no pase, usa *version affinity*.
- Para probar una versión concreta en producción, añádela al despliegue (vale al 0 %) y manda la cabecera `Cloudflare-Workers-Version-Overrides`.
- **`wrangler rollback`** vuelve a una versión anterior en un paso. Puedes elegir entre las **100 más recientes**. Desde el 19 de noviembre de 2026, las versiones se borran a los 30 días, salvo las 100 últimas y las desplegadas.
- Un rollback **no toca tus datos**: si cambiaste el esquema de D1 o borraste un namespace de KV, la versión antigua puede fallar.
- Si cambias secretos durante un despliegue gradual, usa `wrangler versions secret put`. `wrangler secret put` despliega al momento.
- Para ramas y *pull requests*, desde septiembre de 2026 existen las **Worker Previews** (`wrangler preview`): cada una con su URL, su configuración y su observabilidad, aislada de producción.

### Lo mismo, como código

Con el proveedor de Terraform (v5), un Worker con un namespace de KV, una variable, un secreto y su Custom Domain:

```hcl
resource "cloudflare_workers_kv_namespace" "visitas" {
  account_id = var.account_id
  title      = "hola-mundo-visitas"
}

resource "cloudflare_worker" "hola" {
  account_id    = var.account_id
  name          = "hola-mundo"
  observability = { enabled = true }
}

resource "cloudflare_worker_version" "hola" {
  account_id         = var.account_id
  worker_id          = cloudflare_worker.hola.id
  compatibility_date = "2026-11-22"
  main_module        = "index.js"
  modules = [{
    name         = "index.js"
    content_type = "application/javascript+module"
    content_file = "dist/index.js"
  }]
  bindings = [
    { type = "kv_namespace", name = "VISITAS", namespace_id = cloudflare_workers_kv_namespace.visitas.id },
    { type = "plain_text",   name = "ENTORNO", text = "produccion" },
    { type = "secret_text",  name = "API_TOKEN", text = var.api_token },
  ]
}

resource "cloudflare_workers_deployment" "hola" {
  account_id  = var.account_id
  script_name = cloudflare_worker.hola.name
  strategy    = "percentage"
  versions = [{
    version_id = cloudflare_worker_version.hola.id
    percentage = 100
  }]
}

resource "cloudflare_workers_custom_domain" "hola" {
  account_id = var.account_id
  zone_id    = var.zone_id
  hostname   = "hola.example.com"
  service    = cloudflare_worker.hola.name
}
```

Para una ruta en lugar de un Custom Domain:

```hcl
resource "cloudflare_workers_route" "api" {
  zone_id = var.zone_id
  pattern = "www.example.com/api/*"
  script  = cloudflare_worker.hola.name
}
```

Dos avisos. El secreto acaba en el *state* de Terraform: guárdalo cifrado. Y no hace falta llevarlo todo a Terraform: puedes gestionar solo `cloudflare_worker` y desplegar las versiones con Wrangler. `cloudflare_worker_version` y `cloudflare_workers_deployment` llegaron en la v5.9 del proveedor; el recurso antiguo `cloudflare_workers_script` sigue disponible y sube código y assets de una vez.

## Cómo comprobarlo

```bash
# En workers.dev o en tu Custom Domain
curl -s https://hola.example.com/api/hola
# {"entorno":"produccion","visitas":1}

# Logs en directo en la terminal, solo errores
npx wrangler tail hola-mundo --status error

# Versiones y despliegues
npx wrangler deployments list
```

En el panel, la pestaña **Observability** del Worker muestra los Workers Logs: un registro por invocación con la petición, la respuesta, el tiempo de CPU y el de reloj, más tus `console.log`. Registra objetos (`console.log({ usuario: 123 })`) en vez de texto: cada clave se vuelve un campo por el que filtrar. Si el volumen es alto, baja `head_sampling_rate` (por defecto, 1 = todo). **Issues** agrupa excepciones y respuestas 5xx y puede avisarte.

Dos errores que conviene reconocer:

- **1102**, *Worker exceeded resource limits*: te pasaste de CPU o de memoria.
- **1027**: una cuenta Free agotó las 100.000 peticiones del día en una ruta en fail closed.

## Límites y precios

| | Workers Free | Workers Paid |
|---|---|---|
| Peticiones | 100.000/día | 10 M/mes incluidas, luego 0,30 $/M |
| CPU por petición | 10 ms | 30 s por defecto, hasta 5 min |
| CPU incluida | — | 30 M ms/mes, luego 0,02 $/M ms |
| Memoria por isolate | 128 MB | 128 MB |
| Subpeticiones por invocación | 50 | 10.000 (ampliable) |
| Workers por cuenta | 100 | 500 |
| Tamaño del Worker | 64 MiB | 64 MiB |
| Ficheros estáticos por versión | 20.000 | 100.000 |
| Variables de entorno por Worker | 64 | 128 |
| Cron Triggers por cuenta | 5 | 1.000 |
| Workers Logs | 200.000/día, 3 días | 20 M/mes incluidos, 7 días |

- El plan Paid cuesta **5 $ al mes por cuenta**. No se paga por duración ni por tráfico de salida, y las subpeticiones no cuentan como peticiones.
- Las peticiones que acaban en **static assets** son gratis e ilimitadas en los dos planes. Con `run_worker_first`, las rutas que indiques sí ejecutan el Worker y cuentan.
- Las 100.000 peticiones diarias del plan Free se reinician a medianoche UTC. En Paid puedes bajar el máximo de CPU con `limits.cpu_ms` para que un bucle no te cueste dinero.
- Desde el 13 de noviembre de 2026 hay **límites de gasto**: en **Billing › Spend limits** fijas un tope para Workers y Cloudflare rechaza nuevas invocaciones al alcanzarlo (error 1103). Los static assets siguen funcionando. Es un tope aproximado, no exacto, y afecta a todos los Workers de la cuenta.
- Desde el **1 de diciembre de 2026**, Workers Logs pasa a la tarifa de Cloudflare Observability: en Free, 0,5 GB al día con 7 días de retención; en Paid, 50 GB de ingesta y 10 GB-mes de almacenamiento incluidos por ciclo.
- KV, D1 y R2 tienen precios y límites propios.


## Documentación oficial

- [Cómo funcionan los Workers](https://developers.cloudflare.com/workers/reference/how-workers-works/) y [primeros pasos con la CLI](https://developers.cloudflare.com/workers/get-started/guide/)
- [Configuración de Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/) y [comandos](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/), [variables de entorno](https://developers.cloudflare.com/workers/configuration/environment-variables/) y [secretos](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Rutas](https://developers.cloudflare.com/workers/configuration/routing/routes/), [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) y [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Static assets](https://developers.cloudflare.com/workers/static-assets/) y [su facturación](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Versiones y despliegues](https://developers.cloudflare.com/workers/versions-and-deployments/), [despliegues graduales](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/) y [rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) y [tarifa de Observability desde el 1-dic-2026](https://developers.cloudflare.com/observability/pricing/)
- [Límites](https://developers.cloudflare.com/workers/platform/limits/), [precios](https://developers.cloudflare.com/workers/platform/pricing/) y [límites de gasto](https://developers.cloudflare.com/workers/platform/spend-management/)
- [Infraestructura como código (Terraform)](https://developers.cloudflare.com/workers/platform/infrastructure-as-code/)
- Changelog: [aprovisionamiento automático de KV, R2 y D1](https://developers.cloudflare.com/changelog/post/2025-10-24-automatic-resource-provisioning/), [Node.js activado por defecto](https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/), [Worker Previews](https://developers.cloudflare.com/changelog/post/2026-09-22-worker-previews/), [límites de gasto](https://developers.cloudflare.com/changelog/post/2026-11-13-spend-management/) y [retención de versiones de 30 días](https://developers.cloudflare.com/changelog/post/2026-11-19-workers-pages-version-retention/)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** R2: almacenamiento de objetos sin costes de salida.

## También te puede interesar

- [El plan Free de Cloudflare: qué incluye de verdad y dónde están los límites](/blog/cloudflare-plan-free-que-incluye)
- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
