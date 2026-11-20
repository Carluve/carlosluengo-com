---
publishDate: 2026-11-20T00:00:00Z
draft: true
title: 'Post de prueba: publicando desde Muse con GitHub'
excerpt: 'Borrador de prueba para comprobar el flujo completo: crear un post en local, validarlo con el build de Astro y subirlo a GitHub.'
category: 'Notas'
tags:
  - 'prueba'
  - 'blog'
lang: 'es'
---

## Qué comprueba este post

Este es un borrador de prueba (`draft: true`), así que no debe aparecer publicado en [carlosluengo.com](https://carlosluengo.com/).

Sirve para verificar tres cosas:

1. Que el archivo en `src/data/post/` sigue el formato y el esquema de la colección de posts.
2. Que `npm run build` valida el contenido sin errores.
3. Que el commit y el push a `main` en GitHub funcionan desde esta sesión.

## Siguiente paso

Si la prueba va bien, este archivo se puede borrar o sustituir por el primer post real, quitando `draft: true` y ajustando título, fecha, categoría y etiquetas.
