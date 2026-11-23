---
publishDate: 2026-11-23T10:00:00Z
draft: false
image: 'media:blog/cloudflare-plano-de-control-agente/portada.png'
title: 'El plano de control de un agente: Zero Trust para la IA que actúa'
excerpt: 'Un agente que actúa es un empleado nuevo con llaves. Cómo encerrarlo en un sandbox por sesión y controlar sus cinco salidas con Cloudflare: inferencia con AI Gateway, internet con Gateway y DLP, herramientas con MCP server portals, infraestructura con Access, Tunnel, Mesh y Workers VPC, y memoria en R2 por usuario. Con pasos, registros y límites.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'agentes'
  - 'ia'
  - 'zero trust'
  - 'mcp'
lang: 'es'
---

Un agente que solo responde es un buscador con buena prosa. Un agente que actúa es otra cosa: abre tickets, consulta servidores, guarda ficheros y llama a APIs. Es un empleado nuevo con llaves. Antes de darle el primer juego, conviene responder tres preguntas. ¿Qué puede alcanzar? ¿Con la identidad de quién? ¿Quién lo registra?

Este post responde a las tres con piezas de Cloudflare que ya existen. Parte de una arquitectura ilustrativa que circula estos días: un agente dentro de un sandbox efímero, una frontera Zero Trust a su alrededor y cinco salidas controladas. No he encontrado la fuente original ni una arquitectura de referencia oficial con esa forma, así que el diagrama es mío. Lo más parecido en la documentación es [Enterprise AI agent workspace](https://developers.cloudflare.com/reference-architecture/diagrams/ai/enterprise-ai-agent-workspace/), que también lleva modelos por AI Gateway y herramientas por MCP server portals.

## La idea: una frontera Zero Trust alrededor del agente

El agente vive en un sandbox. Dentro tiene sus herramientas, su memoria de trabajo, sus skills y reglas, y sus extensiones. Nada de eso es peligroso mientras no salga. El riesgo está en las salidas.

El sandbox no tiene red propia. Cada salida pasa por un punto de control que aplica tres cosas: **identidad** (quién pide), **regla** (qué se permite) e **inspección** (qué contiene). Y cada salida lleva la identidad de la persona o del agente, no una credencial compartida.

![Plano de control de un agente: en el centro, un sandbox efímero por sesión con el agente y cuatro piezas internas (herramientas, memoria, skills y reglas, extensiones); alrededor, una frontera Zero Trust discontinua con identidad, regla e inspección; cinco salidas etiquetadas con identidad hacia AI Gateway (inferencia), Gateway, DLP y Browser Run (internet y apps internas), MCP server portal (herramientas), Access for Infrastructure, Tunnel, Mesh y Workers VPC (infraestructura) y R2 por usuario (memoria)](media:blog/cloudflare-plano-de-control-agente/01-plano-de-control.png)

Las cinco salidas son:

1. **Inferencia**: las llamadas a modelos.
2. **Internet y apps internas**: la web y las aplicaciones de la empresa.
3. **Herramientas**: GitHub, Jira, ServiceNow, SAP y demás, por MCP.
4. **Infraestructura**: servidores y redes privadas.
5. **Memoria**: notas, artefactos y snapshots que sobreviven a la sesión.

## El sandbox

**Qué controla.** Dónde se ejecuta el código del agente y qué ve. Cada sesión tiene su propio contenedor. Al terminar, se destruye.

**El producto.** [Sandboxes](https://developers.cloudflare.com/sandbox/) sobre [Containers](/blog/cloudflare-containers-guia). Cada instancia es una microVM con su propio kernel y su propia red. El paquete `@cloudflare/sandbox` está en la 1.0 (la 1.0.3 es del 22 de octubre de 2026). Requiere Workers Paid.

La documentación lo deja claro: los procesos de un sandbox comparten ficheros, puertos y capacidades. Por eso, un sandbox por usuario o por tarea. Y las credenciales, fuera.

**Cómo se configura.**

1. Deriva el nombre del sandbox de la identidad autenticada, nunca de un parámetro del cliente: ``env.SANDBOX.getByName(`sesion-${sub}-${id}`)``.
2. Arranca el contenedor con `enableInternet: false`. Sin internet, solo sale lo que interceptas.
3. Intercepta cada host permitido con `interceptOutboundHttps()` hacia un `WorkerEntrypoint` que añade la credencial. El sandbox nunca la ve.
4. Fija la inactividad con `setInactivityTimeout()` (máximo 6 horas) y llama a `destroy()` al cerrar la sesión.

```ts
// En el Durable Object que gestiona el sandbox
const container = this.ctx.container;
await container.interceptOutboundHttps("api.github.com", this.ctx.exports.GitHubGateway);

if (!container.running) {
  container.start({
    image: "cloudflare/debian-trixie",
    entrypoint: ["sleep", "infinity"],
    enableInternet: false, // solo salen los hosts interceptados
  });
}
```

**Qué queda registrado.** Lo que registre tu Worker y sus entrypoints de salida. El sandbox en sí no es una fuente de auditoría: lo que pasa dentro se pierde al destruirlo, salvo que lo guardes en la memoria (salida 5).

## Salida 1: Inferencia (AI Gateway)

**Qué controla.** Qué modelos usa el agente, cuánto gasta, qué datos manda en el prompt y qué recibe.

**El producto.** [AI Gateway](/blog/cloudflare-ai-gateway-guia). Un único punto para Workers AI y proveedores externos, con las claves guardadas en el gateway y no en el agente.

**Cómo se configura.**

1. En el panel, ve a **AI** > **AI Gateway** > **Create Gateway**. Los gateways nuevos exigen autenticación.
2. Llama al modelo desde el Worker con el binding y el ID del gateway, no desde el sandbox.
3. Etiqueta cada petición con la persona y la sesión con `cf-aig-metadata` (hasta cinco entradas).
4. Activa DLP: en el gateway, pestaña **Firewall**, activa **Data Loss Prevention (DLP)**, añade una regla con perfiles, acción **Flag** o **Block** y comprobación en **Request**, **Response** o ambas. Sin suscripción de Zero Trust solo tienes dos perfiles predefinidos.
5. Si alguien llama directamente al gateway, ponlo detrás de Access con un dominio propio (pestaña **Access**). AI Gateway añade entonces el usuario verificado como `cf.user_id`.

```ts
const out = await env.AI.run(
  "@cf/zai-org/glm-5.3",
  { messages },
  { gateway: { id: "agentes", metadata: { user: sub, session: sessionId } } },
);
```

**Qué queda registrado.** Cada petición: modelo, proveedor, tokens, coste, duración y estado. Si salta una regla de DLP, la acción y las reglas que coinciden. Puedes guardar solo metadatos con `cf-aig-collect-log-payload: false` si no quieres conservar los prompts.

## Salida 2: Internet y apps internas (Gateway, DLP, Browser Run)

**Qué controla.** A qué webs y aplicaciones llega el agente y qué datos salen hacia ellas.

**El producto.** [Gateway](/blog/cloudflare-gateway-guia) para las reglas DNS, HTTP y de red; [DLP](/blog/cloudflare-dlp-guia) para inspeccionar el contenido; [Browser Run](/blog/cloudflare-browser-run-guia) cuando el agente necesita un navegador de verdad.

La pieza que une el sandbox con Gateway es [Workers VPC](https://developers.cloudflare.com/workers-vpc/). Un binding de VPC Network con `network_id: "cf1:network"` saca el tráfico del Worker a internet a través de Gateway, con tus reglas y tus logs. Es una forma de componerlo, no una guía oficial: el entrypoint que intercepta la salida del sandbox reenvía por ese binding.

```jsonc
// wrangler.jsonc
{
  "vpc_networks": [
    { "binding": "EGRESS", "network_id": "cf1:network", "remote": true }
  ]
}
```

```ts
export class WebEgress extends WorkerEntrypoint<Env> {
  fetch(request: Request) {
    return this.env.EGRESS.fetch(request); // pasa por las reglas de Gateway
  }
}
```

**Cómo se configura.**

1. Crea el binding `EGRESS` y reenvía por él la salida interceptada del sandbox. Necesitas una organización de Zero Trust con el proxy de Gateway activado.
2. En **Zero Trust** > **Traffic policies** > **Firewall policies** > **HTTP**, crea reglas de destino: categorías bloqueadas, lista de dominios permitidos.
3. Añade una regla HTTP con un perfil de DLP para bloquear datos sensibles en las subidas.
4. Bloquea el MCP que no pase por tu portal: selector **Is MCP** es *True* y **Traffic Source** no es *MCP portal*, acción **Block**. El selector está en beta.
5. Para navegar, usa Browser Run desde el Worker. Sus guardrails limitan los hosts que visita la sesión. Su opción `outboundByHost` enruta por un Worker, host a host, las peticiones `http://` (no las HTTPS).

**Qué queda registrado.** Los logs DNS, HTTP y de red de Gateway, con la acción y la regla que aplicó. Ojo: Gateway ve el tráfico del Worker, no a la persona. Si necesitas saber quién, regístralo tú en el entrypoint.

## Salida 3: Herramientas (MCP server portals)

**Qué controla.** Qué herramientas MCP ve el agente, con qué credencial las usa y qué datos les manda.

**El producto.** [MCP server portals](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/), GA desde el 24 de septiembre de 2026. Un portal reúne varios servidores MCP (GitHub, Jira, ServiceNow, SAP o uno interno) en un único endpoint protegido por [Access](/blog/cloudflare-access-guia). Los servidores privados pueden llegar por Tunnel o Mesh.

**Cómo se configura.**

1. En **Zero Trust** > **Access controls** > **MCP Portals** > **MCP servers**, añade cada servidor con su URL y su regla de Access.
2. Crea el portal con **Add server portal**, elige dominio y añade los servidores.
3. Desactiva las herramientas que el agente no necesita. Un portal por equipo, no uno con todo.
4. Decide la credencial: con **Require user auth** activado, cada persona usa su propio login en el servidor.
5. Activa **Route traffic through Cloudflare Gateway** y crea una regla HTTP con un perfil de DLP.
6. Elige la regla de Code Mode. Con `?codemode=search_and_execute`, el portal expone dos herramientas: `portal_codemode_search` y `portal_codemode_execute`.

**Qué queda registrado.** Access registra cada llamada: hora, estado, servidor, herramienta y duración. Con Gateway activado, la petición aparece también en los logs HTTP. Exportar los logs del portal con Logpush es **solo Enterprise**; ese dataset incluye el email del usuario y el nombre de la herramienta.

## Salida 4: Infraestructura (Access for Infrastructure, Tunnel, Mesh, Workers VPC)

**Qué controla.** Qué servidores y servicios privados alcanza el agente, por qué puerto y con qué usuario.

**El producto.** Aquí hay dos caminos y conviene no mezclarlos.

- **Servicios internos (HTTP o TCP).** Workers VPC conecta tu Worker con servicios detrás de [Cloudflare Tunnel](/blog/cloudflare-tunnel-guia), de [Cloudflare Mesh](https://developers.cloudflare.com/mesh/) (antes WARP Connector) o de Cloudflare WAN. Es el camino natural para un agente: le das una API interna, no una shell. Workers VPC está en beta.
- **Shell (SSH).** [Access for Infrastructure](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/ssh/ssh-infrastructure-access/) sustituye las claves SSH por certificados de corta duración y registra los comandos. Exige el Cloudflare One Client en el dispositivo que conecta. No he encontrado una guía oficial para usarlo desde un agente sin cliente. Hoy encaja para la persona que revisa lo que propone el agente.

**Cómo se configura (servicio interno).**

1. Conecta la red con un túnel o un nodo de Mesh.
2. Añade el binding: una VPC Service para un host y puerto concretos, o una VPC Network para toda la red.
3. Si usas una VPC Network con `cf1:network`, el tráfico por Mesh pasa por Gateway: escribe reglas de red sobre qué IP y puerto se alcanzan. Una VPC Service ya fija un host y un puerto.
4. Expón al agente solo métodos concretos (`estadoServidor("web-01")`), nunca el binding entero.

**Cómo se configura (SSH para personas).**

1. Añade el servidor como objetivo en Access for Infrastructure.
2. Crea una aplicación **Infrastructure** con protocolo SSH, puerto 22 y los usuarios UNIX permitidos.
3. En **Access controls** > **Service credentials** > **SSH**, genera la CA y configura `sshd` para confiar en ella.
4. Para registrar comandos, sube una clave pública de cifrado en **Traffic policies** > **Traffic settings** > **SSH log encryption public key**.

**Qué queda registrado.** Logs de red de Gateway, con **Traffic Source** *Workers VPC* para lo que sale de tu Worker (el tráfico de un nodo de Mesh usa la identidad `warp_connector@<equipo>.cloudflareaccess.com`, no la de la persona). Con Access for Infrastructure, logs de acceso y logs de comandos SSH cifrados con tu clave. Su exportación por Logpush es **solo Enterprise**.

## Salida 5: Memoria (R2 por usuario)

**Qué controla.** Qué guarda el agente entre sesiones y quién puede leerlo después.

**El producto.** [R2](/blog/cloudflare-r2-guia). Un bucket, con un prefijo por usuario (`users/<sub>/`) para notas, artefactos y snapshots. R2 no conoce a tus usuarios, así que la separación la impones tú. Hay dos formas documentadas:

- **Un Worker que fuerza el prefijo.** El Worker tiene el binding de R2, saca el `sub` de la identidad verificada y solo lee y escribe bajo `users/<sub>/`. El agente no ve credenciales.
- **Credenciales temporales.** Si el sandbox necesita un cliente S3 o montar el bucket, emite [credenciales temporales](https://developers.cloudflare.com/r2/api/s3/temporary-credentials/) desde un token padre, limitadas a un bucket, a un prefijo y a un TTL corto.

```sh
curl https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/r2/temp-access-credentials \
  --header "Authorization: Bearer $PARENT_API_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "bucket": "memoria-agentes",
    "parentAccessKeyId": "'"$PARENT_ACCESS_KEY_ID"'",
    "permission": "object-read-write",
    "ttlSeconds": 900,
    "prefixes": ["users/u-123/"]
  }'
```

**Cómo se configura.**

1. Crea el bucket y un token padre de R2 con **Object Read & Write**, limitado a ese bucket.
2. Guarda el token padre como secreto del Worker. Nunca entra en el sandbox.
3. Emite las credenciales temporales por sesión, con el prefijo del usuario y 15 minutos de vida.
4. Si revocas el token padre, todas las credenciales derivadas dejan de funcionar al momento.

**Qué queda registrado.** Lo que registre tu Worker: quién pidió qué clave y cuándo. Una credencial fuera de su prefijo recibe un `403 AccessDenied`.

## La identidad en cada salida

Las cinco salidas solo sirven si cada petición lleva una identidad verificable. Hay tres casos.

**Una persona detrás.** Access autentica y manda un JWT firmado en la cabecera `Cf-Access-Jwt-Assertion`. Valídalo en el origen (firma, `iss`, `aud`, `exp`) o, en un Worker, usa `ctx.access`. De ahí sale el `sub` que nombra el sandbox, etiqueta AI Gateway y limita el prefijo de R2. Si una aplicación llama a otra en nombre del usuario, reenvía el JWT como `Cf-Access-Token` con una regla Linked App Token.

**Un agente autónomo.** Usa un service token de Access: cabeceras `CF-Access-Client-Id` y `CF-Access-Client-Secret` y una regla **Service Auth**. En el portal MCP funciona con **Require user auth** desactivado. Entonces el portal usa la credencial de administrador del servidor: en Jira, la acción la firma esa cuenta, no la persona. Y AI Gateway no recibe `cf.user_id` con un service token.

**Un agente que actúa por una persona.** Access admite OAuth gestionado (Managed OAuth, en beta) para agentes y CLI. Los tokens de acceso duran 15 minutos por defecto. Es la opción que mejor encaja con el modelo: identidad de la persona, credencial corta.

El recorrido completo de una petición, paso a paso:

![Recorrido de una petición: la persona pide al agente abrir un ticket en Jira y revisar el servidor web-01. Siete pasos numerados: login con Access y JWT validado; sandbox de la sesión nombrado por la identidad; llamada al modelo por AI Gateway con metadatos de usuario; herramienta de Jira por el MCP server portal con regla de Access, log y DLP; estado del servidor por Workers VPC y Mesh con regla de red de Gateway; nota guardada en R2 bajo el prefijo del usuario; respuesta y destrucción del sandbox. Cada paso indica la regla que aplica y lo que queda registrado](media:blog/cloudflare-plano-de-control-agente/02-recorrido.png)

## Cómo empezar en una semana

No hace falta todo el primer día. Este orden da valor desde el lunes.

1. **Lunes: inferencia.** Crea el gateway, pasa todas las llamadas por él y etiqueta con usuario y sesión. Activa DLP en modo **Flag**.
2. **Martes: sandbox.** Un sandbox por sesión, nombrado por la identidad, con `enableInternet: false`. Saca las credenciales del contenedor.
3. **Miércoles: herramientas.** Un portal MCP con dos servidores y las herramientas mínimas. Gateway activado y DLP en **Flag**.
4. **Jueves: salida y red.** Binding `EGRESS` por Gateway, lista de dominios permitidos y la regla que bloquea MCP fuera del portal. Un servicio interno por Workers VPC.
5. **Viernes: memoria y revisión.** Prefijo por usuario en R2. Revisa una semana de logs y pasa a **Block** las reglas de DLP que no dieron falsos positivos.

## Riesgos y límites

- **La inyección de prompts sigue ahí.** La frontera limita el daño, no lo evita. Un documento malicioso puede pedir al agente que use una herramienta permitida. Trata la salida de las herramientas como no fiable y pide aprobación humana para escribir.
- **Lo que el portal no aplica.** El MFA independiente, la justificación de propósito y la autenticación temporal no se aplican a servidores autorizados a través de un portal. Las llamadas al servidor MCP de origen caducan a los 60 segundos.
- **Credenciales compartidas.** Un service token es estático, y la credencial de administrador del portal actúa por todos. Rótalos y limita su alcance.
- **SSH para agentes.** Access for Infrastructure pide el Cloudflare One Client. Para un agente, mejor una API interna que una shell.
- **Piezas en beta.** Workers VPC, el selector **Is MCP**, Managed OAuth, los snapshots de sandbox y la política de planificación de Durable Objects que usan los contenedores de sandbox.
- **Coste.** Contenedores por sesión, horas de Browser Run y logs de AI Gateway (las cuentas que crearon su primer gateway desde el 24 de septiembre de 2026 siguen los precios de Workers Logs). En el plan Free de Zero Trust, los logs de Access y Gateway se guardan 24 horas.
- **Solo Enterprise.** La exportación por Logpush de los logs del portal MCP y de los logs de comandos SSH.

## Documentación oficial

- [Enterprise AI agent workspace](https://developers.cloudflare.com/reference-architecture/diagrams/ai/enterprise-ai-agent-workspace/) y [Enterprise AI Vibe Coding Platform](https://developers.cloudflare.com/reference-architecture/diagrams/ai/enterprise-ai-vibe-coding-platform/)
- [Sandboxes](https://developers.cloudflare.com/sandbox/), [seguridad](https://developers.cloudflare.com/sandbox/concepts/security/), [ciclo de vida](https://developers.cloudflare.com/sandbox/concepts/lifetime/) y [llamar a una API autenticada](https://developers.cloudflare.com/sandbox/network/call-an-authenticated-api/)
- [AI Gateway](https://developers.cloudflare.com/ai-gateway/get-started/), [metadatos](https://developers.cloudflare.com/ai-gateway/observability/custom-metadata/), [DLP](https://developers.cloudflare.com/ai-gateway/features/dlp/set-up-dlp/) y [Access](https://developers.cloudflare.com/ai-gateway/configuration/cloudflare-access/)
- [Workers VPC](https://developers.cloudflare.com/workers-vpc/), [VPC Networks](https://developers.cloudflare.com/workers-vpc/configuration/vpc-networks/) y [salida por Gateway](https://developers.cloudflare.com/changelog/post/2026-06-05-gateway-egress/)
- [Browser Run](https://developers.cloudflare.com/browser-run/) y su [binding](https://developers.cloudflare.com/browser-run/reference/browser-binding-api/)
- [MCP server portals](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/), [GA](https://developers.cloudflare.com/changelog/post/2026-09-24-mcp-portals-ga/) y [detección de MCP en Gateway](https://developers.cloudflare.com/changelog/post/2026-08-12-mcp-detection-and-dashboard/)
- [SSH con Access for Infrastructure](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/ssh/ssh-infrastructure-access/), [logs de comandos SSH](https://developers.cloudflare.com/cloudflare-one/insights/logs/dashboard-logs/ssh-command-logs/) y [Cloudflare Mesh](https://developers.cloudflare.com/mesh/)
- [Credenciales temporales de R2](https://developers.cloudflare.com/r2/api/s3/temporary-credentials/) y [tokens de R2](https://developers.cloudflare.com/r2/api/tokens/)
- [Validar el JWT de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [autenticar agentes](https://developers.cloudflare.com/cloudflare-one/access-controls/authenticate-agents/) y [Linked App Token](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/linked-app-token/)

Última revisión con la documentación oficial: 23 de noviembre de 2026.

## También te puede interesar

- [Agents SDK: agentes con estado](/blog/cloudflare-agents-sdk-guia)
- [AI Gateway: control y caché de las llamadas a modelos](/blog/cloudflare-ai-gateway-guia)
- [Cloudflare Access: proteger una aplicación sin VPN](/blog/cloudflare-access-guia)
