# TURNIA — el sistema de diseño

El color aquí es **información, no decoración**. Cuatro familias que **NO se mezclan**, cada una con
su fuente única. La ley se mide sola (tablero `/estilo` + `contraste.check.mjs`); no se confía en la
disciplina.

> ⚠️ Los VALORES son literales heredados del Turnia viejo (son la fuente de verdad, no se
> recalculan). El CÓDIGO que los organiza y comprueba se escribe limpio.

## Las cuatro familias y dónde viven

| Familia | Qué es | Fuente única | Cómo se consume |
|---|---|---|---|
| **Identidad** | el color de cada persona | `src/datos/paleta.js` (dato, por índice) | `:style="{ background }"` |
| **Semántica** | gravedades + cobertura | `src/estilo/tokens.css` | utilidad / `var()` |
| **Marca** | el índigo + el logo | `tokens.css` + `src/estilo/marca/logo.svg` | `text-brand-800`, `<Marca/>` |
| **Composición** | superficies, líneas, tinta | `tokens.css` | `bg-card`, `border-line`, `text-ink` |

## Los literales (de la fuente)

**Identidad (12, por índice · ΔE00 mín 16,1 · croma ≥ 30 · L\* 31→78):**
`#2490B4 #085C88 #54588C #7C7CB0 #C484FC #A830A4 #44BCFC #789CFC #4068E8 #905CDC #64249C #F45CC8`

**Semántica · gravedades (relleno ≠ tinta):** imposible `#C81E1E`/`#B01414` · incumplimiento
`#E8590C`/`#A8410A` · aviso `#C2870A`/`#7D5606` · correcto `#15803D`/`#0F5C2C`.

**Semántica · cobertura:** correcto `#C3E6D1`/`#15803D` · falta `#F7C9C9`/`#DC2626` · exceso
`#EFE0C0`/`#C2870A` · sin candidato `#D7D4E2` (gris rayado). *(El «incubrible» = rojo rayado es otra
cosa distinta; llegará con el motor.)*

**Marca:** `#EEEDFE` `#7F77DD` `#534AB7` `#3C3489`. **Logo:** anillo discontinuo `#7F77DD` + punto
`#534AB7` + wordmark TURNIA en `brand-800`.

**Composición:** superficies page `#E4E2EC` · panel `#ECEAF4` · card `#FFFFFF` · rail `#F1F0F7` ·
band `#F7F6FC` · sunken `#E7E5F0` · líneas edge `#C3BFD6` (sección) > line `#DDDBE9` (día) >
line-soft `#EEECF4` (pelo) · tinta ink `#2C2643` · ink-soft `#5F5D70` · ink-faint `#8F8DA0`.
Fuentes: IBM Plex Sans (texto) · IBM Plex Mono (horas).

## Las leyes (`src/estilo/reglas.js`)

- **Dos umbrales, dos preguntas.** ESTADOS (gravedades + cobertura) → **ΔE 24** («¿se confunde con
  algo que el cuadrante afirma?»). MARCA + FONDOS (composición) → **ΔE 8** (no afirman nada; solo «no
  ser el mismo color»). A ΔE 24 la marca sola se comería el 84 % del espacio de color: por eso pesan
  distinto.
- **R < D/2.** `D` = ΔE mínimo entre dos personas; `R` = lo más que una barra se aleja de su color
  al llevar trama/anillo/alfa. Hoy **R = 0** (barras de relleno plano; esos canales aún no existen);
  se re-medirá cuando lleguen. No se inventa un valor.
- **Croma ≥ 30.** Por debajo, un color adopta la identidad del vecino (el marrón de Marco del viejo).
- **El relleno ≠ la tinta.** El relleno manda el vistazo; la tinta, la lectura (≥ 4,5 de contraste).

**Medición actual:** D = 13,9 · D/2 = 7,0 · R = 0 · R < D/2 ✅. Los 12 colores limpios (el más justo
frente a la marca, a 8,6 de brand-300). Lo comprueba `node src/estilo/contraste.check.mjs`.

