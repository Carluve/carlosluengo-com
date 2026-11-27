---
publishDate: 2026-12-21T09:00:00Z
draft: false
image: 'media:blog/producto-escribir-una-spec/portada.png'
title: 'Escribir una spec o PRD que se lea'
excerpt: 'Serie Producto, parte 7. Cómo escribir una especificación de producto que el equipo lea, entienda y use: siete pasos, del problema a los criterios de aceptación y los no objetivos. Con lo que hacen Amazon, Google, Basecamp, HashiCorp y Atlassian, una plantilla de una página para copiar y los errores típicos.'
category: 'Producto'
tags:
  - 'producto'
  - 'product management'
  - 'serie producto'
  - 'prd'
  - 'especificación'
  - 'escritura'
lang: 'es'
---

> **Serie Producto, parte 7 de 10.** Un post por semana para aprender gestión de producto: la idea, una metodología paso a paso, qué hacen las grandes empresas y tips para aplicarlo mañana.

La spec tiene veintidós páginas. Tiene un índice, un glosario, diagramas de flujo y una tabla de requisitos con códigos. El equipo la abre el primer día, lee la introducción y vuelve a ella solo cuando hay una discusión. Tres semanas después, alguien pregunta en el chat qué tiene que pasar si el usuario no tiene tienda conectada. Está en la página catorce. Nadie llegó.

En la parte 2 vimos cómo escribir claro y en la parte 4 cómo elegir una apuesta. Este post junta las dos cosas: cómo convertir una apuesta en un documento que el equipo lea entero, que responda las preguntas difíciles antes de que alguien las haga y que siga siendo útil cuando el proyecto ya ha empezado.

## La idea en dos minutos

Una spec, o PRD (documento de requisitos de producto), no es un contrato. Es **la explicación escrita de qué problema resolvemos, para quién, cómo sabremos que lo hemos resuelto y qué no vamos a hacer**.

Tres ideas sostienen todo el método:

1. **Primero el problema, luego la solución.** Si el equipo no está de acuerdo en el problema, discutirá la solución sin fin. Por eso hay empresas que aprueban el problema antes de que nadie escriba una línea de diseño.
2. **Lo que no haces es tan importante como lo que haces.** Una lista explícita de no objetivos evita más discusiones que cualquier requisito.
3. **Los requisitos se escriben como comportamientos que se pueden comprobar.** «El sistema debe ser fácil de usar» no se puede probar. «Dado un usuario sin tienda conectada, cuando abre el panel, entonces ve el botón para conectar una» sí.

La palabra clave es _leída_. Una spec que nadie lee entera no sirve, por muy completa que sea. Mejor una página que todos entienden que veinte que nadie termina.

## Por qué importa

**Porque escribir obliga a pensar.** Un diagrama o una lista de puntos pueden esconder huecos. Un párrafo que explica por qué hacemos algo no: si la lógica falla, se nota al leerlo.

**Porque las preguntas que no se responden por escrito se responden en el código.** Cada caso que la spec no cubre lo decide alguien a solas, a las once de la noche, con la información que tenga. A veces acierta.

**Porque el equipo necesita saber qué es «terminado».** Sin criterios de aceptación, el trabajo termina cuando se acaba el tiempo, no cuando se cumple el objetivo.

**Porque la spec es la memoria del proyecto.** Dentro de seis meses, alguien preguntará por qué se hizo así. Si la respuesta está escrita, se ahorra una reunión y un error.

