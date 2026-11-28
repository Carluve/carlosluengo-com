---
publishDate: 2026-11-28T08:00:00Z
draft: false
image: 'media:blog/producto-lanzar/portada.png'
title: 'Lanzar: del beta al go-to-market'
excerpt: 'Serie Producto, parte 9. Cómo llevar algo de la primera beta a todos los clientes sin sustos: siete pasos para separar desplegar de lanzar, abrir por fases, preparar el go-to-market y aprender después. Con lo que hacen Google, GitHub, Cloudflare, Linear, Superhuman e Intercom, un plan de lanzamiento para copiar y los errores típicos.'
category: 'Producto'
tags:
  - 'producto'
  - 'product management'
  - 'serie producto'
  - 'lanzamiento'
  - 'go-to-market'
  - 'beta'
lang: 'es'
---

> **Serie Producto, parte 9 de 10.** Un post por semana para aprender gestión de producto: la idea, una metodología paso a paso, qué hacen las grandes empresas y tips para aplicarlo mañana.

El equipo lleva seis semanas trabajando. La funcionalidad está terminada, las pruebas pasan y alguien pregunta: «¿lo lanzamos el lunes?». Nadie sabe muy bien qué significa eso. ¿Se activa para todos? ¿Lo sabe soporte? ¿Hay una página que explique cómo funciona? ¿Qué pasa si el martes hay que dar marcha atrás?

En las partes anteriores vimos cómo decidir qué construir, cómo medirlo y cómo escribirlo. Este post va del último tramo, el que más se improvisa: llevar lo construido a los clientes. Y de cómo hacerlo por fases, sabiendo en cada momento quién lo tiene y qué te haría parar.

## La idea en dos minutos

Lanzar no es un momento. Es **una secuencia de aperturas controladas**, cada una con un criterio para pasar a la siguiente.

Tres ideas sostienen todo el método:

1. **Desplegar no es lanzar.** El código puede estar en producción semanas antes de que lo vea ningún cliente. Lo que decide quién lo ve es un interruptor, no un despliegue. Así lanzar se convierte en una decisión de producto, no en un riesgo técnico.
2. **Se abre por fases, de menos a más.** Primero tu equipo, luego unos pocos clientes elegidos, luego un porcentaje y al final todos. En cada fase aprendes algo que la anterior no podía enseñarte.
3. **No todos los lanzamientos merecen el mismo ruido.** Un cambio que abre un mercado nuevo necesita prensa, formación de ventas y un evento. Una mejora pequeña necesita una línea en el changelog. Decidir el nivel antes ahorra semanas.

La palabra clave es _criterio de paso_. Antes de abrir cada fase, escribe qué tiene que pasar para abrir la siguiente y qué te haría volver atrás.

## Por qué importa

**Porque los fallos grandes llegan a todos a la vez.** Si activas algo para el cien por cien de los clientes y falla, falla para el cien por cien. Si lo activas para el uno por ciento, el problema es pequeño y te da tiempo a arreglarlo.

**Porque lo que no sabe ventas ni soporte, no existe.** Una funcionalidad que nadie explica no se usa. Y un cliente que pregunta por algo que soporte desconoce pierde confianza en los dos.

**Porque la beta enseña lo que el equipo no ve.** Tus usuarios usan el producto con sus datos, sus prisas y sus integraciones. Diez clientes reales encuentran en una semana lo que el equipo no encuentra en un mes.

**Porque un lanzamiento es una oportunidad de comunicación que se gasta.** Si lo anuncias antes de que funcione bien, la primera impresión ya no se puede repetir.

**Porque sin una revisión posterior, el lanzamiento no termina nunca.** Quedan interruptores olvidados, métricas que nadie mira y promesas a clientes que nadie recuerda.

## La metodología, paso a paso

Siete pasos, de la decisión de qué significa «lanzado» a la revisión de los treinta días. Los tres primeros preparan. Los tres siguientes abren. El último cierra el círculo.

![La metodología de lanzamiento en siete pasos: define el éxito, elige el nivel, separa desplegar de lanzar, beta privada, apertura gradual, go-to-market y revisa a los 30 días](media:blog/producto-lanzar/01-metodologia.png)

### 1. Define qué significa éxito

**Qué hacer:** escribe qué tiene que pasar para decir que el lanzamiento ha funcionado. Usa la métrica de la apuesta (parte 4) y la regla de activación (parte 5). «Que el 30 % de las cuentas nuevas conecte su tienda en la primera semana» es un criterio. «Que guste» no lo es.

**Produce:** una métrica de éxito, un guardarraíl (lo que no quieres romper) y la fecha en la que lo mirarás.

