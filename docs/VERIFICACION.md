# TURNIA — la verificación: qué corre, dónde y por qué

El mapa de la red. No la ley del color (esa vive en [ESTILO.md](ESTILO.md)), sino **qué comprueba qué,
cuándo se dispara, y —lo más importante— qué NO vigila nadie**. Se escribe para que ninguna red se
pierda como se perdieron los siete instrumentos del Bloque 3: un instrumento que existe pero que nadie
sabe cuándo correr es un instrumento perdido con más pasos.

## Tres bestias, de dos naturalezas

Hay dos clases de comprobación, y **viven separadas a propósito**:

- **Las que auditan LA FUENTE** — leen el código (`.js`/`.css`), son **puras y rápidas**, no necesitan
  navegador ni servidor. Corren **en cada commit**, dentro del hook.
- **Las que auditan LO RENDERIZADO** — necesitan un **navegador que calcule layout** y un servidor
  levantado, y son **lentas**. Corren **a mano**, al cerrar un bloque que toque la parrilla.

Juntarlas sería el error: meter lo lento-y-renderizado en el hook haría el commit insoportable y la
gente acabaría saltándoselo con `--no-verify` — peor que no tenerlo. Por eso `tools/` (renderizado) y
`src/estilo/` (fuente) están **separados físicamente**. Que nadie los junte creyendo que hace limpieza.

## En el hook (`.githooks/commit-msg`) — rápido, puro, en cada commit

| Comprueba | Se dispara cuando el commit toca | Qué caza |
|---|---|---|
| `sin-hex.check.mjs` | un `.vue` / `.css` | un `#hex` suelto fuera de la fuente única |
| `contraste.check.mjs` | `paleta.js` / `tokens.css` | un color que colisiona entre familias, o R < D/2 roto |
| `npm test` (Vitest) | **cualquier `.js` / `.mjs`** | la lógica temporal rota (`useEje`, y lo que venga) |
| bitácora | el asunto es `fix:` | un `fix:` sin su entrada (autogenera el esqueleto) |

**Por qué estos en el hook:** son rápidos, no levantan nada, y auditan la fuente. Pueden correr en
cada commit sin fricción.

**Por qué `npm test` se dispara con CUALQUIER `.js`/`.mjs` y no con una lista de rutas:** una lista
blanca de rutas hay que **acordarse de ampliarla**, y el día que nace lógica en una carpeta nueva (el
motor, un helper, `useArrastre.js`) entra en silencio y en verde. Es la misma trampa del `.gitignore`
que escondió la auditoría. Fail-closed: el fichero de lógica nuevo queda cubierto **sin tocar el hook**.
Y sigue discriminando: un commit de solo `.md`/`.vue`/`.css` **no arrastra la suite** (los `.vue` ya
tienen su propia red: color en el hook + geometría a mano + el ojo).

## A mano, al cerrar un bloque que toque la parrilla — `npm run geometria`

**CUÁNDO SE CORRE, con estas palabras:** al cerrar cualquier bloque que haya tocado la parrilla, sus
fichas, la barra, el eje o las líneas de rejilla — **antes del push del cierre**. No en cada commit.

Mide el **píxel resultante** (no el declarado) con un navegador de verdad: ancho de barra, color real
por muestreo de canvas, texto dentro de la barra, desbordes, líneas en horas redondas. Devuelve tres
estados: **0 VERDE** · **1 CAZADO** (violación real) · **2 NO PROBADA** (no pudo medir: servidor caído,
navegador reventado — reventar **no es** cazar). Trae contrapruebas `--selftest`: cada detector inyecta
su fallo y demuestra que sabe ponerse rojo (la lección de los siete instrumentos borrados: un
instrumento que nunca ha visto su rojo no es fiable).

**Por qué NO va en el hook:** navegador + servidor levantado + lento. En el hook, el commit sería
insoportable y acabaría en `--no-verify`.

## El `exit 1` en vacío — guardia BUSCADA, no bug

Vitest sale con código **1 cuando no encuentra NINGÚN test**. El hook lo trata como fallo **a
propósito**: si algún día el glob `include` de `vite.config.js` se rompe, alguien mueve los tests, o
una refactorización los deja fuera del patrón, el hook lo **caza** en vez de dar verde sobre cero
pruebas. **«0 casos» NO es «0 fallos»** — es uno de los falsos verdes clásicos del proyecto. Queda
anotado también en el propio `vite.config.js`, junto al glob, para que nadie lo "arregle" pensando que
es un incordio.

## Lo que la gobernanza NO vigila (el techo, en voz alta)

Para que el verde no se confunda con «todo comprobado». Hoy **nada** cubre:

- **Semántica ↔ semántica.** `contraste.check` compara identidad↔identidad e identidad↔semántica, no
  semántica↔semántica. Por eso el `#c2870a` compartido (aviso·relleno y exceso·borde) es **decisión de
  diseño documentada** ([ESTILO.md](ESTILO.md)), no algo que vigile el checker.
- **La lógica dentro de un `.vue`.** Los tests son de funciones **puras** (`useEje`); un bug en el
  `<script setup>` de un componente no lo caza `npm test` — solo la geometría a mano y el ojo.
- **La vista de consulta (móvil).** Nada la mide renderizada todavía.
- **`npm test` mide el DISCO, no el índice.** El hook corre la suite contra el árbol de trabajo, no
  contra lo que está en el `stage`. Un commit parcial (`git add -p`) se comprueba contra un estado que
  quizá nunca llega a ser commit. Casi siempre da igual; conviene saberlo.
- **`--no-verify` se salta el hook entero.** La red es estructura, no candado: protege del despiste,
  no de la voluntad de saltársela.
- **La geometría depende de la disciplina de correrla.** Es el eslabón más débil: si nadie la lanza al
  cerrar bloque, una regresión de píxel pasa. Por eso su «cuándo» está escrito arriba con esas palabras.
- **Fin de línea en Windows.** El hook es `bash` con shebang; si git lo saca como CRLF, `bash` podría
  atragantarse. Hoy corre; si un día el hook «no hace nada» sin error, mirar aquí primero.

## Añadir una comprobación

Una comprobación nueva obliga a: (a) decidir su **naturaleza** (fuente → hook; renderizado → a mano),
(b) **verla ponerse roja** con su contraprueba antes de creerla, (c) **anotar aquí** qué caza y cuándo
corre — o se pierde.
