---
publishDate: 2026-04-14T09:00:00Z
draft: false
image: 'media:blog/cloudflare-r2-guia/portada.png'
title: 'R2: almacenamiento de objetos sin costes de salida'
excerpt: 'Serie Cloudflare, parte 15. Qué es R2, cómo se accede (API S3, binding de Workers, dominio propio), por qué r2.dev es solo para pruebas, cómo configurar CORS, reglas de ciclo de vida y clases de almacenamiento, cómo migrar desde S3 y cuánto cuesta de verdad.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'r2'
  - 'almacenamiento'
  - 's3'
  - 'serie cloudflare'
lang: 'es'
---

> **Serie Cloudflare, parte 15 de 50.** Un post por cada servicio de Cloudflare, siempre con la misma estructura: qué es, casos de uso, arquitectura, implementación paso a paso con capturas, cómo comprobarlo, límites y la documentación oficial.

Hasta ahora la serie ha tratado de proteger y acelerar lo que ya tienes en tu origen. R2 es otra cosa: un sitio donde guardar ficheros sin pagar por el tráfico de salida.

## Qué es

R2 es el almacenamiento de objetos de Cloudflare. Guardas ficheros (objetos) en contenedores (*buckets*). Cada objeto tiene clave, metadatos y contenido. No hay carpetas de verdad: `fotos/2026/playa.jpg` es una clave con barras.

Lo que lo hace interesante:

- **Sin costes de salida (*egress*).** Descargar de R2 a internet es gratis por cualquier vía. Pagas por lo que guardas y por las operaciones.
- **Compatible con S3.** La mayoría de herramientas y SDK que hablan con Amazon S3 funcionan cambiando el *endpoint* y las credenciales.
- **Integrado con Workers.** Un Worker accede al bucket con un *binding*, sin claves ni peticiones firmadas.
- **Privado por defecto.** Un bucket nuevo no es accesible desde internet hasta que tú lo decidas.

R2 es un producto de **cuenta**, no de zona: no depende del plan de tu dominio. Para empezar, activa la suscripción a R2 en el panel, aunque no salgas de la capa gratuita.

## Casos de uso

- **Medios de una web.** Imágenes y vídeos servidos desde `media.tudominio.com`, con la caché de Cloudflare delante.
- **Descargas pesadas.** Instaladores o datasets que en otro proveedor costarían más en tráfico que en disco.
- **Copias de seguridad.** Un NAS o un servidor sube copias cada noche por S3, y el ciclo de vida borra las antiguas.
- **Subidas desde el navegador.** Tu backend genera una URL firmada y el usuario sube el fichero directamente a R2, sin pasar por tu servidor.
- **Salir de S3 poco a poco.** Con Sippy, R2 copia cada objeto desde S3 la primera vez que alguien lo pide.

## Arquitectura

![Cuatro formas de llegar a un bucket de R2: dominio propio con caché, WAF y Access; r2.dev solo para desarrollo; API S3 con token o URL firmada; y binding desde un Worker. Debajo, el bucket con clases Standard e Infrequent Access, reglas de ciclo de vida y notificaciones de eventos hacia una cola; abajo, tabla de precios de Standard e Infrequent Access con la salida gratis](media:blog/cloudflare-r2-guia/00-arquitectura.png)

Hay cuatro caminos hasta los objetos de un bucket:

1. **Dominio propio (*custom domain*).** Conectas un subdominio de una zona de tu cuenta, como `media.example.com`. Las peticiones pasan por todo lo que ya conoces de la serie: caché, [WAF](/blog/cloudflare-waf-guia), [Bots](/blog/cloudflare-bots-guia) y [Access](/blog/cloudflare-access-guia). Es el camino para producción.
2. **`r2.dev`.** Una URL pública gestionada por Cloudflare, con límite de peticiones y sin caché, WAF, Access ni Bot Management. Solo para pruebas.
3. **API S3.** El endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, con credenciales de un token de R2 o con una URL firmada.
4. **Binding de Workers.** El Worker lee y escribe con `env.MI_BUCKET.get()` y `put()`, sin credenciales en el código.

