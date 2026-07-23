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

# 2026-07-15 — Bloque 3: la parrilla estática

## [2026-07-15] — El rótulo pintaba el fin en minutos: "08:00–960"
**Categoría:** datos
**Síntoma:** Los rótulos de las barras mostraban el fin en MINUTOS en vez de HH:MM: "08:00–960", "15:00–960", "04:00–720". El color y la posición eran correctos; solo el número mentía.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ El build y los dos checkers (sin-hex, contraste) pasaron en verde, y cada barra se pintaba en su sitio con su color de identidad exacto. Nada automático mira el TEXTO del rótulo, así que la mentira viajó entera hasta la captura; se cazó al leerla con los ojos a 1366.
**Causa raíz:** `normaliza()` devolvía `{ ...turno, ini, fin }` con los minutos en la clave `fin`, pisando la cadena `"16:00"` del turno. El rótulo leía `turno.fin` y encontraba `960`.
**Cómo se cazó:** ojo humano (lectura de la captura a 1366).
**Arreglo aplicado:** Los minutos derivados van en claves PROPIAS (`iniMin`/`finMin`); los campos originales `inicio`/`fin` en HH:MM quedan intactos. Actualizados `calcularEje`, `posicion`, `carriles` y la `key` de `Celda.vue`. (El dato sigue vivo: tras la opción A el rótulo se movió al tooltip, que lee `turno.inicio`/`turno.fin` — sin el arreglo el tooltip diría "15:00–960".)
**Commit:** (este commit)
**Ley que sale de aquí:** Un campo calculado NO comparte nombre con el dato del que sale. Si lo pisa, es una mentira pintada esperando a que alguien la lea; y nada automático lee texto de rótulos, solo el ojo.
**Traza:** `src/composables/useEje.js` (normaliza, calcularEje, posicion, carriles); `src/components/Celda.vue`.

## [2026-07-15] — El rótulo dentro de la barra: una spec mía mala, ejecutada sin rechistar
**Categoría:** carencia
**Síntoma:** Se construyó "nombre · horas" DENTRO de cada barra (la spec del bloque lo pedía). A 1366 el texto era más ancho que la barra: los rótulos se amontonaban ("Ele00Gil · 15:00", ilegible), el color de identidad quedaba enterrado bajo el texto, y todas las barras parecían igual de anchas porque mandaba el rótulo, no la geometría. Justo lo que la guía prohíbe: "que las cosas se vean, no que se lean"; y choca con la Ley 2 de la Semana del viejo, que el propio usuario había citado.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ La medición automática "¿el rótulo de la barra estrecha pisa otra barra?" dio **0 (verde)** — porque solo comparaba el rótulo contra el RECTÁNGULO de otras barras, no contra otros rótulos ni contra el concepto. El píxel y el color también daban verde: lo correcto era el color, lo roto era la idea, y ninguna medición de píxel caza una idea rota.
**Causa raíz:** DOBLE. (a) La spec original ("rótulo nombre+horas en cada barra") contradecía una ley ya probada del proyecto: la barra de la Semana es un bloque de color, la identidad la da el COLOR, no el nombre. (b) El ejecutor la construyó al pie de la letra en vez de PARAR y avisar del choque antes de montar — cuando la regla del proyecto es que el ejecutor DISCUTE el diseño, no lo obedece.
**Cómo se cazó:** usuario (comparó la captura nueva contra la del viejo y detectó el incumplimiento de la Ley 2).
**Arreglo aplicado:** Se montó el viejo (Laravel) como referencia visual de solo lectura y se copió su ESTRUCTURA: cada turno es una FICHA vertical —insignia de iniciales + nombre arriba, hora debajo, barra al pie— con el texto ENCIMA de la barra, visible (no en un tooltip). La barra queda como bloque de color puro (Ley 2), fiel a su ancho (1 h = 6,7 px, ratio 0,125 = 1/8), sin ancho mínimo que mienta sobre la duración. Dos turnos de una persona = dos fichas apiladas; el viejo los apelmazaba como dos barras en una pista, y ese defecto NO se clona.
**Commit:** (este commit)
**Ley que sale de aquí:** Cuando una spec del usuario contradiga una ley ya probada del proyecto, PARAR Y AVISAR antes de construir, no después de medir el destrozo. Y ninguna medición de píxel caza un error de concepto: para eso está montar la referencia y comparar con el ojo. La referencia manda en la estructura, no en sus bugs (el apelmazamiento de dos barras no se hereda).
**Traza:** `src/components/Barra.vue` (color puro, sin texto ni padding); `src/components/FichaTurno.vue` (nuevo, el texto encima); `src/components/Celda.vue` (apila fichas); `src/components/Parrilla.vue` (cajetín, filas alternas, marco).