### 2. Elige el nivel del lanzamiento

**Qué hacer:** clasifica el lanzamiento por su impacto en el negocio y en el mercado, no por el esfuerzo que ha costado. Un nivel 1 cambia lo que ofreces y merece todo el despliegue: anuncio, prensa, formación de ventas. Un nivel 3 es una mejora para quien ya es cliente y basta con el changelog y una nota a soporte.

**Produce:** un nivel (1, 2 o 3) y la lista de lo que incluye ese nivel. Así nadie discute en la última semana si «hace falta un post».

### 3. Separa desplegar de lanzar

**Qué hacer:** pon la funcionalidad detrás de un interruptor (un _feature flag_). El código llega a producción apagado y lo enciendes para quien tú decidas. Si algo va mal, lo apagas sin desplegar nada.

**Produce:** un interruptor con dueño y fecha de retirada. Los interruptores que nadie retira se convierten en deuda.

### 4. Abre una beta privada

**Qué hacer:** elige a pocos clientes que tengan el problema y ganas de ayudarte. Acompáñalos en persona: una llamada para empezar, un canal directo y una pregunta semanal. Lo que buscas no es validación, son fallos y sorpresas.

**Produce:** una lista de problemas encontrados, citas de clientes y la decisión de seguir, cambiar o parar.

### 5. Abre por porcentajes

**Qué hacer:** cuando la beta está limpia, enciende el interruptor para un porcentaje pequeño de usuarios y ve subiendo. Entre fase y fase, mira la métrica de éxito y los guardarraíles. Si un guardarraíl salta, vuelves a la fase anterior.

**Produce:** un calendario de apertura (por ejemplo, 1 %, 10 %, 50 %, 100 %) con el criterio de paso de cada fase.

### 6. Prepara el go-to-market

**Qué hacer:** mientras se abre, prepara a quien tiene que contarlo y a quien tiene que responder. Documentación, una nota para soporte con las preguntas esperadas, una sesión corta para ventas, el texto del anuncio y el changelog. El anuncio sale cuando la apertura está en el cien por cien, no antes.

**Produce:** un mensaje en una frase (para quién es y qué problema resuelve), los materiales del nivel elegido y una fecha de anuncio.

### 7. Revisa a los 30 días

**Qué hacer:** a los treinta días, compara la métrica con el criterio del paso 1. Escribe qué ha salido bien, qué no y qué cambiarías, sin buscar culpables. Retira el interruptor y cierra lo que quedó abierto.

**Produce:** una revisión de una página y la decisión siguiente: seguir invirtiendo, mejorar o retirar.

## Qué hacen otras empresas

Seis formas de lanzar, cada una con algo concreto que puedes copiar.

![Seis formas de lanzar: Google, GitHub, Cloudflare, Linear, Superhuman e Intercom](media:blog/producto-lanzar/02-empresas.png)

### Google: una lista de comprobación y el canario

