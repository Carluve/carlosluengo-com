---
publishDate: 2026-11-25T10:00:00Z
draft: false
image: 'media:blog/producto-metricas-que-importan/portada.png'
title: 'Métricas que importan: activación, retención y métrica norte'
excerpt: 'Serie Producto, parte 5. Cómo elegir una métrica norte, descomponerla en métricas de entrada que el equipo puede mover, definir la activación, leer una curva de retención y protegerte con métricas guardarraíl. Con lo que hacen Amplitude, Slack, Amazon, Google, Spotify y Airbnb, una plantilla de árbol de métricas y los errores típicos.'
category: 'Producto'
tags:
  - 'producto'
  - 'product management'
  - 'serie producto'
  - 'métricas'
  - 'retención'
  - 'analítica'
lang: 'es'
---

> **Serie Producto, parte 5 de 10.** Un post por semana para aprender gestión de producto: la idea, una metodología paso a paso, qué hacen las grandes empresas y tips para aplicarlo mañana.

El panel de la reunión semanal tiene 40 gráficas. Usuarios registrados: sube. Páginas vistas: sube. Descargas: sube. Y, aun así, nadie en la sala sabe decir si el producto va mejor que hace un mes. Cuando un número baja, alguien encuentra otro que sube.

En la [parte 4](/blog/producto-como-priorizar) dijimos que se prioriza contra un resultado. Este post va de cómo elegir ese resultado y medirlo: qué número mirar, cuáles puede mover el equipo y cómo saber si la gente que prueba tu producto se queda.

## La idea en dos minutos

Un buen sistema de métricas tiene cuatro piezas, y caben en una hoja:

