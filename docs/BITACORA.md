# Bitácora de fallos — TURNIA (prototipo)

> El registro crudo de los fallos reales del proyecto, escrito EN CALIENTE.
> No es un changelog (eso cuenta qué cambió). No es la guía (eso cuenta la ley).
> Esto cuenta EL CASO: qué pasó, qué prueba dio verde mientras pasaba, y cómo se cazó.
>
> **La meta-ley:** la retrospectiva miente, así que el fallo se graba en el momento, no se
> reconstruye al final. Por eso nace con el proyecto, no después.

---

## Cómo se rellena

- **Una entrada por fallo.** No se fusionan, no se suavizan.
- **El campo estrella (⭐)** — "qué se probó y DIO VERDE mientras el fallo estaba vivo" — se captura
  **al DESCUBRIR el fallo, antes de arreglarlo**. Es el dato perecedero: si se deja para el final,
  se pierde. En esta fase del prototipo (sin motor ni tests) casi siempre será `NO CONSTA`: se deja
  así, **sin paja**.
- **`NO CONSTA`** es un valor honesto y válido. Nunca se inventa un dato; si no se sabe, se dice
  (y, si ayuda, se anota por qué no consta).
- **El hook `commit-msg` la hace obligatoria:** un commit `fix:` sin entrada no se cierra — el hook
  autogenera el esqueleto (todos los campos en `NO CONSTA`) y lo deja en el *stage* para rellenar.

### Formato de una entrada (9 campos, en este orden)

```
## [YYYY-MM-DD] — Título del caso (una frase)
**Categoría:** carencia | visual | datos | rompe | seguridad | aviso falso | silencio falso | despliegue
**Síntoma:** qué se vio.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ la prueba que mintió  (o NO CONSTA)
**Causa raíz:** por qué pasó de verdad.
**Cómo se cazó:** usuario | test | ojo humano | casualidad
**Arreglo aplicado:** qué se hizo.
**Commit:** el hash del propio fix (o "(este commit)").
**Ley que sale de aquí:** la regla que queda.
**Traza:** ficheros/funciones tocados.
```

> Categorías `aviso falso` y `silencio falso`: dormidas hasta que exista un motor de reglas. Su
> reaparición marcará que el proyecto ha subido de capa.

---

# 2026-07-15 — El reinicio

## [2026-07-15] — TURNIA se reinicia: el orden estaba equivocado, no el objetivo
**Categoría:** carencia
**Síntoma:** La v1 (Laravel + Inertia + MySQL) creció bien en piezas —motor, matriz visual, candado— pero con las capas en mal orden: se montó lo sofisticado antes de tener el flujo básico sólido. Operar sobre ese enredo dejaba cables colgando que reaparecían tandas después.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** NO CONSTA: no es un fallo con una prueba que mintiera, es una decisión de arquitectura tomada mirando el proyecto entero.
**Causa raíz:** El orden de construcción. Capas encima de un flujo básico que nunca fue "sólido como una roca".
**Cómo se cazó:** usuario (decisión de reiniciar por lo mínimo funcionando perfecto).
**Arreglo aplicado:** Reinicio como prototipo Vue 3 + Vite + Tailwind 4, solo front, datos a fuego. La v1 se archivó en el tag `archivo/v1-laravel` y la rama `archivo/laravel-inertia` (empujados a origin y verificados en GitHub) antes de reescribir `main`. Del viejo se hereda el aprendizaje y los literales (colores, logo), nunca el código. Nace con bitácora, hook, CLAUDE.md, sistema de diseño y despliegue vivo desde el commit 0.
**Commit:** (este commit)
**Ley que sale de aquí:** Lo mínimo funcionando perfecto primero; las capas encima, sobre cimientos firmes. Y se heredan las decisiones, no el código.
**Traza:** todo el andamiaje del Bloque 1; `docs/PLAN-ARRANQUE.md`.

## [2026-07-15] — La rama produccion arrastraba cirílico, griego y vietnamita
**Categoría:** despliegue
**Síntoma:** `produccion` subió ~80 ficheros de fuente (todos los subsets de IBM Plex Sans y Mono: cirílico, griego, vietnamita, latin-ext…) para un prototipo en español que solo necesita latin.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ El build, el deploy y el tablero `/estilo` pasaron todos en verde en el Bloque 2. Nadie miró el peso de `produccion`, así que los 80 ficheros subieron sin que saltara nada; se descubrió al LISTAR el contenido de la rama tras el deploy.
**Causa raíz:** `import '@fontsource/ibm-plex-sans/400.css'` trae TODOS los subsets del peso. El subset se pide explícito con `latin-400.css`.
**Cómo se cazó:** ojo humano (revisión del `git ls-tree` de `produccion` al cerrar el Bloque 2).
**Arreglo aplicado:** Imports cambiados a `latin-400/500/600/700` (sans) y `latin-400/500/600` (mono). De ~80 ficheros de fuente a 14. Verificado que la ñ y los acentos siguen en IBM Plex Sans (el subset latin cubre U+0000–00FF).
**Commit:** (este commit)
**Ley que sale de aquí:** `@fontsource/…/PESO.css` importa el mundo entero; se pide el subset explícito (`latin-PESO.css`). Y el peso de lo desplegado se mira, no se supone.
**Traza:** `src/main.js`.
