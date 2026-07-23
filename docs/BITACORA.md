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

## [2026-07-23] — Falsa alarma: «no se mueve nada» era producción con latencia, no un fallo
**Categoría:** método
**Síntoma:** Recién construida la tanda 1 del arrastre, Antonio abrió PRODUCCIÓN (el subdominio) y reportó «no se mueve nada, es totalmente estático». Sonaba a fallo grave del arrastre.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ En localhost el arrastre funcionaba desde el primer momento (dev server con HMR), y el instrumento de geometría daba verde sobre localhost. Lo único «roto» era una cosa que NO se había desplegado aún.
**Causa raíz:** Producción va por detrás POR DISEÑO — el cron pullea cada ~15 min (ver deploy.sh / la cadencia confirmada). En el hueco entre construir y el siguiente pull, el subdominio sirve la versión ANTERIOR. No había fallo: había latencia de despliegue.
**Cómo se cazó:** al contrastar los dos entornos — localhost (donde ESTÁ construido) movía; producción (aún sin pullar) no. La discrepancia señaló el entorno, no el código.
**Arreglo aplicado:** NINGUNO — no hay fallo. Se verificó en localhost, que es donde vive lo recién construido; producción se comprobará tras el pull.
**Ley que sale de aquí:** Cuando se verifica algo RECIÉN construido, se verifica en el entorno donde está construido (localhost), no en producción, que va por detrás por diseño. Un «no funciona» en producción justo después de construir es evidencia de LATENCIA, no de fallo. Y su simétrico, más peligroso: un «funciona» en producción justo después de construir tampoco prueba nada del código nuevo — puede estar mirando la versión vieja. El entorno es parte de la prueba.
**Traza:** sin cambio de código; lección de método sobre el desfase localhost↔producción (cron ~15 min).

## [2026-07-23] — Key de v-for duplicada en Celda: el duplicado exacto del arrastre despertó un bug del Bloque 3
**Categoría:** correctitud
**Síntoma:** La key del `v-for` de fichas en `Celda.vue` era `t.persona + '-' + t.iniMin`. Dos turnos idénticos en una celda (misma persona, mismas horas) → la MISMA key → colisión de keys en Vue. Antonio lo provocó jugando con el arrastre: arrastró a Bea Soler dos veces a la misma celda (Barra, mismo día, 14:00–22:00), dos fichas idénticas.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ TODO daba verde con la key duplicada: los 19 tests, los 7 detectores de geometría, los checkers de color, el build, y la parrilla renderizando perfectamente. NINGUNA comprobación mira las keys. El bug estaba dormido desde el Bloque 3 (la key llevaba ahí desde que se apilaron fichas) y NADIE lo veía.
**Causa raíz:** Una key derivada de datos (persona+hora) no es única cuando dos turnos coinciden. Con keys duplicadas Vue puede reutilizar el DOM equivocado y, ante reactividad, actualizar la ficha que no es — invisible en render estático, se manifiesta EXACTAMENTE al arrastrar una de las dos. La tanda 1 (reactividad + poder crear duplicados moviendo) fue la que lo despertó.
**Cómo se cazó:** Antonio jugó con la app a mano y generó un estado que ningún test diseñado se le había ocurrido generar (un duplicado exacto, caso «absurdo» que nadie pidió ni sembró). El duplicado no era el problema: era el SÍNTOMA que hizo visible el problema estructural.
**Arreglo aplicado:** `:key="t.id"` — cada turno lleva un id estable y único desde la tanda 1; la key pasa a ser ese id, único por construcción.
**Ley que sale de aquí:** Una key de `v-for` debe ser identidad estable (un id), nunca una combinación de datos que dos filas puedan compartir. Y la de método, más grande: jugar con la aplicación a mano genera estados que ningún test diseñado imagina — el ojo y la mano del usuario siguen siendo instrumentos de primera, y cazan lo que las suites, ciegas a su propia forma, no miran. (Fragilidad hermana anotada, NO tocada: `FichaTurno.vue` keya las marcas de hora por `m.etiqueta`; colisionaría solo con un eje > 30 h, hoy inalcanzable.)
**Traza:** `src/components/Celda.vue` (`:key` persona+iniMin → `t.id`).