# 2026-07-23 — Bloque 3.5: la auditoría destapa lo que no se anotó

## [2026-07-23] — Un `.md` de docs/ existía en disco y git no lo versionaba, sin que nada protestara
**Categoría:** silencio falso
**Síntoma:** `docs/AUDITORIA-PRE-BLOQUE-4.md` (23 KB, el informe de auditoría que fija el rumbo del 3.5) existía en disco y parecía normal, pero git no lo veía ni como *untracked*. No estaba versionado, y nada avisaba de ello. Yo mismo afirmé en el chat que estaba "sin añadir al stage, para que lo leas primero", dando por hecho que era añadible — y no lo era.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ NADA protestó. `git status` no lo mostraba; el fichero estaba en disco con su tamaño normal; ninguna comprobación existe que avise "este doc queda ignorado". El silencio ERA el verde: la ausencia de queja se leía como "está bien".
**Causa raíz:** `.gitignore` tiene `/docs/*.md` (ignora TODO `.md` suelto de `docs/`) con una **lista blanca** de excepciones (`BITACORA`, `ESTILO`, `PLAN-ARRANQUE`). Cualquier `.md` nuevo cae fuera en silencio y depende de que alguien recuerde abrirle la puerta a mano.
**Cómo se cazó:** ojo humano, a mano (mirando `git status` al cerrar el punto 2 del 3.5). Ninguna comprobación lo cazó.
**Arreglo aplicado:** Se añadió `!docs/AUDITORIA-PRE-BLOQUE-4.md` a la lista blanca (el informe SÍ va al repo: fija rumbo, está atado a `29c0a64`, es material de destilación). El MECANISMO (invertir la regla / una guardia que avise) queda propuesto y pendiente de decisión del usuario — no se toca el `.gitignore` más allá de la excepción.
**Commit:** (este commit)
**Ley que sale de aquí:** Una lista blanca por excepción convierte "olvidar añadir la excepción" en pérdida silenciosa: un fichero que existe y no está versionado, sin que nada proteste, es un silencio falso ESTRUCTURAL. Lo que el sistema sabe ocultar hay que re-validarlo, o invertir la regla para que el olvido no borre.
**Traza:** `.gitignore`.

## [2026-07-15] — El cajetín de la parrilla se estiraba a toda la ventana (anotado tarde: lo destapó la auditoría)
**Categoría:** visual
**Síntoma:** El panel blanco que envuelve la parrilla no ajustaba su alto al contenido: las filas de puestos terminaban y el cajetín seguía estirándose hacia abajo con un pozo blanco muerto antes de cerrar con su borde redondeado.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ El build daba verde y la página cargaba; nada medía el alto del panel, así que el pozo blanco viajó hasta la captura. Se vio a ojo, no lo cazó ninguna comprobación.
**Causa raíz:** `h-full` en el panel con el padre `flex-1` (que llena la ventana): el panel se medía por la altura de la ventana, no por su contenido.
**Cómo se cazó:** usuario (lo señaló en el punto de control del Bloque 3).
**Arreglo aplicado:** `h-full` → `max-h-full` + altura automática: el panel se mide por la rejilla que envuelve, con `max-h-full` solo como tope para hacer scroll si un día crece más que el hueco. Ya corregido en `29c0a64`.
**Commit:** `29c0a64` (ya integrado en el Bloque 3; la entrada se anota tarde).
**Ley que sale de aquí:** El contenido manda sobre el contenedor en alto; un `h-full`/`100vh` en un contenedor de contenido lo estira aunque el contenido acabe antes.
**Traza:** `src/components/Parrilla.vue`.