**Porque una spec mal escrita da una falsa sensación de control.** Marty Cagan lo advirtió en [2006](https://www.svpg.com/revisiting-the-product-spec/): que exista el documento hace creer a todos que el proyecto va bien, aunque las preguntas difíciles sigan sin respuesta.

## La metodología, paso a paso

Siete pasos, del problema a una spec viva. Los tres primeros explican el porqué. Los dos siguientes, el qué. Los dos últimos hacen que la lean y que siga siendo cierta.

![La metodología para escribir una spec en siete pasos: empieza por el problema, escribe la nota de prensa, objetivos y no objetivos, requisitos comprobables, preguntas y riesgos, revisión en silencio y mantenla viva](media:blog/producto-escribir-una-spec/01-metodologia.png)

### 1. Empieza por el problema

**Qué hacer:** copia la oportunidad de la ficha de apuesta de la parte 4 y amplíala. Para quién es, qué no puede hacer hoy, cómo lo sabemos (datos, entrevistas de la parte 6) y qué pasa si no hacemos nada.

**Produce:** un párrafo de problema que cualquiera del equipo podría repetir sin mirar. Si necesitas más de un párrafo, quizá son dos problemas.

### 2. Escribe la nota de prensa

**Qué hacer:** antes de describir la solución, escribe el anuncio que publicarías el día del lanzamiento. Un titular, una frase con el cliente y el beneficio, el problema, cómo lo resuelve y una cita de un cliente imaginario. Menos de una página.

**Produce:** la promesa al cliente en su idioma. Si no es emocionante o no se entiende, el problema está en la idea, no en la redacción.

### 3. Escribe objetivos y no objetivos

**Qué hacer:** enumera lo que tiene que conseguir el proyecto (con la métrica de la parte 5) y lo que deliberadamente no va a hacer. Un no objetivo no es cualquier cosa que no hagas: es algo que alguien podría esperar razonablemente y que has decidido dejar fuera.

**Produce:** dos listas cortas. Tres objetivos como máximo. Los no objetivos, todos los que eviten una discusión.

### 4. Escribe requisitos que se puedan comprobar

**Qué hacer:** describe cómo se comporta el producto desde fuera, no cómo se construye por dentro. Para los casos importantes, usa el formato Dado, Cuando, Entonces: el contexto, la acción y el resultado observable. Incluye los casos tristes: sin datos, sin permisos, sin conexión.

**Produce:** una lista de criterios de aceptación. Si un criterio no se puede probar, reescríbelo hasta que se pueda.

### 5. Escribe las preguntas abiertas y los riesgos

**Qué hacer:** apunta lo que todavía no sabes y lo que podría hundir el proyecto. Para cada pregunta, quién la responde y cuándo. Para cada riesgo, cómo lo vas a comprobar o a evitar.

**Produce:** una tabla de preguntas con dueño y fecha. Una spec sin preguntas abiertas no es una spec terminada: es una spec que esconde dudas.

### 6. Haz que la lean en silencio

**Qué hacer:** convoca una reunión corta y empieza con lectura en silencio. Diez o quince minutos para leer, luego comentarios. Pide primero acuerdo sobre el problema y los no objetivos, después sobre la solución.

**Produce:** comentarios escritos, una lista de cambios y una aprobación explícita de quien tenga que darla.

### 7. Mantenla viva

**Qué hacer:** pon un estado arriba (borrador, en revisión, aprobada, en construcción, lanzada). Cuando cambie algo, actualiza la spec y anota la decisión con fecha. Enlázala desde el documento de referencia de la parte 3.

**Produce:** un documento que dice la verdad hoy, no la de hace un mes.

## Qué hacen otras empresas

Seis formas de escribir antes de construir, cada una con algo concreto que copiar.

![Seis formas de escribir una spec: Amazon, Amazon, Google, Basecamp, HashiCorp y Atlassian](media:blog/producto-escribir-una-spec/02-empresas.png)

### Amazon: la nota de prensa antes del producto

**Qué hace.** Según un extracto de _Working Backwards_, de Colin Bryar y Bill Carr, publicado en [la web de Amazon](https://www.aboutamazon.com/news/workplace/an-insider-look-at-amazons-culture-and-processes), Amazon empieza las ideas grandes con un PR/FAQ: una nota de prensa de menos de una página y unas preguntas frecuentes de cinco páginas como máximo. En la reunión, los asistentes lo leen en silencio antes de comentar. La [plantilla](https://workingbackwards.com/resources/working-backwards-pr-faq/) separa las preguntas externas (precio, cómo funciona) de las internas (economía, inversión, riesgos), e incluye una que obliga a ser honesto: las tres razones principales por las que el producto podría fracasar.

**Qué puedes copiar.** El paso 2 de este post. Y la pregunta de las tres razones de fracaso en tu sección de riesgos.

### Amazon: seis páginas en lugar de diapositivas

**Qué hace.** En su [carta a los accionistas de 2017](https://www.aboutamazon.com/news/company-news/2017-letter-to-shareholders), Jeff Bezos explicó que en Amazon no se usan presentaciones de diapositivas. Se usan memorandos narrativos de seis páginas que se leen en silencio al principio de la reunión. Bezos añade que un buen memorando se reescribe, se comparte, se deja reposar y se vuelve a editar, y que probablemente lleva una semana o más.

**Qué puedes copiar.** Escribe en párrafos, no en viñetas, las partes donde hay un razonamiento: el problema, el porqué y las alternativas descartadas.

### Google: objetivos, no objetivos y alternativas

**Qué hace.** Malte Ubl describe en [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/) los documentos de diseño que los equipos escriben antes de programar. Tienen contexto y alcance, objetivos y no objetivos, el diseño, las alternativas consideradas y los temas transversales como seguridad y privacidad. Define los no objetivos como cosas que razonablemente podrían ser objetivos y se descartan a propósito. Para proyectos grandes rondan las 10 a 20 páginas; para cambios pequeños hay una versión de una a tres. Y avisa: si el documento solo describe cómo implementarlo, sin decisiones difíciles, probablemente no hacía falta.

**Qué puedes copiar.** La sección de alternativas consideradas. Explicar por qué no elegiste otra opción ahorra la conversación en la que alguien la propone de nuevo.

### Basecamp: el pitch con apetito y madrigueras

**Qué hace.** En [Shape Up](https://basecamp.com/shapeup/1.5-chapter-06), Ryan Singer describe el _pitch_ que se presenta a la mesa de apuestas. Tiene cinco ingredientes: el problema, el apetito (cuánto tiempo queremos dedicarle), la solución, las madrigueras (lo demasiado incierto o complejo para apostar) y lo que queda fuera. Insiste en presentar siempre problema y solución juntos, y en dibujar la solución con bocetos gruesos para no diseñarla de más.

**Qué puedes copiar.** La sección de madrigueras: lo que podría tragarse el proyecto si no lo acotas desde el principio.

### HashiCorp: aprobar el problema antes de la solución

**Qué hace.** HashiCorp explica en [su web](https://www.hashicorp.com/en/how-hashicorp-works/articles/writing-practices-and-culture) que separa dos documentos. El PRD, que para ellos significa documento de requisitos del _problema_, explica el porqué y lo suele escribir producto. El RFC propone el cómo y lo suelen escribir ingenieros. Todos los interesados tienen que aprobar el PRD antes de empezar. Y añaden una regla práctica: si implementar la idea cuesta menos que escribirla, no escribas el RFC. Su [plantilla de PRD](https://www.hashicorp.com/en/how-hashicorp-works/articles/prd-template) pide escribir la introducción al final y formular las consideraciones como preguntas.

**Qué puedes copiar.** Pide la aprobación del problema en una reunión distinta de la de la solución.

### Atlassian: «lo que no vamos a hacer»

**Qué hace.** La [guía de requisitos de Atlassian](https://www.atlassian.com/agile/product-management/requirements) propone un PRD con ocho secciones, entre ellas supuestos, historias de usuario con métricas de éxito, una tabla de preguntas por decidir o investigar y una sección final de lo que no vamos a hacer. También lista los errores que quiere evitar: especificarlo todo antes de empezar, exigir firmas de todos los equipos y no actualizar los requisitos después.

**Qué puedes copiar.** La tabla de preguntas con dueño. Convierte las dudas en trabajo asignado.

## Plantilla

Esta es la spec de una página. Las secciones van en este orden porque es el orden en que se discuten: primero el porqué, luego el qué y al final lo que falta por saber.

![Anatomía de la spec de una página: estado y problema arriba, nota de prensa y objetivos en medio, requisitos, preguntas y decisiones abajo](media:blog/producto-escribir-una-spec/03-plantilla.png)

```markdown
# Spec: [nombre que dice lo que cambia]

**Estado:** borrador | en revisión | aprobada | en construcción | lanzada
**Dueño:** [una persona] · **Apuesta:** [enlace] · **Última actualización:** [fecha]

## Problema

[Quién] no puede [qué] cuando [contexto]. Lo sabemos porque [dato o cita, con enlace].
Si no hacemos nada, [consecuencia].

## Nota de prensa (menos de 10 líneas)

**[Titular]**
[Una frase: para quién y qué beneficio.]
[El problema, desde el cliente.]
[Cómo lo resuelve.]
«[Cita de un cliente imaginario.]»

## Objetivos

1. [Métrica] de [valor actual] a [objetivo] antes del [fecha]

## No objetivos

- No haremos [X], aunque [por qué alguien podría esperarlo].

## Requisitos (criterios de aceptación)

- **Dado** [contexto], **cuando** [acción], **entonces** [resultado observable].
- **Dado** [caso triste: sin datos, sin permisos...], **cuando** [...], **entonces** [...].

## Alternativas descartadas

- [Opción]: la descartamos porque [motivo].

## Preguntas abiertas y riesgos

| Pregunta o riesgo | Dueño | Fecha | Respuesta |
| ----------------- | ----- | ----- | --------- |
|                   |       |       |           |

## Registro de decisiones

- [fecha]: decidimos [qué] porque [motivo].
```

Y así queda un criterio de aceptación bien escrito, con su caso triste:

```gherkin
Escenario: conectar la primera tienda
  Dado un usuario nuevo sin ninguna tienda conectada
  Cuando abre el panel por primera vez
  Entonces ve un único botón «Conecta tu tienda»
  Y no ve gráficos vacíos

Escenario: la tienda no responde
  Dado un usuario que intenta conectar su tienda
  Cuando la tienda no responde en 30 segundos
  Entonces ve un mensaje que explica qué comprobar
  Y puede volver a intentarlo sin perder lo que había escrito
```

## Tips

- **Escribe la introducción al final.** Es lo que todos leen. Cuando la escribes al principio, describe lo que pensabas; al final, lo que has decidido.
- **Una spec por apuesta, no por funcionalidad.** Si la spec cubre varias apuestas, nadie sabe qué aprobar.
- **Pon el estado en la primera línea.** Que nadie construya a partir de un borrador creyendo que está aprobado.
- **Explica las decisiones con «porque».** Un requisito sin motivo se cuestiona cada semana. Con motivo, una vez.
- **Prefiere un boceto a un párrafo para la interfaz.** Las palabras son mejores para el porqué; los dibujos, para el dónde.
- **Deja que ingeniería escriba el cómo.** Tu spec dice qué y por qué. El diseño técnico es su documento.
- **Mide la longitud por el tiempo de lectura.** Si se lee en más de quince minutos, recorta o divide.
- **Si construirlo es más rápido que escribirlo, constrúyelo.** No todo necesita spec.

## Errores típicos

- **Empezar por la solución.** La spec se convierte en la descripción de una pantalla y nadie sabe qué problema resuelve.
- **Escribirla a solas y presentarla terminada.** El equipo la recibe como una orden. Escríbela con ingeniería y diseño desde el primer borrador.
- **Requisitos que no se pueden probar.** «Rápido», «intuitivo» y «robusto» no son requisitos. Son deseos.
- **No escribir lo que queda fuera.** Cada no objetivo que falta reaparece como petición a mitad del proyecto.
- **Confundir longitud con rigor.** Veinte páginas no garantizan que estén las preguntas difíciles. Muchas veces sirven para esconderlas.
- **Abandonarla al empezar a construir.** Una spec desactualizada es peor que ninguna, porque alguien la creerá.

## Para seguir aprendiendo

- [Working Backwards PR/FAQ](https://workingbackwards.com/resources/working-backwards-pr-faq/), de los autores de _Working Backwards_. La plantilla completa de la nota de prensa y las preguntas frecuentes.
- [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/), de Malte Ubl. Qué es un documento de diseño, qué secciones tiene y cuándo no escribirlo.
- [Write the Pitch](https://basecamp.com/shapeup/1.5-chapter-06), capítulo de Shape Up. Los cinco ingredientes del pitch, con ejemplos.
- [Writing Practices & Culture](https://www.hashicorp.com/en/how-hashicorp-works/articles/writing-practices-and-culture), de HashiCorp. PRD frente a RFC y cómo se aprueban.
- [Gherkin Reference](https://cucumber.io/docs/gherkin/reference/), de Cucumber. La sintaxis de Dado, Cuando y Entonces, con la recomendación de tres a cinco pasos por ejemplo.

Última revisión: 26 de noviembre de 2026.

Siguiente en la serie: [Ser diferente: estrategia y posicionamiento](/blog/producto-estrategia-y-posicionamiento).

## También te puede interesar

- [Claridad extrema: escribir para que nadie tenga que adivinar](/blog/producto-claridad-extrema)
- [El documento de referencia único](/blog/producto-documento-de-referencia-unico)
- [Del problema a la apuesta: cómo priorizar](/blog/producto-como-priorizar)