## [2026-07-23] — El editor trabaja en MINUTOS ABSOLUTOS: la duración cero es inalcanzable por diseño
**Categoría:** arquitectura
**Síntoma:** (decisión, no fallo) El editor de turno (tanda 2.b) permite estirar los extremos con dos tiradores. Sin cuidado, el tirador del fin puede cruzarse con el del inicio y producir un turno de duración CERO — y ahí espera el hallazgo anotado desde el punto 3 del Bloque 3.5: `normaliza()` interpreta un turno de duración cero como 24 h (el `<=` incluye la igualdad). Con el arrastre de desplazar era inalcanzable (preservaba duración); con los tiradores se llega en dos segundos.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** NO APLICA — es una decisión tomada en diseño, antes de escribir código, para que el estado absurdo no pueda existir.
**Causa raíz:** La ambigüedad vive en las CADENAS: "08:00"–"08:00" no distingue 0 de 24 h. El editor por eso NO trabaja en cadenas: mantiene el borrador en MINUTOS ABSOLUTOS, un marco donde `finMin > iniMin` SIEMPRE (el fin puede pasar de 1440 al cruzar medianoche, nunca envuelve por debajo del inicio). En ese marco la duración es `finMin - iniMin` sin ambigüedad, y la guarda solo acota a [30 min, 24 h].
**Cómo se cazó:** al diseñar la tanda, repasando los tres caminos (tiradores, cambiar día/puesto, aplicar) por los que la duración cero podría colarse — ninguno la alcanza con el marco absoluto.
**Arreglo aplicado:** `editarTurno` recibe iniMin/finMin absolutos (no cadenas) y acota `dur = min(max(finMin-iniMin, 30), 1440)`. La duración cero no se prohíbe con un `if`: NO EXISTE en el modelo, porque `fin` vive siempre por delante de `inicio`. El instrumento lo demuestra (E.tope: llevar el fin al mínimo NO baja de 30 min; su contraprueba inyecta < 30 y salta).
**Ley que sale de aquí:** ⚠️ POR QUÉ EL FIN PUEDE PASAR DE 1440 — y que nadie lo "arregle" con un `mod 24`: ese mod reintroduciría la ambigüedad cadena-0-vs-24h y reabriría el agujero de la duración cero. La diferencia entre PROHIBIR un estado absurdo (un `if` que hay que recordar) y hacer que NO PUEDA EXISTIR (elegir un modelo donde no cabe) es la misma del contador que se calcula en vez de guardarse: derivarlo cuesta más y es lo que lo hace incapaz de mentir. El `<=` de `normaliza` sigue sin arreglar, pero ahora es inalcanzable por este camino; sigue anotado como deuda.
**Traza:** `src/composables/editarTurno.js` (minutos absolutos + guarda); `src/composables/useEditor.js` (borrador absoluto, tiradores con tope); `tools/geometria.check.mjs` (E.tope).

## [2026-07-23] — La duración mínima y el snap eran el mismo número por casualidad: al bajar la precisión, se separan
**Categoría:** arquitectura
**Síntoma:** (decisión, no fallo) En la 2.b la duración mínima y el grano del snap eran ambos 30 y estaban CABLEADOS juntos (`DURACION_MINIMA = GRANULARIDAD_MIN`). La 2.c baja el snap a 15 (arrastre más fino) y añade teclado (minuto exacto). Si se hubieran movido en bloque, la mínima habría caído a 15 sin razón; y si alguien ve mañana "mínimo 5 minutos" pensará que es un número arbitrario y lo quitará —reabriendo la duración cero por la puerta de atrás—.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** NO APLICA — decisión tomada en diseño, antes de escribir código.
**Causa raíz:** Eran el mismo número por COINCIDENCIA, no por dependencia. Son dos cosas con dos razones: el SNAP (15) es PRÁCTICO —a 5,35 px/hora el ratón no agarra nada más fino; por eso el teclado, que no tiene ese problema, NO snapea—; la DURACIÓN MÍNIMA (5) es TÉCNICA —el muro contra el `<=` de `normaliza()`, que leería un turno de duración cero como 24 h—. El motivo práctico desaparece al teclear; el técnico NO desaparece nunca, venga el valor del ratón o del teclado.
**Cómo se cazó:** al diseñar la 2.c, repasando por qué la mínima existía. El comentario de la 2.b ya avisaba: "Si algún día deben divergir, se separan en dos constantes". Ese día llegó.
**Arreglo aplicado:** `DURACION_MINIMA = 5` pasa a literal con su razón escrita, desacoplado de `GRANULARIDAD_MIN = 15`. El muro se extrae a funciones PURAS (`acotaInicio`/`acotaFin`) por las que pasan LOS DOS caminos de entrada —tiradores (con snap) y teclado (sin snap)—, así la duración cero es inalcanzable por cualquiera de ellos, no solo por los tiradores (donde vivía TODA la protección hasta la 2.c). `type=time` mata además el parser de horas a mano. El instrumento estrena `E.teclado` (renderizado): teclear un fin sub-mínimo tampoco baja de 5.
**Ley que sale de aquí:** ⚠️ EL 5 NO ES ARBITRARIO Y NO ES EL SNAP. Es el muro contra el `<=` de `normaliza`; quitarlo reabre la duración cero. Dos números con dos razones no se funden en uno aunque coincidan: la coincidencia se rompe en cuanto uno de los dos motivos cambia. Y cada CAMINO DE ENTRADA nuevo (aquí el teclado) hereda el muro y su vigía renderizado — la protección no vive en un mando, vive en el modelo.
**Traza:** `src/composables/useEje.js` (GRANULARIDAD_MIN 15); `src/composables/editarTurno.js` (DURACION_MINIMA 5 literal + acota*/horaAAbsoluto); `src/composables/useEditor.js` (escribirInicio/Fin); `src/components/EditorTurno.vue` (type=time); `tools/geometria.check.mjs` (E.tope ≥5, E.teclado).