Dentro del bucket, cada objeto tiene una **clase de almacenamiento** (Standard o Infrequent Access). Las **reglas de ciclo de vida** mueven o borran objetos según su antigüedad. Y las **notificaciones de eventos** mandan un mensaje a una cola de Queues cada vez que se crea o se borra un objeto.

## Implementación paso a paso

La captura es del formulario de creación de un bucket, rellenado con un nombre de ejemplo y cancelado sin crear nada. En el texto, el bucket de ejemplo es `serie-r2-demo`.

### 1. Crea el bucket

En **Storage & databases › R2 › Overview**, botón **Create bucket**. Tres decisiones:

- **Nombre.** Es interno: no aparece en las URL públicas de un dominio propio.
- **Ubicación.** Por defecto es automática: Cloudflare elige la región más cercana a quien crea el bucket. Puedes dar una pista (`weur` para Europa occidental, `eeur`, `enam`, `wnam`, `apac`, `oc`), pero solo es eso, una pista. Y solo cuenta la primera vez que se crea un bucket con ese nombre. Si necesitas una **garantía** legal, usa una *jurisdicción* (`eu`, `us` o `fedramp`). No se puede cambiar después.
- **Clase por defecto.** Standard o Infrequent Access. Lo normal es Standard.

![Formulario Create a bucket: nombre de ejemplo «fotos-catalogo», ubicación Automatic o Specify jurisdiction y clase de almacenamiento Standard o Infrequent Access](media:blog/cloudflare-r2-guia/01-crear-bucket.png)

Desde la terminal, el bucket es una línea y el primer objeto, otra:

```bash
npx wrangler r2 bucket create serie-r2-demo --location weur
npx wrangler r2 object put serie-r2-demo/hola.txt --file ./hola.txt --remote
```

Sin `--remote`, Wrangler escribe en el almacenamiento local de desarrollo, no en tu cuenta.

### 2. Hazlo público, pero con tu dominio

En el bucket, pestaña **Settings**. Ahí están las dos vías públicas:

- **Custom Domains › Add.** Escribes el subdominio, revisas el registro DNS que se va a crear y pulsas **Connect Domain**. El estado pasa de *Initializing* a *Active* en unos minutos.
- **Public Development URL.** Para activarla tienes que escribir `allow`. Déjala desactivada en producción.


Antes de conectar el dominio, ten en cuenta tres cosas:

- **Conectar un dominio hace público el bucket en ese nombre.** Si solo debe verlo tu equipo, crea primero la aplicación de [Access](/blog/cloudflare-access-guia) para ese subdominio y después conecta el dominio.
- **Si proteges el dominio con WAF o Access, desactiva `r2.dev`.** Si no, el bucket sigue abierto por otra puerta.
- **La caché se comporta como en cualquier zona.** Por defecto solo cachea las extensiones estáticas habituales ([parte 4](/blog/cloudflare-cdn-cache-guia)). Para cachear todo, crea una Cache Rule. Activa también **Smart Tiered Cache**: elige como nivel superior el centro de datos más cercano a tu bucket.

### 3. Reglas de ciclo de vida

En **Settings › Object Lifecycle Rules › Add rule**. Cada regla se aplica a un prefijo (o a todo el bucket) y puede:

- **Borrar objetos** a los N días o en una fecha.
- **Pasarlos a Infrequent Access** a los N días. Cada transición cuenta como una operación de clase A.
- **Abortar subidas multiparte** que se quedaron a medias.

Todo bucket nuevo trae ya una regla que aborta las subidas multiparte a los siete días. Los objetos caducados se borran normalmente en menos de 24 horas.


Con Wrangler, la misma regla:

```bash
npx wrangler r2 bucket lifecycle add serie-r2-demo logs-30d logs/ --expire-days 30
```

**Sobre Infrequent Access.** Cuesta menos por GB, pero cobra por leer (*data retrieval*), sus operaciones son más caras y tiene una duración mínima de 30 días: si borras un objeto a los cinco días, pagas los 30. Úsalo para copias y archivos que casi nunca se leen. Las reglas solo mueven objetos de Standard a Infrequent Access. Para volver, copia el objeto con la clase Standard.