**Qué hace.** El libro de [Site Reliability Engineering](https://sre.google/sre-book/reliable-product-launches/) de Google dedica un capítulo a los lanzamientos. Google llama lanzamiento a cualquier código nuevo que introduce un cambio visible desde fuera, y explica que llega a hacer hasta 70 a la semana. Para eso tiene un equipo, Launch Coordination Engineering, que revisa cada lanzamiento con una lista de comprobación: arquitectura y dependencias, capacidad, modos de fallo, comportamiento de los clientes, plan de despliegue. El despliegue es gradual: primero unas pocas máquinas (el «canario», por los canarios que usaban los mineros para detectar gas), luego un centro y después todo el mundo, con comprobaciones entre fases. Los interruptores suelen enseñar un cambio al 1–10 % de los usuarios antes de ampliarlo.

**Qué puedes copiar.** Una lista de comprobación propia, corta, que se revisa antes de cada lanzamiento de nivel 1 y 2. No hace falta un equipo dedicado para tener una lista.

### GitHub: tres fases con nombre y promesas claras

**Qué hace.** GitHub publica en su [documentación](https://docs.github.com/en/get-started/using-github/exploring-early-access-releases-with-feature-preview) qué significa cada fase. La vista previa privada está en pleno desarrollo y puede cambiar. La vista previa pública ya está documentada y abierta a más gente, pero sigue sin acuerdo de nivel de servicio ni soporte. La disponibilidad general (GA) está probada, abierta a todos y con soporte. En [octubre de 2024](https://github.blog/changelog/2024-10-18-new-terminology-for-github-previews/) dejó de usar «alpha» y «beta» y pasó a hablar solo de «preview».

**Qué puedes copiar.** Pon nombre a tus fases y escribe qué promete cada una. Un cliente en beta acepta fallos si sabe que está en beta.

### Cloudflare: la beta como paso previo a GA

**Qué hace.** En Cloudflare los productos suelen empezar en beta y pasan a GA cuando están listos. En 2022 eran tantos los que salían de beta a la vez que la empresa creó una semana entera para anunciarlos, la [GA Week](https://blog.cloudflare.com/welcome-to-ga-week), dentro de sus semanas de innovación. La [documentación de Workers](https://developers.cloudflare.com/workers/platform/betas/) mantiene una página con las betas abiertas y avisa de que pueden tener limitaciones.

**Qué puedes copiar.** Agrupa los anuncios. Varias salidas de beta en la misma semana hacen más ruido que una cada mes, y obligan al equipo a cerrar fechas.

### Linear: lanzar varias veces

**Qué hace.** El [Linear Method](https://linear.app/method/launching) defiende que no hace falta un único gran momento de lanzamiento. Linear lo anunció antes de que el producto existiera, volvió a lanzar al cerrar su ronda semilla, otra vez al llegar a GA con precios y otra al cerrar la Serie A. Entre medias, su [changelog](https://linear.app/changelog) se publica más o menos cada dos semanas y cumple la misma función: recordar al mercado que el producto avanza.

**Qué puedes copiar.** Planifica varios lanzamientos pequeños en lugar de guardar todo para uno grande. Y publica un changelog con un ritmo fijo.

### Superhuman: acompañar a mano antes de automatizar

**Qué hace.** Gaurav Vohra cuenta en [First Round Review](https://review.firstround.com/superhuman-onboarding-playbook/) que Superhuman empezó dando a cada cliente nuevo una sesión de onboarding en persona. Las llamadas empezaron durando unos 90 minutos y luego bajaron a 30. Según él, el onboarding con personas aproximadamente duplicó la activación y las recomendaciones, aunque advierte de que los clientes que aceptaban la llamada ya eran los más interesados. Tardaron unos tres años en construir un onboarding automático, y el rediseño subió la activación del 40 % al 50 %.

**Qué puedes copiar.** En la beta privada, acompaña a cada cliente en persona. Aprenderás qué automatizar y en qué orden.

### Intercom: niveles de lanzamiento con puntuación

**Qué hace.** Intercom explica en [su blog](https://www.intercom.com/blog/how-to-evolve-product-launches-as-you-grow) que puntúa cada lanzamiento según su efecto en ingresos, uso y bajas, diferenciación y tamaño de la audiencia. La puntuación se traduce en un nivel del 1 al 4. El nivel 1 recibe todos los recursos; el 4 es una mejora pequeña para una parte de los clientes.

**Qué puedes copiar.** Tres o cuatro preguntas para asignar el nivel, y una lista fija de lo que incluye cada nivel. La discusión pasa a ser sobre el impacto, no sobre si «merece un evento».

## Del interruptor al cien por cien

Así se combinan las fases con nombre y los porcentajes. La columna de la izquierda es lo que promete cada fase. La de la derecha, cuánta gente lo ve.

![Del interruptor al cien por cien: equipo interno, beta privada, beta pública y disponibilidad general, con los porcentajes de apertura y el criterio de paso de cada fase](media:blog/producto-lanzar/03-fases.png)

## Plantilla

Este es el plan de lanzamiento. Cabe en una página y se escribe antes de abrir la beta.

![Anatomía del plan de lanzamiento: éxito y nivel arriba, interruptor y fases en medio, go-to-market y revisión abajo](media:blog/producto-lanzar/04-plantilla.png)

```markdown
# Lanzamiento: [nombre de la funcionalidad]

**Apuesta:** [enlace a la ficha de la parte 4]
**Dueño:** [una persona]
**Nivel:** 1 | 2 | 3 — porque [impacto en negocio o mercado]

## Éxito

- Métrica: [qué] de [valor actual] a [objetivo] antes del [fecha]
- Guardarraíl: [lo que no queremos romper] — umbral: [valor]
- Revisión: [fecha, 30 días después del 100 %]

## Interruptor

- Nombre: [flag]
- Dueño: [persona] — retirada prevista: [fecha]

## Fases

| Fase            | Quién lo ve           | Criterio para pasar a la siguiente    | Si sale mal      |
| --------------- | --------------------- | ------------------------------------- | ---------------- |
| Interna         | Equipo                | Sin errores graves en 1 semana        | Arreglar         |
| Beta privada    | [n] clientes elegidos | [n] clientes usándolo cada semana     | Volver a interna |
| Apertura 1–10 % | Usuarios al azar      | Métrica estable, guardarraíl en verde | Apagar el flag   |
| 50 % → 100 %    | Todos                 | Igual que la fase anterior            | Volver al %      |

## Go-to-market (según el nivel)

- Mensaje en una frase: Para [quién] que [problema], [funcionalidad] [beneficio].
- [ ] Documentación
- [ ] Nota para soporte con preguntas esperadas
- [ ] Sesión de 15 minutos con ventas (nivel 1 y 2)
- [ ] Changelog
- [ ] Anuncio: post, correo, redes (nivel 1)

## Revisión a 30 días

- Resultado frente al objetivo:
- Qué salió bien:
- Qué cambiaríamos:
- Decisión: seguir | mejorar | retirar
```

Y la lista mínima que conviene revisar antes de cada fase:

```markdown
- [ ] ¿Sabemos apagarlo en menos de 5 minutos?
- [ ] ¿Vemos la métrica y el guardarraíl en un panel?
- [ ] ¿Sabe soporte qué ha cambiado y para quién?
- [ ] ¿Hay algún cliente al que le prometimos fecha?
- [ ] ¿Está escrito qué nos haría volver atrás?
```

## Tips

- **Elige a los clientes de la beta por el problema, no por el tamaño.** Los que más sufren el problema te dan las mejores pistas, aunque paguen poco.
- **Pon fecha de fin a la beta.** Una beta sin final se convierte en una excusa para no terminar nunca.
- **Prueba el botón de apagar antes de necesitarlo.** Un interruptor que nadie ha probado no es un plan de vuelta atrás.
- **Escribe el anuncio el primer día.** Si no sabes explicar en una frase para quién es, todavía no sabes qué estás lanzando. Es la misma idea que la nota de prensa de Amazon de la parte 7.
- **Ventas y soporte, antes que el blog.** Que se enteren por ti, no por un cliente.
- **Mide la adopción, no solo los errores.** Que no falle no significa que se use.
- **Retira los interruptores.** Martin Fowler los compara con un inventario que tiene un coste de mantenimiento: cuantos más quedan, más difícil es entender el código.
- **Si lanzas en Product Hunt, pide opiniones, no votos.** Sus [normas](https://help.producthunt.com/en/articles/17734384-5-how-to-promote-your-launch-and-what-to-avoid) prohíben pedir votos y pueden retirar el lanzamiento.

## Errores típicos

- **Anunciar antes de que funcione.** La prensa llega, los clientes prueban y se encuentran algo a medias. Esa primera impresión no se recupera.
- **Lanzar todo el mismo día a todo el mundo.** Si falla, falla para todos y no tienes con qué comparar.
- **Confundir la beta con un lanzamiento suave.** La beta sirve para aprender y cambiar. Si no estás dispuesto a cambiar nada, no es una beta.
- **Tratar todos los lanzamientos igual.** Un evento para cada mejora agota al equipo y al mercado. Un changelog para un producto nuevo lo entierra.
- **Olvidar a quien ya es cliente.** Un cambio que mejora la experiencia de los nuevos puede romper la costumbre de los antiguos. Avísales antes.
- **No volver a mirar.** Sin revisión a los treinta días no sabes si el lanzamiento funcionó, y el siguiente se planifica a ciegas.

## Para seguir aprendiendo

- [Reliable Product Launches at Scale](https://sre.google/sre-book/reliable-product-launches/), capítulo del libro Site Reliability Engineering de Google. La lista de comprobación completa y el despliegue gradual, gratis en su web.
- [Canarying Releases](https://sre.google/workbook/canarying-releases/), del Site Reliability Workbook. Cómo diseñar un canario: tamaño, duración y qué métricas mirar.
- [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html), de Pete Hodgson en la web de Martin Fowler. Los cuatro tipos de interruptor y cómo evitar que se acumulen.
- [Launch and keep launching](https://linear.app/method/launching), del Linear Method. Por qué conviene lanzar varias veces.
- [Postmortem Culture](https://sre.google/sre-book/postmortem-culture/), del libro de SRE de Google. Cómo hacer revisiones sin culpables.

Última revisión: 26 de noviembre de 2026.

Siguiente en la serie: [Tus primeros 90 días: el memo de entrada](/blog/producto-primeros-90-dias).

## También te puede interesar

- [Del problema a la apuesta: cómo priorizar](/blog/producto-como-priorizar)
- [Métricas que importan: activación, retención y métrica norte](/blog/producto-metricas-que-importan)
- [Hablar con usuarios sin sesgarles](/blog/producto-hablar-con-usuarios)