## [2026-07-15] — Se commiteó antes del punto de control (anotado tarde: lo destapó la auditoría)
**Categoría:** carencia
**Síntoma:** En el Bloque 3 se commiteó la v1 (barras peladas) en la misma tanda, ANTES de enseñar la captura, cuando la instrucción era "enséñame la captura antes de commitear". Se saltó el punto de control humano.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ El commit pasó los dos checkers de color en verde, y ese verde dio la falsa señal de "listo para cerrar" — reforzó la sensación de "hecho" justo cuando faltaba el OK humano del punto de control.
**Causa raíz:** Barrer hacia delante: el ejecutor encadenó el commit sin parar donde se le había pedido parar.
**Cómo se cazó:** el ejecutor lo reconoció acto seguido; se deshizo con `reset --soft` y no se empujó nada.
**Arreglo aplicado:** `reset --soft` de la v1; se rehízo el bloque parando en el punto de control. No llegó a `origin`.
**Commit:** (histórico, sin commit propio — la v1 se deshizo antes de empujar).
**Ley que sale de aquí:** El verde de los checkers no sustituye al OK humano del punto de control: "commiteable" no es "aprobado". Se para donde se pidió parar.
**Traza:** — (proceso, no fichero).

## [2026-07-23] — La rejilla no caía en horas redondas con el eje ensanchado (y vivía en producción)
**Categoría:** visual
**Síntoma:** Con el eje ensanchado por el dato de la panadería (Carlos, 04:00), las líneas de la rejilla de fondo caían en 04:00 / 10:00 / 16:00 / 22:00 en vez de en 06:00 / 12:00 / 18:00 / 00:00. Estaba VIVO y PINTADO en producción.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ Dieron verde a la vez el build, los dos checkers de color, los 15 tests de lógica temporal, TODAS las mediciones de geometría del Bloque 3 (ratio 1/8, píxel del relleno, hilo, hueco, panadería no recortada) y las capturas a 1366 aprobadas con el ojo por Antonio. NINGUNA comprobación miraba DÓNDE caían las líneas: la propiedad no estaba en el radar de nadie.
**Causa raíz:** Tres piezas que no cuadraban. (1) `marcasHoras()` calcula las marcas redondas bien y está probada, pero NO tenía ni un caller — función correcta DESCONECTADA. (2) La trama que se veía la pintaba `rejilla()`, un `background-size` (solo espaciado, sin offset); con `background-position` por defecto arranca en el borde = `eje.desde`, así que con el eje ensanchado caía en 04:00 — función conectada DESALINEADA. (3) El comentario de `useEje.js` afirmaba lo contrario ("las líneas caen en horas redondas aunque el eje se ensanche") — un comentario que MIENTE, y el que lee confía y no verifica.
**Cómo se cazó:** al escribir el test 15 (marcasHoras con eje ensanchado, verde) se vio que la función correcta no era la que pintaba; se confirmó midiendo la página renderizada (líneas en 04:00, no 06:00).
**Arreglo aplicado:** Las líneas pasan a ser ELEMENTOS posicionados por `marcasHoras()` —la única fuente que sabe de horas— en `FichaTurno`; se elimina `rejilla()` (código muerto, copia a mano de un saber ya probado). Contraprueba con medición renderizada: roja antes (líneas en 04:00), verde después (06/12/18/00, cada una donde dice su etiqueta). 52 nodos de línea añadidos (medido). (Los 2 tests que cubrían `rejilla` en el punto 3 no se arrastran a la suite —queda en 13—; se retiraron antes del commit `test:`, no aquí.)
**Commit:** (este commit)
**Ley que sale de aquí:** La función que CALCULA un dato debe ser la que lo PINTA: dos funciones que saben lo mismo divergen, y la copia a mano acaba pintando mal mientras la buena, probada, no se usa. Un comentario que miente es un instrumento mentiroso: se corrige con el código. Y el instrumento de geometría (punto 5) debe medir POSICIONES de elementos, no muestrear una trama.
**Traza:** `src/composables/useEje.js` (elimina `rejilla`, corrige comentario); `src/components/FichaTurno.vue` (líneas como elementos vía `marcasHoras`).