### 4. Credenciales para la API S3

En **R2 › Overview › Account Details**, junto a **API Tokens**, pulsa **Manage** y crea un token. Elige el de menos permisos que te sirva:

- **Object Read & Write** u **Object Read only**: solo objetos, y puedes limitarlos a unos buckets concretos. Es lo que necesitan una herramienta de copias o tu aplicación.
- **Admin Read & Write** o **Admin Read only**: toda la cuenta, incluida la configuración de los buckets.

Mejor un **token de cuenta** que uno de usuario: el de usuario deja de funcionar si ese usuario sale de la cuenta. Al crearlo verás el **Access Key ID** y el **Secret Access Key**. El secreto solo se muestra una vez.


Con esas credenciales, cualquier cliente S3 funciona. La región es siempre `auto`:

```bash
export AWS_ACCESS_KEY_ID=<ACCESS_KEY_ID>
export AWS_SECRET_ACCESS_KEY=<SECRET_ACCESS_KEY>
export AWS_DEFAULT_REGION=auto

aws s3 ls s3://serie-r2-demo/ \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Si el bucket está en una jurisdicción, el endpoint cambia: `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` para la UE.

No todo S3 está implementado. Entre lo que falta: ACL, versionado, *object lock* y etiquetas de objeto. Si tu herramienta depende de alguna, compruébalo antes de migrar.

### 5. URLs firmadas y CORS

Una URL firmada da acceso temporal a **un** objeto sin compartir credenciales. Tu backend la genera sin hablar con R2, y vale entre 1 segundo y 7 días. Admite `GET`, `HEAD`, `PUT` y `DELETE`, pero no `POST` (los formularios HTML de subida no sirven). Solo funciona en el endpoint S3, **no en un dominio propio**.

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// URL para que el navegador suba un PNG durante 10 minutos
const url = await getSignedUrl(
  s3,
  new PutObjectCommand({
    Bucket: "serie-r2-demo",
    Key: "subidas/avatar.png",
    ContentType: "image/png",
  }),
  { expiresIn: 600 },
);
```

Trata la URL como una contraseña: quien la tenga puede usarla hasta que caduque. Si fijas `ContentType` en la firma, una subida de otro tipo falla con `403`.

Si la petición la hace el navegador, el bucket necesita una **política CORS**. En **Settings › CORS Policy › Add CORS policy**, pestaña **JSON**:

```json
[
  {
    "AllowedOrigins": ["https://www.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```


Los orígenes van sin ruta (`https://host[:puerto]`) y no admiten comodines en el puerto: cada puerto de `localhost` va aparte. Los cambios tardan hasta 30 segundos en aplicarse. Detrás de un dominio propio, purga la caché después de cambiar la política: lo que ya está en caché conserva las cabeceras antiguas.

### 6. Desde un Worker

El binding se declara en `wrangler.jsonc`:

```jsonc
{
  "r2_buckets": [
    { "binding": "MEDIA", "bucket_name": "serie-r2-demo" }
  ]
}
```

Y el Worker sirve objetos con sus metadatos:

```js
export default {
  async fetch(request, env) {
    const key = new URL(request.url).pathname.slice(1);
    const object = await env.MEDIA.get(key);
    if (object === null) {
      return new Response("No encontrado", { status: 404 });
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  },
};
```

El binding no genera URLs firmadas. Si las necesitas desde un Worker, usa `aws4fetch` o el SDK de AWS v3 con `nodejs_compat`.

### 7. Notificaciones de eventos