## [2026-07-23] — Se DEROGA «el eje se ensancha, nunca recorta»: la sustituye la ventana fija de 24 h que parte en dos
**Categoría:** arquitectura
**Síntoma:** (decisión, no fallo) Desde el Bloque 3, el eje era ÚNICO y ELÁSTICO: `calcularEje` estiraba sus bordes para que cupiera todo (la panadería de las 04:00 lo ensanchaba por la izquierda, ley "nunca recorta"). Al probar el editor (2.c), Antonio encontró que armar un nocturno 22:00→06:00 obligaba a un orden de campos raro; mirándolo, decidió que el problema no era el orden sino EL MODELO del eje: un negocio abre a una hora y su jornada dura 24 h fijas.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** NO APLICA — decisión de arquitectura tomada en diseño (tanda 2.d), antes de escribir código.
**Causa raíz:** El eje elástico deformaba la escala de TODOS los días por un turno de madrugada: con Carlos a las 04:00, la rejilla entera se dibujaba en [240,1800] en vez de [360,1800]. Y no tenía "hora de arranque" configurable: 06→06 estaba cableado (`DEFECTO_DESDE/HASTA`). Dos leyes contradictorias (ensanchar vs ventana fija) no pueden convivir en la doctrina: la siguiente persona construiría contra la que leyera primero.
**Cómo se cazó:** al usar el editor con las manos (Antonio), y al mapear en el diseño de la 2.d todos los sitios donde vivía la ley vieja (código, tests, comentarios, semilla, instrumento).
**Arreglo aplicado:** El eje pasa a VENTANA FIJA de 24 h `[E, E+1440]` con `E = INICIO_JORNADA_MIN` (fuente única en `negocio.js`, ajuste de negocio). `calcularEje` se RETIRA; nace `segmentar`, que intersecta `[S, S+dur]` con cada ventana → un turno se dibuja en 1 ó 2 trozos (el dato NO se parte; el DIBUJO sí). La misma fórmula parte por los dos lados (un turno antes de E es la madrugada del día anterior). Se retiran los 6 tests de `calcularEje` (probaban ensanche izq/der/borde de la ley muerta) y el de "el eje no cambia al mover" (ahora es constante por construcción); los sustituyen los de `segmentar` (el crítico: los dos trozos SUMAN la duración) y el del eje fijo. Instrumento reformulado (3.d/3.e); el trabajo de 2 barras va en PC2.
**Ley que sale de aquí:** ⚠️ EL EJE NO SE ENSANCHA — ES FIJO DE 24 h, Y LO QUE SE SALE SE PARTE. Que nadie reviva `calcularEje` ni el "nunca recorta": ensanchar deformaba la escala de todos los días por un turno de madrugada; partir mantiene la escala honesta y localiza cada trozo en su jornada. Un turno de madrugada (inicio < E) pertenece a la jornada anterior: no es una excepción, es la misma fórmula con signo. Las entradas VIEJAS de la bitácora que hablan del ensanche NO se retocan: son registro crudo de lo que fue verdad entonces.
**Traza:** `src/datos/negocio.js` (E, fuente única); `src/composables/useEje.js` (EJE_DIA, segmentar, ejeEditor; fuera calcularEje/DEFECTO_*); `src/composables/useCuadrante.js` + `useEditor.js` (eje constante); `src/components/{Parrilla,Celda,FichaTurno,Barra}.vue` (segmentos, cortes); `src/composables/useEje.test.js` + `moverTurno.test.js` (tests retirados/nuevos); `src/datos/semana.js` + `tools/geometria.check.mjs` (comentarios y 3.d/3.e).

