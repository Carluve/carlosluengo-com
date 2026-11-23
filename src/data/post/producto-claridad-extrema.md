---
publishDate: 2026-11-16T09:00:00Z
draft: false
image: 'media:blog/producto-claridad-extrema/portada.png'
title: 'Claridad extrema: escribir para que nadie tenga que adivinar'
excerpt: 'Serie Producto, parte 2. Por qué escribir es la herramienta principal de un product manager, una lista de siete pasos para reescribir cualquier mensaje o documento, qué hacen Amazon, Stripe, Netflix, 37signals, Atlassian y GitLab, y una plantilla de memo de decisión de una página.'
category: 'Producto'
tags:
  - 'producto'
  - 'product management'
  - 'serie producto'
  - 'escritura'
  - 'toma de decisiones'
  - 'comunicación'
lang: 'es'
---

> **Serie Producto, parte 2 de 10.** Un post por semana para aprender gestión de producto: la idea, una metodología paso a paso, qué hacen las grandes empresas y tips para aplicarlo mañana.

En la [parte 1](/blog/producto-que-hace-un-product-manager) vimos que un product manager no tiene autoridad formal sobre casi nadie. Diseño, ingeniería, ventas y dirección no dependen de ti. Lo único que tienes es la capacidad de que todos entiendan lo mismo y tiren en la misma dirección. Y eso, casi siempre, se hace escribiendo.

Este post va de una habilidad poco vistosa: escribir de forma que nadie tenga que adivinar qué decides, por qué, qué queda fuera y quién tiene la última palabra. No es estilo. Es la forma más barata de evitar semanas de trabajo en la dirección equivocada.

## La idea en dos minutos

Un mensaje es claro cuando el lector puede actuar sin preguntarte nada. Para conseguirlo, cualquier documento de producto tiene que responder cinco preguntas:

1. **Qué se decide** (o qué propones), en una frase.
2. **Por qué**, con hechos que se puedan comprobar.
3. **Qué queda fuera**, dicho de forma explícita.
4. **Quién decide** y cuándo.
5. **Qué necesitas del lector**, con fecha.

Y la respuesta a la primera pregunta va arriba del todo. El ejército de Estados Unidos lo llama BLUF, *bottom line up front*: la conclusión primero, el contexto después.

Hay una segunda idea, igual de importante: **escribir es pensar**. Si no puedes escribir el problema en una frase, no es un problema de redacción. Es que todavía no lo entiendes. El documento no es el resultado del trabajo. Es la forma de descubrir si el trabajo tiene sentido.

La tercera idea cierra el círculo. Cuando todo está por escrito y alguien ha decidido, el equipo puede discrepar y aun así comprometerse. Sin decisión escrita, cada desacuerdo se reabre en cada reunión.

## Por qué importa

**Porque la ambigüedad se paga después, y con intereses.** Una frase vaga en una spec («mejorar el onboarding») se convierte en tres interpretaciones distintas en diseño, ingeniería y marketing. Lo descubres en la demo, cuando ya está construido.

**Porque la mayoría de la gente no lee tu documento entero.** Lee la primera línea, quizá el primer párrafo. Si lo importante está en la página tres, para esa persona no existe.

**Porque las reuniones no escalan y los documentos sí.** Lo que se dice en una sala solo lo oyen los que estaban. Lo que se escribe lo puede leer quien llega dentro de seis meses, quien está en otro huso horario o quien entra nuevo al equipo.

**Porque escribir te obliga a elegir.** En una conversación puedes ser vago sin que se note. En una página con un apartado «Fuera de alcance» no puedes.

**Porque un buen documento da autonomía.** Si el equipo sabe qué se decidió y por qué, puede tomar decenas de decisiones pequeñas sin preguntarte. Esa es la diferencia entre un PM que es un cuello de botella y uno que multiplica al equipo.

## La metodología, paso a paso

Esta es la lista que uso para reescribir cualquier cosa antes de enviarla: un mensaje de Slack largo, un correo a dirección, una spec o un memo. Son siete pasos. Para un mensaje corto te llevará cinco minutos. Para un documento importante, una tarde.

![La lista de claridad en siete pasos: decisión en una frase, lector y petición, problema en una frase, el porqué con datos, fuera de alcance, quién decide y cuándo, y prueba del lector frío](media:blog/producto-claridad-extrema/01-metodologia.png)

**1. Escribe la decisión en una frase.**
Qué hacer: antes de escribir nada más, termina esta frase: «Recomiendo/Hemos decidido ___ porque ___». Si no te cabe en una frase, divide el documento o sigue pensando.
Produce: la primera línea del documento (tu BLUF).