## [2026-07-23] — El propio instrumento de medición mintió: horas basura por confundir % con px
**Categoría:** datos
**Síntoma:** La primera versión de la medición renderizada de la rejilla escupió horas imposibles —04:00, 08:00, 12:00, 16:00, 21:00, 01:00, con espaciado irregular— en vez de las posiciones reales.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ El VEREDICTO (rojo: las líneas no caen en horas redondas) era correcto por casualidad, así que el instrumento "funcionaba" a nivel de pass/fail. Un verdadero-por-casualidad es el peor caso: el veredicto correcto tapa el número equivocado, y en otro escenario un bug de unidades así puede flipar el veredicto entero (rojo↔verde) sin que nada avise.
**Causa raíz:** `parseFloat(getComputedStyle(pista).backgroundSize)` devuelve el número del `X%` y se usó como PÍXELES; el paso del bucle quedó en ~4-5 h en vez de 6 h.
**Cómo se cazó:** sospecha del propio instrumento — las horas no cuadraban (espaciado irregular), así que se dudó de la medición antes que del código y se reescribió midiendo lo determinista (la trama arranca en el borde = `eje.desde`).
**Arreglo aplicado:** La medición dejó de parsear el espaciado; mide sin ambigüedad de unidades (posición de elementos de línea; o, en su ausencia, el borde = `eje.desde`). Script de un solo uso, no versionado.
**Commit:** (este commit) — solo la entrada; el instrumento era temporal.
**Ley que sale de aquí:** Un instrumento de medición también miente, y un verdadero-por-casualidad es el más peligroso. Se sospecha del instrumento cuando sus números no cuadran, aunque el veredicto parezca bueno. El instrumento del punto 5 nace con esta lección.
**Traza:** medición temporal de la rejilla (no versionada); lección para `tools/geometria.check.mjs` (punto 5).

## [2026-07-23] — El nombre largo empujaba Sábado y Domingo fuera de pantalla (la auditoría predijo elipsis)
**Categoría:** visual
**Síntoma:** Al sembrar un nombre largo (María del Carmen Gutiérrez Villanueva) NO salieron puntos suspensivos: el span del nombre crecía a 232px, ensanchaba su columna y empujaba Sábado y Domingo FUERA DE PANTALLA (rejilla de ~1330 → 2067px). Un dato truncado avisa ("Hu…" dice que hay más); un dato que empuja a otros fuera de pantalla no avisa — Sáb y Dom simplemente no estaban.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ Con el nombre largo ya sembrado y Sáb/Dom fuera de pantalla, la suite (13 tests) seguía verde, el build compilaba, y la medición de barras daba 0 recortadas — porque NINGUNA comprobación mira si TODOS los días caben ni si un dato empuja a otro fuera del viewport. La pérdida era invisible a todo lo automático.
**Causa raíz:** DOBLE. (1) El span del nombre llevaba `truncate` pero sin `min-w-0`: en un flex el `white-space:nowrap` impide encoger, así que el span crece en vez de recortarse (el `truncate` ni siquiera truncaba). (2) `Parrilla.vue` tenía `min-w-max` en la rejilla, que fuerza a TODO el grid a max-content: ninguna celda encoge jamás, así que NINGÚN nombre puede envolver hiciera lo que hiciera el span. `min-w-max` hacía ESTRUCTURALMENTE imposible cumplir la ley "el nombre envuelve, no se trunca".
**Cómo se cazó:** al sembrar el dato y mirarlo pintado — la medición dio "truncado: false" con un nombre claramente largo → sospecha → captura, y ahí estaban Sáb y Dom fuera.
**Arreglo aplicado:** span → `min-w-0 flex-1 break-words` (envuelve) + insignia `items-start`; y `Parrilla` `min-w-max` → `min-w-full` (la rejilla llena el panel y reparte por 1fr; las columnas conservan su mínimo de 11rem, así que si los 7 días no caben siguen haciendo scroll: cambia el MECANISMO del scroll, no su existencia). Verificado pintando: nombre a 2 líneas, 7 días caben, 0 recortadas, medianoche intacto.
**Commit:** (este commit)
**Ley que sale de aquí:** Un diagnóstico correcto puede describir MAL el síntoma — la auditoría acertó la raíz (el nombre no se maneja según la ley de envoltura) y falló la manifestación (predijo elipsis; fue distorsión que EXPULSA datos). Por eso se verifica PINTANDO, no razonando. Y un dato que empuja a otros fuera de pantalla es peor que uno truncado: el truncado avisa, el expulsado no. Falta una comprobación de "¿caben todos los días?".
**Traza:** `src/components/FichaTurno.vue` (el nombre envuelve); `src/components/Parrilla.vue` (`min-w-max` → `min-w-full`).