1. **Una métrica norte.** El número que mejor resume el valor que recibe el cliente y que, si crece, arrastra al negocio. Amplitude, en su guía sobre el tema, pide [tres cosas](https://amplitude.com/blog/product-north-star-metric): que exprese valor para el cliente, que refleje la estrategia y que sea un indicador adelantado de los resultados.
2. **De tres a cinco métricas de entrada.** Las palancas que el equipo sí puede mover esta semana y que, juntas, empujan la métrica norte.
3. **Una definición de activación y una curva de retención.** Cuándo un usuario nuevo ha visto el valor (el momento _ajá_) y cuántos de cada grupo siguen usando el producto semanas después.
4. **Métricas guardarraíl.** Lo que no quieres romper mientras empujas lo demás.

La distinción que más ayuda es la de Amazon: las **métricas de salida** (ingresos, beneficio, bajas) cuentan lo que ya pasó. Las **métricas de entrada** (variedad, precio, velocidad de entrega) son las que se controlan. Se gestionan las entradas y se vigilan las salidas.

## Por qué importa

**Porque lo que no se mide se discute por opinión.** Sin un número acordado, cada reunión empieza desde cero y gana el argumento más convincente, no el más cierto.

**Porque las métricas de vanidad siempre suben.** Los usuarios registrados o las descargas acumuladas no bajan nunca, aunque nadie use el producto. Dan buenas noticias y ninguna información.

**Porque los ingresos llegan tarde.** Cuando la facturación baja, el problema empezó meses antes. Una métrica adelantada te avisa a tiempo de corregir.

**Porque la retención decide todo lo demás.** Si los usuarios no se quedan, más adquisición solo llena un cubo agujereado. Sequoia lo dice en su [guía de retención](https://articles.sequoiacap.com/retention): con una curva que cae hasta cero, lo que hay que arreglar es el producto, no el marketing.

**Porque un número convertido en objetivo se deforma.** La idea se conoce como ley de Goodhart, y su versión popular la formuló la antropóloga Marilyn Strathern en 1997: cuando una medida se convierte en objetivo, deja de ser una buena medida. Por eso hacen falta los guardarraíles.

## La metodología, paso a paso

Siete pasos para pasar de un panel con 40 gráficas a un árbol de métricas que se lee en un minuto.

![La metodología en siete pasos: escribe el valor que entregas, elige la métrica norte, descomponla en entradas, define la activación, mide la retención por cohortes, añade guardarraíles y revisa cada semana](media:blog/producto-metricas-que-importan/01-metodologia.png)

### 1. Escribe el valor que entregas

**Qué hacer:** antes de mirar datos, completa esta frase: «Nuestros clientes ganan ___ cuando ___». Por ejemplo: «Los equipos de ventas ganan tiempo cuando el CRM rellena solo los datos de la llamada». La métrica norte tiene que medir ese momento, no la actividad que lo rodea.

**Produce:** una frase de valor que todo el equipo reconoce.

### 2. Elige la métrica norte

**Qué hacer:** propón tres candidatas y pásalas por las tres preguntas de Amplitude: ¿mide valor para el cliente?, ¿refleja nuestra estrategia?, ¿se mueve antes que los ingresos? Descarta lo que sea vanidad (registrados, visitas) o lo que llegue tarde (ingresos mensuales). Suele ayudar que incluya una frecuencia («por semana») y una condición de calidad («con al menos...»).

**Produce:** una métrica con su definición exacta: qué cuenta, qué no cuenta y en qué periodo.

### 3. Descomponla en métricas de entrada

**Qué hacer:** pregunta qué hace crecer la métrica norte. Amplitude propone buscar en cuatro direcciones: **amplitud** (cuánta gente), **profundidad** (cuánto usan), **frecuencia** (cada cuánto vuelven) y **eficiencia** (con qué rapidez consiguen el resultado). Quédate con tres a cinco que el equipo pueda mover directamente. Como dice John Cutler, citado por [Amplitude](https://amplitude.com/blog/good-bad-north-star-metric): si puedes mover la métrica norte directamente, probablemente no es una buena métrica norte.

**Produce:** un árbol con la métrica norte arriba y las métricas de entrada debajo, cada una con un responsable.

### 4. Define la activación

**Qué hacer:** busca la acción que separa a quien se queda de quien se va. Compara a los usuarios que siguen activos al cabo de unas semanas con los que no y mira qué hicieron en sus primeros días. El momento _ajá_ es cuando el usuario entiende el valor del producto. Conviértelo en una regla medible: «hace X, Y veces, en Z días».

**Produce:** una definición de usuario activado y el porcentaje de nuevos usuarios que la cumple.

### 5. Mide la retención por cohortes

**Qué hacer:** agrupa a los usuarios por la semana o el mes en que empezaron (una cohorte) y mira qué porcentaje sigue activo en las semanas siguientes. Fíjate en la forma de la curva. Sequoia describe tres: la que **se aplana** (hay un núcleo que se queda), la que **cae hasta cero** (no hay encaje con el mercado) y la que **sonríe** (los usuarios vuelven con el tiempo). Compara cohortes: si las nuevas se aplanan más arriba que las antiguas, el producto mejora.

**Produce:** un gráfico de retención por cohortes, actualizado cada mes.

### 6. Añade métricas guardarraíl

**Qué hacer:** para cada métrica que vas a empujar, escribe qué podría romperse. Si optimizas el tiempo de uso, vigila las bajas y los contactos a soporte. Si optimizas conversiones, vigila las devoluciones. Spotify las define en su [glosario de experimentación](https://confidence.spotify.com/glossary/guardrail-metric) como las métricas que marcan lo que no quieres romper: latencia, errores, uso en otras partes del producto, ingresos o desinstalaciones.

**Produce:** dos o tres guardarraíles con un umbral de alarma.

### 7. Revisa cada semana y cambia cuando deje de predecir

**Qué hacer:** dedica los primeros minutos de la reunión semanal al árbol: métrica norte, entradas y guardarraíles, siempre en el mismo orden. Pregunta por qué se movió cada una, no solo cuánto. Una o dos veces al año, comprueba que las entradas siguen prediciendo la métrica norte y que la métrica norte sigue prediciendo el negocio. Si no, cámbiala y explica por qué.

**Produce:** una revisión semanal de 15 minutos y una revisión anual de la propia métrica.

## Qué hacen otras empresas

Las métricas de otras empresas no se copian tal cual: dependen de su producto. Lo que sí se copia es cómo las eligen y cómo las usan.

![Seis formas de medir: Amplitude, Slack, Amazon, Google, Spotify y Airbnb, con su métrica o su método y la idea que puedes copiar](media:blog/producto-metricas-que-importan/02-empresas.png)

### Amplitude: usuarios que aprenden cada semana

**Qué hacen.** Su CPO, Justin Bauer, explicó en 2019 [cómo cambiaron su métrica norte](https://amplitude.com/blog/evolving-the-product-north-star-metric). Al principio medían usuarios que hacían consultas cada semana, y vieron que se quedaba corto. La nueva, _weekly learning users_, cuenta usuarios activos que comparten un aprendizaje (un gráfico, un panel o un cuaderno) que consumen al menos otras dos personas en los últimos siete días.

**Qué puedes copiar.** Exige que tu métrica norte incluya el momento en que otros reciben valor, no solo el uso individual.

### Slack: 2.000 mensajes

**Qué hacen.** Stewart Butterfield lo contó en [First Round Review](https://review.firstround.com/from-0-to-1b-slacks-founder-shares-their-epic-launch-strategy/) en 2015: para Slack, el umbral eran 2.000 mensajes intercambiados por un equipo. A partir de ahí, el equipo había probado Slack de verdad, y el 93 % de esos clientes seguían usándolo.

**Qué puedes copiar.** Un umbral de activación concreto y comprobado contra la retención, no una intuición.

### Amazon: entradas controlables

**Qué hacen.** En su [carta a los accionistas de 2009](https://www.sec.gov/Archives/edgar/data/1018724/000119312510082914/dex991.htm), Bezos escribió que dedican poco tiempo a los resultados financieros y que se centran en las entradas controlables del negocio como la mejor forma de maximizar los resultados a largo plazo. La web del libro [_Working Backwards_](https://www.workingbackwards.com/concepts/input-metrics), de Colin Bryar y Bill Carr, pone ejemplos: variedad, precio y velocidad de entrega como entradas; ingresos, beneficio y flujo de caja como salidas, que miden con retraso el efecto de las entradas.

**Qué puedes copiar.** En tu reunión semanal, habla primero de las entradas. Los ingresos se miran, pero no se gestionan directamente.

### Google: HEART y metas, señales y métricas

**Qué hacen.** Kerry Rodden, Hilary Hutchinson y Xin Fu publicaron en 2010 el [marco HEART](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36299.pdf) para medir la experiencia de usuario a gran escala: _Happiness_ (satisfacción), _Engagement_ (implicación), _Adoption_ (adopción), _Retention_ (retención) y _Task success_ (tareas completadas). Lo acompañan de un proceso: primero la meta, después la señal que indicaría que se cumple y solo al final la métrica.

**Qué puedes copiar.** No empieces por la métrica. Empieza por la meta y pregunta qué señal verías si se cumpliera.

### Spotify: guardarraíles en cada experimento

**Qué hacen.** Su plataforma de experimentación, Confidence, publica un glosario donde explica las [métricas guardarraíl](https://confidence.spotify.com/glossary/guardrail-metric) y pone como ejemplo de [métrica norte](https://confidence.spotify.com/glossary/north-star-metric) que, para Spotify, podría ser el tiempo de escucha. Es una ilustración, no una métrica oficial anunciada.

**Qué puedes copiar.** Ningún experimento sin al menos un guardarraíl declarado antes de empezar.

### Airbnb: noches reservadas

**Qué hacen.** En sus informes a los inversores, Airbnb usa como métrica clave las [noches y experiencias reservadas](https://www.sec.gov/Archives/edgar/data/1559720/000155972021000010/airbnb-10k.htm): el total de noches reservadas en alojamientos más las plazas reservadas en experiencias. Muchos blogs la citan como su métrica norte, aunque Airbnb no la llama así. Es un buen ejemplo de métrica que une el valor para el huésped, para el anfitrión y para el negocio.

**Qué puedes copiar.** En un mercado de dos lados, mide la transacción que crea valor para los dos.

## Cuánta retención es buena

Depende del tipo de producto. Lenny Rachitsky recopiló en 2020 [estas referencias de retención de usuarios a seis meses](https://www.lennysnewsletter.com/p/what-is-good-retention-issue-29). Son orientativas, no una norma:

| Tipo de producto                      | Buena | Muy buena |
| ------------------------------------- | ----- | --------- |
| Consumo, red social                   | ~25 % | ~45 %     |
| Consumo, transaccional                | ~30 % | ~50 %     |
| Software de consumo por suscripción   | ~40 % | ~70 %     |
| Software para pymes y mediana empresa | ~60 % | ~80 %     |
| Software para gran empresa            | ~70 % | ~90 %     |

Más importante que el número es la forma: una curva que se aplana te dice que hay un producto que la gente necesita. Una que no deja de caer te dice que todavía no.

![Tres formas de curva de retención por cohortes: la que cae a cero, la que se aplana y la que sonríe, con lo que significa cada una](media:blog/producto-metricas-que-importan/03-retencion.png)

## Plantilla

El árbol de métricas en una página. Rellénalo de arriba abajo y revísalo cada trimestre.

![Anatomía del árbol de métricas: frase de valor y métrica norte arriba, de tres a cinco métricas de entrada con responsable en medio, y activación, retención y guardarraíles abajo](media:blog/producto-metricas-que-importan/04-plantilla.png)

```markdown
# Árbol de métricas: [producto] — revisado el [fecha]

**Valor que entregamos:** Nuestros clientes ganan [_**] cuando [**_].

## Métrica norte

- Nombre: [p. ej. «equipos que cierran al menos 3 tareas por semana»]
- Definición exacta: cuenta [...], no cuenta [...], periodo [...]
- Valor actual: [...] · Objetivo: [...] antes del [fecha]
- Por qué esta: ¿valor para el cliente? [sí/no] · ¿estrategia? [sí/no] · ¿adelantada? [sí/no]

## Métricas de entrada (3–5, las que movemos)

| Entrada | Tipo (amplitud/profundidad/frecuencia/eficiencia) | Valor actual | Responsable |
| ------- | ------------------------------------------------- | ------------ | ----------- |
|         |                                                   |              |             |

## Activación

- Usuario activado = hace [X], [Y] veces, en [Z] días
- % de nuevos usuarios activados: [...]
- Cómo lo validamos: comparamos retención de activados vs no activados en [fecha]

## Retención

- Cohorte: por [semana/mes] de alta
- % activos a la semana 1 / 4 / 12: [...] / [...] / [...]
- Forma de la curva: cae a cero | se aplana en [__ %] | sonríe

## Guardarraíles (lo que no queremos romper)

| Métrica | Umbral de alarma | Qué hacemos si salta |
| ------- | ---------------- | -------------------- |
|         |                  |                      |

## Métricas de salida (se miran, no se gestionan)

- Ingresos, bajas, margen: [enlace al panel]
```

## Tips

- **Una métrica norte, no tres.** Si tienes tres, en realidad no tienes ninguna.
- **Escribe la definición exacta.** «Usuarios activos» significa una cosa distinta en cada equipo. Di qué evento, en qué periodo y qué se excluye.
- **Usa tasas, no totales acumulados.** «Registrados totales» siempre sube. «% de registrados de este mes que se activan» te dice algo.
- **Mira cohortes, no medias.** Una media mezcla a los usuarios de hace un año con los de ayer y esconde si el producto mejora.
- **Cada entrada con un nombre.** Una métrica sin responsable es una gráfica decorativa.
- **Cuenta la historia detrás del número.** Combina las métricas con entrevistas (parte 6): los datos te dicen qué pasa; las personas, por qué.
- **Cuidado con cambiar la definición a mitad de año.** Si la cambias, recalcula el histórico o dibuja una línea clara en el gráfico.
- **Celebra las entradas.** El equipo controla las entradas; si solo celebras los ingresos, celebras algo que no depende de él.

## Errores típicos

- **Elegir la métrica norte por lo fácil que es de medir.** Las visitas se miden solas. El valor para el cliente cuesta más, y es lo que importa.
- **Fijar un objetivo sin guardarraíl.** El equipo lo cumplirá, y probablemente romperá otra cosa por el camino.
- **Mirar la retención agregada.** Si cada mes llegan más usuarios nuevos, la retención agregada puede parecer estable mientras cada cohorte empeora.
- **Confundir correlación con causa en la activación.** Que los usuarios retenidos hagan X no prueba que obligar a todos a hacer X los retenga. Compruébalo con un experimento.
- **Un panel con 40 gráficas.** Si todo está en el panel, nada lo está. Empieza por las cuatro piezas de este post.
- **No revisar nunca la métrica norte.** El producto cambia; la métrica que te sirvió para encontrar encaje puede no servir para crecer.

## Para seguir aprendiendo

- [Retention](https://articles.sequoiacap.com/retention), del equipo de datos de Sequoia. La mejor explicación de cohortes y formas de curva que conozco.
- [What is good retention](https://www.lennysnewsletter.com/p/what-is-good-retention-issue-29), de Lenny Rachitsky. Referencias por tipo de producto, para saber si tu curva es buena.
- [Guía de la métrica norte](https://amplitude.com/blog/product-north-star-metric), en el blog de Amplitude. Los criterios para elegirla y cómo descomponerla en entradas.
- [Measuring the User Experience on a Large Scale](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/36299.pdf), de Rodden, Hutchinson y Fu (Google, 2010). El artículo original de HEART, corto y muy práctico.
- [Input metrics](https://www.workingbackwards.com/concepts/input-metrics), de la web de _Working Backwards_. Cómo piensa Amazon las entradas y las salidas.

Última revisión: 24 de noviembre de 2026.

Siguiente en la serie: [Hablar con usuarios sin sesgarles](/blog/producto-hablar-con-usuarios).

## También te puede interesar

- [Del problema a la apuesta: cómo priorizar](/blog/producto-como-priorizar)
- [El documento de referencia único](/blog/producto-documento-de-referencia-unico)
- [Qué hace de verdad un product manager](/blog/producto-que-hace-un-product-manager)