**El par identidad↔semántica MÁS AJUSTADO de todo el sistema:** Persona 05 (`#C484FC`) ↔ Sin
candidato·relleno (`#D7D4E2`) = **ΔE 26,28**, margen **+2,28** sobre el umbral de 24. **Ambos son
rellenos** → compiten en el mismo canal (no es un borde contra un relleno: es relleno contra relleno).
Cumple la ley, pero es **el que menos aire tiene de todo el sistema**. ⚠️ Si en la parrilla del Bloque 3
una persona con el **color 05** acaba en una celda de «sin candidato» o **adyacente** a ella, ese es el
**primer punto donde hay que abrir la lupa sobre el píxel real** (no fiarse del declarado).

## Reutilización de hex entre sub-familias semánticas (DECISIÓN, no descuido)

Dos hex sirven a dos sub-familias semánticas a la vez. **Es intencionado**, porque significan lo
mismo y **nunca compiten en el mismo canal**:

- **`#C2870A`** = aviso·relleno (gravedad) **y** exceso·borde (cobertura). Los dos son el **ámbar**:
  «cuesta dinero, pero no rompe ninguna ley». El de gravedad va en el anillo de una barra; el de
  cobertura, en el borde de un tramo de la tira. Distinto canal, mismo significado.
- **`#15803D`** = correcto (gravedad) **y** correcto·borde (cobertura). Los dos son el **verde**:
  «está bien».

⚠️ El medidor comprueba **identidad↔identidad** e **identidad↔semántica**, **no** semántica↔semántica.
Este solapamiento, por tanto, **lo decide el diseño, no lo vigila el checker**: es una unificación
deliberada de dos señales que dicen lo mismo, no un choque que se coló. Si algún día ámbar-aviso y
ámbar-exceso tuvieran que divergir, se separarían en dos tokens.

## El peor caso geométrico (dónde queda anotado para que no se pierda)

`/estilo` mide sobre **swatches cuadrados e iguales**: confirma que el color declarado = el pintado,
pero **no siembra el peor caso** — una barra de **1 hora** (≈5 px de ancho) con un **borde de gravedad**
que se come ~⅔ del ancho y **falsea el color visible** por antialiasing. Ese caso es justamente donde
`R` (la desviación por canales) deja de ser 0.

**No vive en `/estilo`. Vive en la parrilla:**
- La **barra fina de relleno plano** (sin motor) → **Bloque 3** (parrilla), sembrando una celda con un
  turno de 1 h y midiendo el **píxel real** del relleno (no el declarado).
- El **borde de gravedad** que come el ancho → llega **con el motor** (las «dos franjas por fuera» son
  semántica de estado, que aún no existe). Cuando vuelva, ese peor caso se mide ahí y `R` se recalcula
  contra `D/2`. Hasta entonces, `R = 0` es honesto, no optimista.

## La gobernanza (estructura, no disciplina)

1. **`CLAUDE.md`**: todo color por su fuente; ningún `#hex` suelto en un `.vue`.
2. **`sin-hex.check.mjs`**: falla si hay un literal de color fuera de `tokens.css` / `paleta.js` / el logo.
3. **`contraste.check.mjs`**: falla si un color colisiona entre familias o se rompe R < D/2.
4. **El hook `commit-msg`** corre ambos cuando el commit toca color. Y el **tablero `/estilo`** lo
   enseña en vivo con banda roja.

Añadir un color obliga a: (a) meterlo en su fuente, (b) que los dos checkers pasen, (c) que salga en
el tablero.

## Discrepancias resueltas (la fuente manda)

Tres números que el usuario dio de memoria y la fuente corrigió: **L\* 31→78** (no 32–74) · **ΔE 24**
para estados (el 20 era el piso inicial, superado por el corolario) · **sin candidato = gris** y
**incubrible = rojo rayado** son **dos cosas distintas**. Gana la fuente.