## [2026-07-23] — Vitest parpadeó UNA vez a "error de recolección / no tests", irreproducible
**Categoría:** herramienta
**Síntoma:** La primerísima invocación de `npm test` tras editar `vite.config.js` (al montar la guardia de tests en el hook, punto 6) devolvió `Test Files 1 failed · Tests: no tests` con un code-frame de transformación apuntando al fichero de test. La siguiente invocación, y ~18 más, dieron 13 passed.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ Inmediatamente después, 5 corridas seguidas verdes, 6 con pipe a `tail`, 3 con caché frío (`node_modules/.vite` borrado) y el dev server vivo — 18/18 verde. El dato perecedero es justo ese: el fallo NO se dejó reproducir ni forzando el arranque en frío que era la hipótesis principal.
**Causa raíz:** NO CONSTA. Hipótesis no confirmada: transitorio de transformación de la primerísima invocación de vitest tras cambiar la config, quizá agravado por compartir el caché `node_modules/.vite` con el dev server (bx0thndmm) levantado. No se pudo reproducir para confirmarlo; no se inventa una causa.
**Cómo se cazó:** al medir el verde de partida antes de la contraprueba del hook — el primer `npm test` salió rojo y el segundo verde; sospecha del parpadeo → 3 experimentos de aislamiento (pipe, corridas repetidas, caché frío), ninguno reprodujo.
**Arreglo aplicado:** NINGUNO — no hay causa confirmada que arreglar, y es **fail-safe**: este modo bloquearía un commit de más (falso rojo), nunca dejaría pasar lógica rota (falso verde). Queda declarado como fragilidad conocida en `VERIFICACION.md` (techo: la geometría y el fin de línea; se añade este parpadeo si reaparece).
**Commit:** (este commit) — solo la entrada.
**Ley que sale de aquí:** Un falso rojo irreproducible se registra y se vigila, no se "arregla" a ciegas ni se silencia. Si el hook alguna vez bloquea un commit con un `Tests: no tests` inesperado y el árbol está sano, es este parpadeo: reintentar el commit; si se hace crónico, aislar el caché de vitest del dev server (`cacheDir` propio).
**Traza:** observado corriendo `npm test` durante el punto 6; sin cambio de código.

## [2026-07-23] — La API estándar de arrastre (HTML5 DnD) viola la restricción de color POR DISEÑO
**Categoría:** arquitectura
**Síntoma:** (hallazgo/decisión, no fallo) Al elegir la tecnología de arrastre del Bloque 4, la doc oficial confirmó que HTML5 Drag&Drop genera una *drag image* SEMITRANSPARENTE del elemento arrastrado por defecto: el navegador altera el color RESULTANTE del relleno de identidad, y no hay forma limpia de impedirlo (`setDragImage` es tosco y limitado). Las librerías populares (SortableJS/vuedraggable) clonan con opacidad. Y HTML5 DnD además no dispara con el dedo en Android (es de ratón).
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** NO APLICA — no es un fallo con prueba que mintiera, es una decisión tomada ANTES de escribir código (diseñar primero). Se deja escrita porque dentro de seis meses nadie recordará por qué NO se usó la API estándar.
**Causa raíz:** La restricción de Antonio —el arrastre NO toca el color de la barra, R=0 sigue siendo 0— es incompatible con el modo por defecto de la API estándar y de las librerías: todas comunican «estás arrastrando» tiñendo/atenuando el elemento. Mover la barra ya es señal suficiente; teñirla, además de innecesario, rompería la ley del color.
**Cómo se cazó:** verificación de documentación oficial (MDN Pointer Events, MDN setPointerCapture, W3C Pointer Events, drag-drop-touch) antes de decidir, como pide el método.
**Arreglo aplicado:** Pointer Events + `setPointerCapture` a mano, control visual total: se decide exactamente qué se mueve (un proxy a color pleno) y qué señala el arrastre (borde exterior, cursor, resalte de celda), sin tocar jamás el color. El detector M.color del instrumento de geometría DEMUESTRA que se cumple (dist proxy↔identidad ≈ 0; salta si alguien mete una opacidad al arrastrar).
**Ley que sale de aquí:** Una restricción de diseño puede ser también la decisión técnica correcta: la de no tocar el color descartó ella sola la API que casi todo el mundo habría usado, y de paso evitó el problema del táctil. Cuando una API estándar pelea con una ley del proyecto, se elige la ley y se construye a mano — no se dobla la ley para usar la API.
**Traza:** `src/composables/useArrastre.js` (Pointer Events); `tools/geometria.check.mjs` (detector M.color); diseño aprobado del Bloque 4 · tanda 1.
