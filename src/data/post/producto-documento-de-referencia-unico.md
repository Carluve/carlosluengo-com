---
publishDate: 2026-11-23T09:00:00Z
draft: false
image: 'media:blog/producto-documento-de-referencia-unico/portada.png'
title: 'El documento de referencia único: un sitio para la verdad del proyecto'
excerpt: 'Serie Producto, parte 3. Cómo montar y mantener vivo un único documento por iniciativa con el problema, los objetivos, las métricas, el estado y el registro de decisiones. Con la metodología paso a paso, lo que hacen GitLab, Amazon, Google, Atlassian, Spotify y Linear, una plantilla para copiar y los errores que lo matan.'
category: 'Producto'
tags:
  - 'producto'
  - 'product management'
  - 'serie producto'
  - 'documentación'
  - 'toma de decisiones'
  - 'comunicación'
lang: 'es'
---

> **Serie Producto, parte 3 de 10.** Un post por semana para aprender gestión de producto: la idea, una metodología paso a paso, qué hacen las grandes empresas y tips para aplicarlo mañana.

Alguien de ventas te pregunta en el chat cuándo sale la funcionalidad. Tú respondes. Dos días después, un ingeniero pregunta lo mismo en otra conversación, y la fecha ha cambiado. Ventas sigue con la vieja. Nadie miente. Solo que la información vive en cinco sitios y cada uno envejece a su ritmo.

En la [parte 2](/blog/producto-claridad-extrema) vimos cómo escribir para que nadie tenga que adivinar. Esta semana toca decidir **dónde** se escribe. La respuesta es un solo documento por iniciativa, con un dueño, al que todo lo demás enlaza.

## La idea en dos minutos

Un documento de referencia único es la página que responde a las preguntas de siempre sobre una iniciativa: qué problema resolvemos, para quién, cómo sabremos que ha funcionado, en qué punto estamos y qué hemos decidido. Si alguien quiere saber algo del proyecto, abre ese enlace. No te pregunta a ti.

Tiene tres capas que cambian a ritmos distintos:

- **Cabecera.** Nombre, dueño, quién aprueba, estado y fecha de la última revisión.
- **Parte estable.** Problema, objetivos, no objetivos, métricas, alcance. Cambia poco, y cuando cambia es una decisión.
- **Parte viva.** El estado de la semana, el registro de decisiones y los enlaces a todo lo demás (specs, diseños, tablero de tareas, datos).

Lo que lo hace "único" no es la herramienta. Es una regla: **si no está en el documento, no está decidido.** Las conversaciones pueden pasar en el chat o en una reunión. El resultado acaba en el documento.

## Por qué importa