## [2026-07-23] — La contraprueba de 3.e inyectaba en la barra de Carlos, que pasó a ser un trozo cortado que 3.e salta
**Categoría:** aviso falso
**Síntoma:** Al hacer que 3.e salte las barras con `data-corte` (un trozo cortado tiene el rótulo más ancho que la barra), su CONTRAPRUEBA del `--selftest` —que desplazaba una línea en la pista de Carlos— dejó de hacer saltar el detector: 3.e ya no mira la pista de Carlos. El `--selftest` lo cazó: `❌ 3.e → NO SALTÓ`, instrumento declarado NO FIABLE.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ `npm run geometria` (la corrida NORMAL) daba VERDE 5/5 y exit 0 con la contraprueba ya muerta: la corrida normal no ejercita las contrapruebas. El commit 2 se empujó así. Solo `--selftest` lo vio.
**Causa raíz:** La contraprueba apuntaba a Carlos por nombre (`data-persona="carlos"`), y Carlos pasó a ser el único trozo cortado on-view. Cambió la propiedad del sujeto (ahora lleva data-corte) sin que la contraprueba se enterara: apuntaba a un elemento que su propio detector ya ignora.
**Cómo se cazó:** el `--selftest` del instrumento, corrido a propósito ANTES de dar el instrumento por bueno, sospechando justo de este acoplamiento.
**Arreglo aplicado:** la contraprueba de 3.e inyecta ahora en una barra SIN corte (`[data-persona="ana"]:not([data-corte])`), que es la clase de barra que 3.e sí evalúa. `--selftest` vuelve a exit 0, 5/5 saltan.
**Ley que sale de aquí:** una contraprueba debe inyectar sobre un sujeto que SU detector de verdad evalúa; si el detector aprende a saltar una clase de elemento, sus contrapruebas no pueden vivir en esa clase. Y la lección de siempre: la corrida normal en verde no dice nada sobre si los detectores saben ponerse rojos — para eso está el `--selftest`, y hay que correrlo cuando se toca un detector.
**Traza:** `tools/geometria.check.mjs` (CONTRAPRUEBAS 3.e).

## [2026-07-23] — El chevron no comunicaba: una señal geométrica no puede explicar lo que no está en pantalla
**Categoría:** visual
**Síntoma:** Para señalar que un turno partido continúa fuera de un trozo, PC1 puso un chevron diminuto (`‹`/`›`) delante del horario. Antonio lo miró con el ojo en Carlos·Cocina·Lun: a ese tamaño no comunica nada — no se entiende que el turno viene de antes, ni de dónde.
**Qué se probó y DIO VERDE mientras el fallo estaba vivo:** ⭐ El instrumento daba 5/5 y la suite verde con el chevron puesto: ninguna comprobación automática mide "se entiende" (por diseño; ningún test lo mide). Solo el ojo de Antonio sobre la página lo cazó.
**Causa raíz:** La geometría se explica sola CUANDO el trozo que falta está en pantalla (ves las dos mitades y lo entiendes sin que nadie te lo cuente). Pero cuando el otro trozo está FUERA de la vista, no hay nada que ver: una señal geométrica no puede comunicar algo que no está. Ahí —y solo ahí— hace falta texto.
**Cómo se cazó:** ojo humano (Antonio), probando con las manos en localhost.
**Arreglo aplicado:** fuera el chevron, del todo. En su lugar, una NOTA de continuación en texto ("viene del domingo" / "continúa el lunes"), bajo la barra, SOLO cuando el otro trozo cae fuera de la vista (en un partido interior no hay nota: ya se ven las dos mitades). `segmentar` calcula `notaFuera` únicamente en los bordes de la semana. La nota envuelve, nunca se trunca, y es tinta de composición: no toca el color de la barra.
**Ley que sale de aquí:** una señal GEOMÉTRICA (forma, posición, borde recto del tajo) sirve cuando lo que representa está en pantalla; cuando NO está, la geometría no tiene nada que mostrar y hace falta TEXTO. No es una excepción a "que las cosas se vean, no que se lean": es que cuando la cosa no está, no puede verse. Y el corolario de método: "se entiende" no lo mide ningún test — lo mide el ojo sobre la página.
**Traza:** `src/composables/useEje.js` (segmentar → notaFuera solo en los bordes); `src/components/FichaTurno.vue` (fuera chevron, entra la nota); `src/components/Celda.vue` (pasa notaFuera); `src/datos/semana.js` (3 turnos partidos sembrados).