R2 puede mandar un mensaje a una cola de [Queues](https://developers.cloudflare.com/queues/) cuando se crea un objeto (`object-create`: `PutObject`, `CopyObject`, `CompleteMultipartUpload`) o se borra (`object-delete`, incluidos los borrados por ciclo de vida). Un Worker consumidor hace el resto: generar miniaturas, indexar, avisar.

```bash
npx wrangler queues create r2-eventos
npx wrangler r2 bucket notification create serie-r2-demo \
  --event-type object-create --queue r2-eventos --prefix "subidas/"
```

El mensaje lleva la acción, el bucket, la clave, el tamaño y la hora. Puedes filtrar por prefijo, sufijo o ambos.

### 8. Migrar desde otro proveedor

- **Super Slurper** copia un bucket entero de una vez desde Amazon S3, Google Cloud Storage, otro bucket de R2 o un proveedor compatible con S3. Está en **R2 › Data Migration › Migrate files**. No borra nada en el proveedor de origen. Salta los objetos de más de 1 TB y los de Glacier (salvo Instant Retrieval).
- **Sippy** migra bajo demanda. Cuando alguien pide un objeto que aún no está en R2, lo sirve desde el proveedor de origen y lo copia a R2. Así evitas pagar de golpe la salida de una migración completa. Fuentes: S3, Google Cloud Storage, Azure Blob Storage y proveedores compatibles con S3. Se activa en **Settings › On Demand Migration** o con `npx wrangler r2 bucket sippy enable`.

En los dos casos, no des por hecho que el ETag coincida con el del proveedor de origen.

### Lo mismo, como código

Con el proveedor de Terraform (v5), el bucket, su dominio, una regla de ciclo de vida y CORS:

```hcl
resource "cloudflare_r2_bucket" "media" {
  account_id    = var.account_id
  name          = "serie-r2-demo"
  location      = "weur"
  storage_class = "Standard"
}

resource "cloudflare_r2_custom_domain" "media" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.media.name
  zone_id     = var.zone_id
  domain      = "media.example.com"
  enabled     = true
  min_tls     = "1.2"
}

resource "cloudflare_r2_bucket_lifecycle" "media" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.media.name
  rules = [{
    id         = "logs-30d"
    enabled    = true
    conditions = { prefix = "logs/" }
    delete_objects_transition = {
      condition = { type = "Age", max_age = 2592000 } # 30 días, en segundos
    }
  }, {
    id         = "copias-a-ia"
    enabled    = true
    conditions = { prefix = "copias/" }
    storage_class_transitions = [{
      storage_class = "InfrequentAccess"
      condition     = { type = "Age", max_age = 7776000 } # 90 días
    }]
  }]
}

resource "cloudflare_r2_bucket_cors" "media" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.media.name
  rules = [{
    id = "subidas-navegador"
    allowed = {
      origins = ["https://www.example.com"]
      methods = ["PUT"]
      headers = ["Content-Type"]
    }
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }]
}
```

El token de Terraform necesita el permiso *Workers R2 Storage Write*. Tres trampas: `max_age` va en **segundos**, no en días; `location` solo cuenta la primera vez que se crea un bucket con ese nombre; y `cloudflare_r2_custom_domain` y `cloudflare_r2_bucket_cors` no admiten `terraform import`, así que si ya los creaste en el panel, bórralos allí antes de aplicar.

## Cómo comprobarlo

Que el objeto existe:

```bash
npx wrangler r2 object get serie-r2-demo/hola.txt --file ./copia.txt --remote
```

Que el dominio propio sirve y cachea. La primera petición suele dar `MISS`, y la siguiente, `HIT`:

```bash
curl -sI https://media.example.com/hola.txt | grep -i cf-cache-status
```

Que CORS responde. Sin cabecera `Origin`, R2 no devuelve cabeceras CORS, así que un `curl` sin más no prueba nada:

```bash
curl -sI -X OPTIONS https://serie-r2-demo.<ACCOUNT_ID>.r2.cloudflarestorage.com/subidas/avatar.png \
  -H "Origin: https://www.example.com" \
  -H "Access-Control-Request-Method: PUT" | grep -i access-control
```

Y que `r2.dev` está cerrado: `npx wrangler r2 bucket dev-url get serie-r2-demo` te muestra su estado.

En el panel, la página **Metrics** de R2 muestra almacenamiento, operaciones de clase A y B y ancho de banda.

## Límites y precios

**Precios** (en dólares; la salida a internet es gratis en ambas clases):

| | Standard | Infrequent Access |
|---|---|---|
| Almacenamiento | 0,015 $/GB-mes | 0,01 $/GB-mes |
| Operaciones clase A (escrituras, listados) | 4,50 $/millón | 9,00 $/millón |
| Operaciones clase B (lecturas) | 0,36 $/millón | 0,90 $/millón |
| Recuperación de datos | — | 0,01 $/GB |
| Duración mínima | — | 30 días |

**Capa gratuita mensual**, solo en Standard: 10 GB-mes de almacenamiento, 1 millón de operaciones de clase A y 10 millones de clase B. Borrar objetos y buckets y abortar subidas multiparte es gratis. Los intentos de acceso no autorizados a un bucket privado tampoco se cobran.

Un ejemplo: 200 GB guardados, 3 millones de escrituras y 50 millones de lecturas al mes. Almacenamiento: 190 GB × 0,015 = 2,85 $. Clase A: 2 millones × 4,50 = 9 $. Clase B: 40 millones × 0,36 = 14,40 $. Total: **26,25 $**, sin importar cuántos terabytes se descarguen. Con un dominio propio y buena tasa de aciertos de caché, muchas lecturas ni siquiera llegan a R2.

**Límites:**

- Objetos de hasta 5 TiB (4,995 TiB exactamente). Una subida en un solo `PUT`, hasta 5 GiB; por encima, multiparte con un máximo de 10.000 partes.
- Clave de hasta 1.024 bytes; metadatos de hasta 8.192 bytes.
- Una escritura por segundo sobre la **misma clave**. Por encima, `429`.
- Hasta 100 dominios propios, 1.000 reglas de ciclo de vida y 100 reglas de notificación por bucket.
- Buckets por cuenta: los primeros 100.000, incluidos; después, 0,10 $ por bucket y mes.
- `r2.dev` tiene un límite variable (del orden de cientos de peticiones por segundo) y puede reducir el ancho de banda.

**Solo Enterprise:** la jurisdicción FedRAMP y cachear ficheros de más de 512 MB detrás de un dominio propio (Enterprise llega a 5 GB por defecto).

## Documentación oficial

- [R2: visión general](https://developers.cloudflare.com/r2/) y [primeros pasos](https://developers.cloudflare.com/r2/get-started/)
- [Precios](https://developers.cloudflare.com/r2/pricing/) y [límites](https://developers.cloudflare.com/r2/platform/limits/)
- [Buckets públicos: dominio propio y r2.dev](https://developers.cloudflare.com/r2/buckets/public-buckets/) y [caché delante de R2](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)
- [Tokens de API](https://developers.cloudflare.com/r2/api/tokens/), [compatibilidad con la API S3](https://developers.cloudflare.com/r2/api/s3/api/) y [URLs firmadas](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [CORS](https://developers.cloudflare.com/r2/buckets/cors/), [ciclo de vida](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) y [clases de almacenamiento](https://developers.cloudflare.com/r2/buckets/storage-classes/)
- [API de Workers para R2](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) y [notificaciones de eventos](https://developers.cloudflare.com/r2/buckets/event-notifications/)
- [Ubicación de los datos y jurisdicciones](https://developers.cloudflare.com/r2/reference/data-location/)
- [Super Slurper](https://developers.cloudflare.com/r2/data-migration/super-slurper/) y [Sippy](https://developers.cloudflare.com/r2/data-migration/sippy/)
- [Comandos de Wrangler para R2](https://developers.cloudflare.com/r2/reference/wrangler-commands/)
- [Changelog de R2](https://developers.cloudflare.com/changelog/product/r2/), con la [jurisdicción `us`](https://developers.cloudflare.com/r2/reference/data-location/#jurisdictional-restrictions) (agosto de 2026)

Última revisión con la documentación oficial: 22 de noviembre de 2026.

**Siguiente en la serie:** KV: almacenamiento clave-valor en el borde.

## También te puede interesar

- [CDN y caché en Cloudflare: Cache Rules, Tiered Cache y purgas](/blog/cloudflare-cdn-cache-guia)
- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
- [WAF de Cloudflare: reglas gestionadas y reglas personalizadas](/blog/cloudflare-waf-guia)