**2. Nombra al lector y lo que necesitas de él.**
Qué hacer: escribe para quién es y qué tiene que hacer: aprobar, opinar, enterarse o ejecutar. Pon fecha. «Para Marta: necesito tu aprobación antes del jueves 26» es claro. «Para vuestra consideración» no lo es.
Produce: la segunda línea, con persona, acción y fecha.

**3. Escribe el problema en una frase.**
Qué hacer: usa este molde: «[Quién] no puede [hacer qué], y eso nos cuesta [cuánto]». Por ejemplo: «Las pymes que se dan de alta no consiguen conectar su primera tienda, y el 40 % abandona en la primera semana». Si no tienes el número, dilo: «no lo hemos medido» también es información.
Produce: el enunciado del problema.

**4. Explica el porqué con hechos, no con adjetivos.**
Qué hacer: busca tres hechos que sostengan la decisión. Cada uno con su fuente: un dato, una cita de una entrevista, un ticket de soporte. Elimina «muy», «clave», «crítico» y «estratégico». Si una frase solo funciona con un adjetivo, le falta un dato.
Produce: tres viñetas de contexto que alguien puede comprobar.

**5. Escribe lo que queda fuera.**
Qué hacer: lista lo que no vas a hacer, aunque parezca obvio. Las opciones que descartaste y por qué. Los casos de uso que no cubres en esta versión. Aquí es donde se evitan la mayoría de los malentendidos.
Produce: una lista de «no haremos» y una de opciones descartadas.

**6. Di quién decide y cuándo.**
Qué hacer: nombra a una sola persona con la última palabra, a quién se consulta y a quién se informa. Pon la fecha de la decisión y el estado (borrador, en revisión, decidido). Cuando la decisión esté tomada, escríbelo arriba. Quien no estaba de acuerdo puede dejarlo por escrito y comprometerse igualmente.
Produce: una línea de roles y una fecha.

**7. Pasa la prueba del lector frío.**
Qué hacer: dáselo a alguien que no conozca el tema y pídele que te responda, sin mirar, a cinco preguntas: qué se decide, por qué, qué queda fuera, quién decide y qué le piden a él. Si falla una, vuelve al paso que corresponde. Después recorta: quita todo lo que no ayuda a responder esas cinco preguntas.
Produce: la versión final, más corta que el primer borrador.

Un truco para el paso 7: si no tienes a nadie a mano, léelo mañana por la mañana. Tú mismo dentro de 24 horas eres un lector bastante frío.

## Qué hacen otras empresas

Ninguna de estas empresas tiene un «estilo» en el sentido literario. Lo que tienen son rituales que obligan a escribir claro. Eso es lo que vale la pena copiar.

![Mapa de seis empresas: Amazon, Stripe, Netflix, 37signals, Atlassian y GitLab, con lo que hace cada una y la idea que puedes copiar](media:blog/producto-claridad-extrema/02-empresas.png)

### Amazon: memos narrativos y «disagree and commit»