**Porque las preguntas repetidas son caras.** Cada vez que alguien te pregunta algo que ya está decidido, pierdes tú y pierde quien espera. GitLab lo describe sin rodeos en su [guía sobre el enfoque handbook-first](https://handbook.gitlab.com/handbook/company/culture/all-remote/handbook-first/): sin documentación estructurada, la gente pide y vuelve a pedir los mismos datos, en un bucle de interrupciones y reuniones.

**Porque el contexto se pierde.** Dentro de seis meses alguien verá una decisión rara y no sabrá por qué se tomó. Michael Nygard lo explica en su artículo sobre [registros de decisiones de arquitectura](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): sin el porqué, solo queda aceptar la decisión a ciegas o cambiarla a ciegas. Las dos cosas salen mal.

**Porque el estado tiene fecha de caducidad.** Un "vamos bien" dicho en una reunión no se puede consultar. Un estado escrito y fechado sí. Y cuando el estado deja de actualizarse, la fecha lo delata.

**Porque escala contigo.** Con tres personas puedes coordinarte de palabra. Con treinta, no. GitLab lo dice en la misma guía: cuando el equipo crece, la necesidad de documentar crece a la par que el coste de no hacerlo.

## La metodología, paso a paso

![Diagrama de la metodología en siete pasos: cuatro para montar el documento (alcance, dueño, parte estable, registro de decisiones) y tres que se repiten cada semana para mantenerlo vivo (estado fechado, enlazar sin copiar, revisar y podar)](media:blog/producto-documento-de-referencia-unico/01-metodologia.png)

Montarlo te lleva una tarde. Mantenerlo es una costumbre de diez minutos a la semana. Los pasos 1 a 4 se hacen una vez. Los pasos 5 a 7 se repiten hasta cerrar la iniciativa.

### 1. Decide el alcance y dale un enlace estable

Un documento por iniciativa. No uno por equipo ni uno por trimestre. Si la iniciativa es demasiado grande para una página de cabecera, pártela en dos iniciativas con dos documentos, y enlázalos.

Ponle un nombre que se pueda buscar ("Pagos con Bizum en la app", no "Proyecto Fénix") y guárdalo donde vive el resto del trabajo: la wiki del equipo, la herramienta de proyectos o el repositorio.

**Lo que sale:** un documento vacío con un nombre claro y una URL que no va a cambiar.

### 2. Nombra un dueño y los roles

Una persona es dueña del documento. No significa que lo escriba todo. Significa que responde de que esté al día. En GitLab a esa figura la llaman DRI, la persona directamente responsable.

Apunta también quién aprueba las decisiones importantes, quién aporta y a quién hay que informar. Si no lo pones por escrito, cada decisión abre la misma discusión sobre quién decide.

**Lo que sale:** la cabecera rellena, con dueño, aprobador y fecha de última revisión.

### 3. Escribe la parte estable

Aquí aplicas lo de la [parte 2](/blog/producto-claridad-extrema): frases cortas, números concretos, sin adivinanzas. Seis bloques:

1. **Problema y para quién.** Dos o tres frases desde el punto de vista del usuario.
2. **Objetivos y no objetivos.** Los no objetivos son lo que alguien podría pensar que vas a hacer y no vas a hacer.
3. **Métricas de éxito.** Una principal y dos o tres de control, con valor actual y valor objetivo.
4. **Alcance y fechas clave.** Qué entra en la primera versión y qué queda fuera.
5. **Solución en una página.** El resumen. El detalle va en la spec, enlazada.
6. **Riesgos y preguntas abiertas.** Lo que no sabes todavía, con quién lo va a averiguar.

Enséñaselo a dos o tres personas clave antes de anunciarlo. Lo que no entiendan, reescríbelo.

**Lo que sale:** la versión 0, revisada, que ya sirve para alinear al equipo.

### 4. Abre el registro de decisiones

Una tabla con cinco columnas: fecha, decisión, quién decide, por qué y estado. Cada decisión es una fila. Las filas no se borran. Si una decisión se revierte, añades una fila nueva y marcas la vieja como sustituida.

La primera fila suele ser la propia aprobación de la iniciativa. Desde ahí, cualquier cambio en la parte estable (un objetivo, una fecha, el alcance) deja también su fila.

**Lo que sale:** la tabla de decisiones con al menos una fila.

### 5. Escribe el estado con fecha, cada semana

Un bloque corto al principio de la parte viva, con un semáforo (en marcha, en riesgo, desviado) y tres líneas: qué ha pasado, qué viene y qué bloquea. Con fecha. El estado nuevo va encima y el anterior baja. No lo reescribas: el historial cuenta cómo ha ido el proyecto.

Elige un día fijo. Ponte un recordatorio. Si un semáforo pasa a rojo, dilo en el estado antes que en una reunión.

**Lo que sale:** un bloque de estado por semana, con fecha y semáforo.

### 6. Enlaza, no copies

Esta es la regla que mantiene el documento como único. Cuando alguien pregunte algo en el chat, responde con el enlace a la sección. Cuando algo se decida en una reunión, el dueño lo pasa al registro ese mismo día.

No copies el estado en tres presentaciones distintas. Enlaza. Cada copia es una versión que va a quedarse vieja.

**Lo que sale:** una sola versión de la verdad y un equipo que se acostumbra a buscar ahí primero.

### 7. Revisa, poda y cierra

Una vez al mes, relee la parte estable entera. ¿Sigue siendo cierto el problema? ¿Siguen valiendo las métricas? Lo que haya cambiado, cámbialo y anótalo en el registro.

Al cerrar la iniciativa, escribe un último estado: resultado frente a las métricas, qué aprendisteis y qué queda pendiente. Marca el documento como archivado. No lo borres. Es la memoria del proyecto.

**Lo que sale:** un documento al día mientras dura la iniciativa, y archivado con sus aprendizajes cuando termina.

![Anatomía del documento de referencia: una cabecera que se toca en cada cambio, una parte estable con seis bloques que se revisa cada mes y una parte viva con estado, decisiones y enlaces que se actualiza cada semana](media:blog/producto-documento-de-referencia-unico/03-anatomia.png)

## Qué hacen otras empresas

![Mapa de cómo guardan la información de referencia GitLab, Spotify, Amazon, Google, Atlassian y Linear, según cuánto abarca el documento y cada cuánto se actualiza](media:blog/producto-documento-de-referencia-unico/02-empresas.png)

### GitLab: el handbook primero, el anuncio después

**Qué hacen.** GitLab trabaja *handbook-first*: todo el trabajo, los procesos y las políticas viven en un handbook público. En su [guía handbook-first](https://handbook.gitlab.com/handbook/company/culture/all-remote/handbook-first/) explican que primero escriben la solución y luego la anuncian por chat o correo, no al revés.

**Cómo.** Las discusiones empiezan en issues y merge requests, no en Slack. Cualquiera puede proponer un cambio al handbook, y el DRI o el responsable de esa parte lo revisa y lo fusiona. Además, solo guardan 90 días de historial de Slack, a propósito: así nadie usa el chat como archivo del proyecto.

**Qué puedes copiar.** El orden: primero se escribe en el documento y luego se avisa con el enlace. Y la idea de que el chat caduca y el documento no.

### Amazon: el PR/FAQ como documento que madura

**Qué hacen.** Amazon arranca sus iniciativas con un PR/FAQ: una nota de prensa del producto terminado y una lista de preguntas frecuentes. Colin Bryar y Bill Carr, que trabajaron allí y escribieron *Working Backwards*, lo explican en la [guía del PR/FAQ](https://www.workingbackwards.com/resources/working-backwards-pr-faq) de la web del libro.

**Cómo.** No es un documento de un día. La primera versión se escribe en unas horas y tiene huecos. Los primeros borradores se revisan con un grupo de unas diez personas, con gente de varias áreas y alguien que decide, y ganan detalle. Si a la dirección le convence, siguen más borradores y más revisiones. Según los autores, el equipo de AWS pasó más de un año escribiendo y revisando PR/FAQs antes de tener claro qué construir.

**Qué puedes copiar.** Empieza por el cliente y deja las preguntas incómodas a la vista, en la sección de preguntas. Un documento con huecos marcados es mejor que uno que finge estar completo.

### Google: design docs que se actualizan mientras el sistema no ha salido

**Qué hacen.** En Google, los equipos de ingeniería escriben un design doc antes de construir algo grande. Malte Ubl, que trabajó allí, lo describe en [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/): contexto, objetivos y no objetivos, el diseño, alternativas descartadas y temas transversales como seguridad y privacidad.

**Cómo.** Para un proyecto grande, el documento ronda las 10 a 20 páginas. Para mejoras pequeñas hay un *mini design doc* de 1 a 3. La regla que da Ubl es clara: "If the designed system hasn't shipped yet, then definitely update the doc." Si los cambios van a un documento nuevo, se enlazan desde el original para que se pueda seguir la historia.

**Qué puedes copiar.** La sección de no objetivos. Y la regla: mientras no hayas lanzado, el documento se actualiza; después, los cambios van enlazados, no perdidos.

### Atlassian: Project Poster y DACI

**Qué hacen.** Atlassian publica en su Team Playbook el [Project Poster](https://www.atlassian.com/team-playbook/plays/project-poster), una página viva que se escribe antes del plan de proyecto. A diferencia de un acta de proyecto, no se cierra al firmarla. También publica el [marco DACI](https://www.atlassian.com/team-playbook/plays/daci) para registrar decisiones.

**Cómo.** El poster tiene tres partes: el espacio del problema (por qué importa y cuáles son los objetivos), la validación (lo que aún no sabéis y los riesgos) y "listos para hacerlo" (la solución y el plan), que empieza vacía y se rellena a medida que el equipo llega a conclusiones. Se trabaja con 3 a 10 personas y se vuelve a él según llega feedback. El DACI asigna cuatro roles: Driver, que mueve la decisión; Approver, una sola persona que decide; Contributors, que opinan pero no votan; e Informed, a quienes se comunica. Al final, la decisión queda escrita en el documento para que futuros equipos sepan cómo y por qué se tomó.

**Qué puedes copiar.** Las secciones que empiezan vacías a propósito. Y un único aprobador por decisión, con su nombre escrito.

### Spotify: las apuestas DIBB, a la vista de todos

**Qué hacen.** Spotify alinea a la compañía con apuestas (*bets*) definidas con el marco DIBB: datos, *insight*, creencia y apuesta. Henrik Kniberg, coach ágil que trabajó con los equipos de Spotify, lo resume en [Spotify Rhythm](https://blog.crisp.se/2016/06/08/henrikkniberg/spotify-rhythm).

**Cómo.** Cada apuesta se escribe con la cadena que la justifica: qué datos vimos, qué entendimos, qué creemos y qué apostamos. Las apuestas se ordenan por prioridad y se muestran en un tablero de empresa con columnas Ahora, Siguiente y Después. Cada parte de la organización tiene su propio tablero enlazado al de arriba.

**Qué puedes copiar.** Escribe en la parte estable la cadena DIBB de tu iniciativa. Si dentro de tres meses los datos cambian, se ve qué creencia cae y qué apuesta revisar.

### Linear: el estado vive junto al proyecto

**Qué hacen.** En Linear, cada proyecto tiene una página de resumen donde se publican las actualizaciones de estado. Lo cuentan en su documentación de [project updates](https://linear.app/docs/initiative-and-project-updates).

**Cómo.** Cada actualización lleva un indicador de salud (en marcha, en riesgo, desviado) y un texto. La última se muestra en el resumen y las anteriores quedan en la pestaña de actualizaciones, junto con los cambios de fecha objetivo, miembros o hitos. En su propio equipo, el responsable de cada proyecto publica una actualización semanal y, en la reunión semanal, dedican unos minutos a leerlas en silencio antes de comentarlas.

**Qué puedes copiar.** El semáforo con texto, fechado, con el historial a la vista. Y dedicar los primeros minutos de la reunión semanal a leer el documento, no a contarlo.

## Plantilla

Cópiala en tu herramienta de documentos. Borra lo que no uses, pero no borres la cabecera ni el registro de decisiones.

```markdown
# [Nombre de la iniciativa]

| Dueño (DRI) | Aprueba | Estado | Última revisión |
|---|---|---|---|
| @nombre | @nombre | Descubrimiento / En curso / Lanzado / Archivado | AAAA-MM-DD |

> Este es el documento de referencia de la iniciativa. Si algo no está aquí, no está decidido.

---

## Parte estable (se revisa cada mes)

### 1. Problema y para quién
- Quién tiene el problema: [segmento concreto]
- Qué le pasa hoy: [en sus palabras]
- Cómo lo resuelve ahora y por qué no basta: [...]
- Por qué ahora: [...]

### 2. Objetivos y no objetivos
**Objetivos**
- [Objetivo 1, verificable]
- [Objetivo 2]

**No objetivos**
- [Lo que alguien podría esperar y no vamos a hacer]

### 3. Métricas de éxito
| Métrica | Hoy | Objetivo | Fecha | Fuente |
|---|---|---|---|---|
| Principal: [...] | [...] | [...] | [...] | [enlace al panel] |
| Control: [...] | [...] | no empeorar | [...] | [...] |

### 4. Alcance y fechas clave
- Entra en la v1: [...]
- Queda fuera de la v1: [...]
- Hitos: [hito] – [fecha]

### 5. Solución en una página
[Resumen de la solución en 5–10 frases. El detalle va en la spec.]

### 6. Riesgos y preguntas abiertas
| Riesgo o pregunta | Quién lo resuelve | Para cuándo |
|---|---|---|
| [...] | @nombre | AAAA-MM-DD |

---

## Parte viva (se actualiza cada semana)

### 7. Estado
**AAAA-MM-DD · En marcha / En riesgo / Desviado**
- Qué ha pasado: [...]
- Qué viene: [...]
- Qué bloquea y a quién necesitamos: [...]

<!-- El estado nuevo va arriba. No borres los anteriores. -->

### 8. Registro de decisiones
| # | Fecha | Decisión | Decide | Por qué | Estado |
|---|---|---|---|---|---|
| 1 | AAAA-MM-DD | Aprobamos la iniciativa con el alcance v1 | @nombre | [...] | Vigente |
| 2 | AAAA-MM-DD | [...] | @nombre | [...] | Sustituida por #4 |

### 9. Enlaces
- Spec / PRD: [enlace]
- Diseños: [enlace]
- Tablero de tareas: [enlace]
- Panel de métricas: [enlace]
- Investigación con usuarios: [enlace]
- Canal del proyecto: [enlace]

---

## Cierre (al terminar)
- Resultado frente a las métricas: [...]
- Qué aprendimos: [...]
- Qué queda pendiente y quién lo hereda: [...]
```

## Tips

- **Pon la fecha de última revisión arriba del todo.** Es la forma más rápida de saber si puedes fiarte de lo que lees.
- **Responde con enlaces.** Cuando te pregunten en el chat, contesta con el enlace a la sección exacta. A la tercera vez, la gente va directa al documento.
- **Una decisión, una fila, el mismo día.** Si esperas a la semana siguiente, ya no te acuerdas del porqué.
- **Escribe el porqué, no solo el qué.** "Retrasamos a marzo" no sirve. "Retrasamos a marzo porque la integración con el banco no estará certificada antes" sí.
- **Los no objetivos ahorran reuniones.** Cada "esto no lo vamos a hacer" escrito es una discusión que no vuelve.
- **Abre la reunión semanal leyendo.** Cinco minutos en silencio con el estado delante. Luego, solo preguntas.
- **Deja los huecos a la vista.** "Pendiente: precio, lo cierra @Marta el 5 de diciembre" es mejor que una sección inventada.
- **La misma plantilla para todo el equipo.** Si todos los documentos tienen las mismas secciones, cualquiera encuentra lo que busca en cualquier proyecto.
- **Mide si funciona.** Si siguen llegando las mismas preguntas por chat, el documento no está donde la gente mira o no responde a lo que preguntan.

## Errores típicos

- **Dos documentos "oficiales".** La presentación de dirección dice una fecha y el documento otra. Elige uno como fuente y que el otro enlace.
- **Documento sin dueño.** Lo escribe todo el mundo, así que no lo actualiza nadie. A las tres semanas está muerto.
- **Reescribir el estado en vez de añadirlo.** Pierdes la historia. Nadie puede ver cuándo empezó a torcerse el proyecto.
- **Borrar decisiones revertidas.** Dentro de un año alguien propondrá lo mismo y no sabrá que ya se probó y por qué se descartó.
- **Meter la spec entera dentro.** El documento de referencia resume y enlaza. Si tiene cuarenta páginas, nadie lo relee y nadie lo mantiene.
- **Decidir en el chat y no pasarlo al documento.** Es el error que rompe todo lo demás. Si pasa una vez, la gente aprende que el documento va por detrás.

## Para seguir aprendiendo

- [The importance of a handbook-first approach to communication](https://handbook.gitlab.com/handbook/company/culture/all-remote/handbook-first/), GitLab. La explicación más completa de por qué escribir primero y anunciar después.
- [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/), Malte Ubl. Estructura, ciclo de vida y cuándo no merece la pena escribir uno.
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions), Michael Nygard. El artículo que popularizó los registros de decisiones. Corto y aplicable fuera de la arquitectura.
- [Working Backwards PR/FAQ Instructions & Template](https://www.workingbackwards.com/resources/working-backwards-pr-faq), web de *Working Backwards*, el libro de Colin Bryar y Bill Carr. Cómo escribir y revisar un PR/FAQ, borrador a borrador.
- [Project Poster](https://www.atlassian.com/team-playbook/plays/project-poster) y [DACI](https://www.atlassian.com/team-playbook/plays/daci), Atlassian Team Playbook. Dos guías prácticas, con plantillas, para planificar y decidir por escrito.

Última revisión: 23 de noviembre de 2026.

Siguiente en la serie: Del problema a la apuesta: priorizar (próximamente).

## También te puede interesar

- [Qué hace de verdad un product manager](/blog/producto-que-hace-un-product-manager)
- [Claridad extrema: escribir para que nadie tenga que adivinar](/blog/producto-claridad-extrema)