**Qué hacen.** En su [carta a los accionistas de 2017](https://www.aboutamazon.com/news/company-news/2017-letter-to-shareholders), Jeff Bezos explica que en Amazon no se usan presentaciones de diapositivas: se escriben memos narrativos de seis páginas, y cada reunión empieza con todos leyendo el memo en silencio, como en una sala de estudio. La misma carta dice que un buen memo se escribe y se reescribe, se comparte con colegas a los que se pide que lo mejoren y probablemente lleva una semana o más.

**Cómo deciden.** En la [carta de 2016](https://www.aboutamazon.com/news/company-news/2016-letter-to-shareholders) Bezos defiende decidir con alrededor del 70 % de la información que te gustaría tener, y usar la frase «disagree and commit»: discrepar, decirlo y comprometerse igualmente con la decisión. Él mismo cuenta que lo hace a menudo.

**Qué puedes copiar.** Dedica los primeros diez minutos de tu próxima reunión de decisión a leer un documento en silencio. Nadie presenta. Verás que la conversación cambia: se discute el contenido, no la forma.

### Stripe: documentos de arranque con no-objetivos

**Qué hacen.** Brie Wolfson, que trabajó en Stripe, describe en el [podcast de First Round Review](https://review.firstround.com/podcast/episode-82) una cultura de documentos recurrentes y muy leídos: retrospectivas escritas por quien hizo el trabajo, correos de «shipped» con secciones de contexto y criterios de éxito, y documentos de arranque de proyecto. Su plantilla de arranque incluye la hipótesis, los **no-objetivos**, el trabajo previo, las métricas, el alcance y un responsable único (DRI). También cuenta que había personas que hacían de «bolígrafo rojo» y revisaban la escritura de otros. Una frase suya lo resume: «I cannot think about anything clearly until it's written».

**Qué puedes copiar.** Un apartado de no-objetivos en cada documento de arranque. Y que alguien del equipo revise tus documentos importantes igual que se revisa el código.

### Netflix: memos abiertos y un capitán por decisión

**Qué hacen.** La [página de cultura de Netflix](https://jobs.netflix.com/culture) explica que comparten mucha información internamente, también mediante memos en los que los empleados pueden comentar y hacer preguntas. Cada decisión importante tiene un «capitán informado» que toma la decisión, y se espera que ese capitán busque activamente opiniones contrarias («farming for dissent»). Los responsables practican «context, not control»: dar contexto en vez de controlar cada decisión.

**Qué puedes copiar.** Abre el borrador a comentarios antes de decidir. Pide a quien sabes que no está de acuerdo que escriba su objeción. Y deja un solo nombre como responsable.

### 37signals (Basecamp): escribir antes que chatear

**Qué hacen.** Su [guía de comunicación interna](https://basecamp.com/guides/how-we-communicate) es una lista de principios: asíncrono casi siempre, las reuniones como último recurso y lo importante por escrito, no en un chat. Una de sus frases resume la idea: «Writing solidifies, chat dissolves». Para decidir qué construir, su método [Shape Up](https://basecamp.com/shapeup/1.5-chapter-06) usa un *pitch* con cinco ingredientes: problema, apetito (cuánto tiempo estás dispuesto a dedicarle), solución, riesgos («rabbit holes») y **no-gos**, lo que se excluye a propósito.

**Qué puedes copiar.** Antes de proponer una solución, escribe el apetito: «esto vale dos semanas, no más». La conversación sobre el alcance cambia por completo.

### Atlassian: DACI, un solo aprobador

**Qué hacen.** Atlassian publica en su Team Playbook el [marco DACI](https://www.atlassian.com/team-playbook/plays/daci): *Driver* (quien impulsa la decisión), *Approver* (quien decide), *Contributors* (quien aporta conocimiento) e *Informed* (quien solo necesita saberlo). Su [blog](https://www.atlassian.com/blog/project-management/daci-method-for-better-project-decisions) insiste en que el aprobador debe ser una sola persona, no varias, y propone una página de decisión con estado, contexto, datos, una tabla de opciones con pros y contras, preguntas abiertas y el resultado final con su razonamiento.

**Qué puedes copiar.** Una línea al principio de cada documento de decisión con los cuatro roles. Si no sabes quién es el *Approver*, ese es tu primer problema.

### GitLab: comunicación de bajo contexto

**Qué hacen.** El [manual de comunicación de GitLab](https://handbook.gitlab.com/handbook/communication/) pide comunicación «de bajo contexto»: ser explícito y dar todo el contexto posible, porque el lector puede estar en otra parte del mundo y no tiene tu información. Dos ejemplos concretos del manual: al enlazar una incidencia, incluye una vista previa de su contenido, para que el lector tenga toda la información en la primera lectura y use el enlace solo para ampliar; y el título de cada diapositiva debe ser el mensaje, no el tema («nuestros ingresos se han más que duplicado» en vez de «crecimiento de ingresos»). Las conclusiones de conversaciones fuera de línea se escriben en una única fuente de verdad, y cuando no aceptas un comentario, explicas por qué, no solo qué.

**Qué puedes copiar.** Títulos que digan la conclusión. Aplícalo a títulos de documentos, asuntos de correo y diapositivas.

## Plantilla

Este es el memo de decisión de una página. Cópialo, rellénalo de arriba abajo y borra lo que no aplique.

![Anatomía del memo de decisión de una página: decisión y petición arriba, problema, contexto y opciones en medio, fuera de alcance, riesgos y roles abajo](media:blog/producto-claridad-extrema/03-plantilla.png)

```markdown
# [Título que dice la conclusión, no el tema]

**Decisión (BLUF):** Recomiendo [qué] para [quién] porque [razón principal].
**Petición:** [Nombre], necesito que [apruebes / opines / te enteres] antes del [fecha].
**Estado:** Borrador | En revisión | Decidido el [fecha]

## 1. Problema
[Quién] no puede [hacer qué], y eso nos cuesta [cuánto / cómo lo sabemos].

## 2. Contexto
- Hecho 1: [dato] — fuente: [enlace]
- Hecho 2: [cita de usuario o ticket] — fuente: [enlace]
- Hecho 3: [dato] — fuente: [enlace]

## 3. Opciones consideradas
| Opción | Qué es | A favor | En contra | Coste |
|---|---|---|---|---|
| A (recomendada) | | | | |
| B | | | | |
| No hacer nada | | | | |

## 4. Fuera de alcance
- No haremos [X] en esta versión porque [razón].
- No cubrimos [caso de uso Y].

## 5. Riesgos y qué nos haría cambiar de opinión
- Riesgo: [...] → cómo lo mitigamos: [...]
- Cambiaríamos de decisión si [señal medible].

## 6. Roles (DACI)
- Driver: [nombre]
- Approver (una sola persona): [nombre]
- Contributors: [nombres]
- Informed: [equipos o personas]

## 7. Desacuerdos registrados
- [Nombre]: [objeción en una frase]. Se compromete con la decisión: sí / no.
```

## Tips

- **Escribe primero la última línea.** Si sabes cómo termina el documento, es decir, la decisión, el resto se ordena solo.
- **Una idea por párrafo, una acción por mensaje.** Si pides tres cosas en un correo, te contestarán a una.
- **Los asuntos y títulos son frases completas.** «Retrasamos el lanzamiento al 9 de diciembre» informa. «Actualización del lanzamiento» no.
- **Cambia adjetivos por números.** «Muchos usuarios» → «32 de 50 entrevistados». Si no tienes el número, escribe «no lo sabemos» y cómo lo vas a averiguar.
- **Usa los nombres de las personas, no de los equipos.** «Ingeniería se encargará» no tiene responsable. «Luis se encargará» sí.
- **Pon fechas absolutas.** «La semana que viene» depende de cuándo se lea. «El martes 1 de diciembre» no.
- **Define cada sigla la primera vez.** Y si el documento tiene más de cinco, añade un glosario de tres líneas.
- **Separa el borrador del documento final.** Marca el estado arriba. Nada confunde más que un documento que parece decidido y no lo está.
- **Pide comentarios por escrito a quien no estaba en la reunión.** Es la mejor prueba de que el documento se entiende solo.
- **Relee en voz alta.** Las frases que te hacen tropezar son las que tu lector va a saltarse.

## Errores típicos

- **Escribir en orden cronológico.** «Primero investigamos, luego vimos, después pensamos...» y la conclusión en el último párrafo. El lector no llega.
- **Confundir longitud con rigor.** Un documento de veinte páginas que nadie lee no es más riguroso que uno de una página que todo el mundo entiende.
- **No escribir lo que queda fuera.** Lo que no dices que excluyes, alguien lo da por incluido. Y lo descubres en la demo.
- **Decidir en grupo sin decisor.** «Lo decidimos entre todos» suele significar que no lo decidió nadie y que se volverá a discutir.
- **Esconder el desacuerdo.** Si alguien no está de acuerdo y no queda escrito, volverá a salir en el peor momento. Mejor registrarlo y pedir el compromiso.
- **Enviar el primer borrador.** El primer borrador es para ti, para pensar. El segundo es para los demás.

## Para seguir aprendiendo

- [Carta a los accionistas de Amazon de 2017](https://www.aboutamazon.com/news/company-news/2017-letter-to-shareholders), de Jeff Bezos. La parte sobre los memos de seis páginas y por qué un buen memo lleva una semana.
- [Putting Ideas into Words](https://www.paulgraham.com/words.html), de Paul Graham. Un ensayo corto sobre por qué escribir sobre algo te demuestra que lo entendías peor de lo que creías.
- [How to Write Email with Military Precision](https://hbr.org/2016/11/how-to-write-email-with-military-precision), de Kabir Sehgal en Harvard Business Review. Explica el BLUF militar y cómo adaptarlo al correo de empresa.
- [Shape Up](https://basecamp.com/shapeup), de Ryan Singer (37signals). Se puede leer entero en su web; el capítulo 6 explica cómo escribir un *pitch*.
- [The 37signals Guide to Internal Communication](https://basecamp.com/guides/how-we-communicate). Una página de principios que puedes adaptar a tu equipo.
- [From kickoffs to retros and Slack channels](https://review.firstround.com/podcast/episode-82), con Brie Wolfson en First Round Review. Cómo se construye una cultura de escritura, con plantillas concretas.

Última revisión: 23 de noviembre de 2026.

Siguiente en la serie: El documento de referencia único (próximamente).

## También te puede interesar

- [Qué hace de verdad un product manager](/blog/producto-que-hace-un-product-manager)
- [El documento de referencia único](/blog/producto-documento-de-referencia-unico)
