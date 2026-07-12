# Auditoría visual: la parrilla contra la referencia

> **ESTADO: CERRADA.** Las 23 discrepancias, resueltas. Comprobado volviendo a medir con los
> mismos instrumentos: rejilla `118px + 7×320px`, radio `11px`, celda `10px 11px 12px` con
> `min-height: 124px`, pista de carril `8px`, tira de cobertura `15px`, panel `248px`, y
> **11 segmentos verdes** donde antes había **cero**.
>
> Se mantiene UNA divergencia, aprobada: **el eje se ensancha en vez de recortar**. La
> referencia hace `Math.max(6, Math.min(30, h))` y dibujaría la panadería de las 04:00 como
> si entrara a las 06:00. *La referencia manda en lo visual; no manda en lo que miente.*
>
> Al arreglarlo aparecieron **tres mentiras más**, todas mías, y ninguna la habría visto sin
> abrir la página:
> 1. El badge decía **siempre** `IMPOSIBLE · solape de la misma persona`, también en las
>    celdas donde el imposible era una BAJA. Aviso correcto, motivo falso. Ahora el cartel
>    dice qué es imposible.
> 2. La hora médica de Nuria (que es de cocina) se pintaba en la fila de **BARRA**: mi
>    fallback la metía en `positions[0]`. Ahora cae en un puesto que esa persona sí cubre, o
>    en ninguno.
> 3. Al mover esa hora médica DENTRO de su turno "para que se viera la colisión", el motor la
>    declaró **imposible** — y con razón: no se puede estar en el médico y en la cocina a la
>    vez. Se arregló el DATO DE DEMO, no el motor.


Comparación de `http://turnia.test/` contra `docs/design/parrilla-referencia.html`, **las dos
renderizadas en Chromium y medidas sobre el DOM**, no leídas ni recordadas.

Instrumentos (quedan en el repo): `tests/Visual/medir-referencia.mjs` y `tests/Visual/medir-turnia.mjs`.
Capturas: `tests/Visual/salida/`.

---

## Resumen: 23 discrepancias

| | Bloque | Nº | De las cuales importan |
|---|---|---|---|
| 🔴 | Rompen la lectura | 6 | 6 |
| 🟠 | Fidelidad estructural | 9 | 9 |
| 🟡 | Cosmético medible | 8 | 0 (pero se arreglan igual: el encargo es "IGUAL", no "equivalente") |

**Lo que SÍ está bien y no hay que tocar:** el eje temporal es exacto al píxel (medido: la barra
de Sara de 12:00–19:00 arranca en el 25,00 % de la pista y acaba en el 54,16 %, que leídos sobre
el eje 6→30 son **exactamente las 12,00 y las 19,00**); los carriles existen con su pista de 8 px
y sus líneas cada 6 h; la fuente es IBM Plex Sans + Mono con cifras tabulares; el panel lateral
mide sus 248 px; el nocturno cruza el borde y la jornada partida deja hueco físico.

---

## 🔴 BLOQUE 1 — Lo que rompe la lectura

### 1. NO HAY VERDE. La cobertura correcta no se pinta.

- **Referencia:** la tira de cobertura pinta **todo el día**. Verde `#15803D` sobre
  `rgba(21,128,61,.18)` donde la cobertura es correcta, rojo donde falta, índigo donde sobra.
  De un vistazo se ve *qué parte del día está resuelta*.
- **Turnia:** medido en el DOM, **`segmentos verdes en la página = 0`**. La tira es gris con
  manchas rojas sueltas.
- **Por qué importa — y es lo más grave de la auditoría:** sin verde, **el gris significa dos
  cosas a la vez**: "aquí está cubierto" y "aquí no se pide nada". Son cosas opuestas y se pintan
  igual. El encargado no puede distinguir un turno resuelto de una franja que nadie ha declarado.
  Es un silencio falso, pintado.
- **Causa raíz (y toca el MOTOR, no la vista):** `CoverageReport` recibe los segmentos ya
  filtrados — `CoverageCalculator::forCalendar()` hace
  `->filter(fn ($s) => $s->required !== $s->covered)`. Los tramos correctos **se tiran a la basura
  antes de salir del motor**. La vista no puede pintar lo que nunca recibe.
- **Qué tocar:** que el motor devuelva **todos** los segmentos y que `gaps()` / `excesses()`
  sigan filtrando. Es aditivo: nadie que use hoy `gaps()` cambia de comportamiento.

### 2. Los avisos vuelcan el mensaje ENTERO del motor y revientan la celda

- **Referencia:** notas **cortas**, de una línea, 9,5 px, con su color:
  `⚠ Forzado · descanso 8 h` · `☾ 22:00–06:00 · cruza medianoche` ·
  `↗ También en Bar Central hoy` · `● Solape imposible` · `Hora médica · no cubre puesto`
- **Turnia:** vuelco el mensaje completo del motor:
  *"Se pasa del tope semanal: quedaría en 42h 00min de un máximo de 40h 00min."* — que ocupa
  **dos líneas** y se repite en cada celda de Sara, seis días seguidos.
- **Por qué importa:** las celdas crecen 2–3× de alto, la rejilla pierde el ritmo y hay que
  hacer scroll para ver la semana. La parrilla se lee de un vistazo o no se lee.
- **Qué tocar:** nota corta en la celda (icono + tres palabras) y **el mensaje completo del motor
  en el `title`** (ya está el tooltip). El texto largo no se pierde: se pide.

### 3. Celdas sin `min-height`: la rejilla se descuadra

- **Referencia:** `min-height: 124px`. Todas las celdas guardan el mismo ritmo aunque estén vacías.
- **Turnia:** medido `min-height: auto`; una celda vacía mide **69,3 px** y otra llena, 229.
- **Por qué importa:** las filas bailan y el ojo pierde la alineación entre días. Es lo que hace
  que la parrilla "parezca" un listado en vez de una rejilla.
- **Qué tocar:** `min-height: 124px` en la celda.

### 4. El "sin candidato" no se distingue de un hueco normal EN LA TIRA

- **Referencia:** dos señales. El badge gris `Sin candidato en catálogo` **y** un segmento en la
  tira con **rayado gris** (`repeating-linear-gradient(45deg,#DEDEE6 0 5px,#F2F2F6 5px 10px)`,
  borde `#8A8A99`) y la etiqueta `sin cand.` — no rojo.
- **Turnia:** el badge sí; pero en la tira sale un **rojo idéntico al de un hueco normal**.
- **Por qué importa:** el rojo dice "ponle a alguien". Y aquí no hay a quién poner. Es exactamente
  el aviso falso que el `UncoverablePosition` existía para evitar, y la interfaz lo está
  deshaciendo.
- **Qué tocar:** el segmento de un puesto incubrible se pinta rayado gris, no rojo.

### 5. La celda imposible sigue pintando cobertura

- **Referencia:** `if (!cfg.impossible)` — cuando hay un solape imposible, **no se calcula ni se
  pinta la tira**. La celda solo grita el imposible.
- **Turnia:** pinto el badge Y la tira de cobertura debajo, con sus huecos.
- **Por qué importa:** con dos personas imposibles, la cobertura que se calcula es una ficción
  (cuenta a alguien que no puede estar ahí). Enseñar un número derivado de un estado imposible es
  darle apariencia de dato.
- **Qué tocar:** si la celda tiene un imposible, se oculta la tira.

### 6. El panel de plantilla no lleva sus banderas

- **Referencia:** cada tarjeta lleva una **píldora de estado**, y hay cinco:
  `Baja médica · 8–10 jul` (neutra) · `Hoy también en Bar Central` (ámbar) ·
  `Descanso corto entre turnos` (naranja) · `Jornada partida hoy` (neutra) ·
  `Turno nocturno hoy` (neutra).
- **Turnia:** solo dos, y una de ellas es mía ("Contrato sin condiciones definidas").
- **Por qué importa:** el panel es **donde el encargado elige a quién colocar**. Sin las banderas,
  elige a ciegas: no sabe que esa persona está de baja, ni que ya está comprometida en otro sitio,
  ni que arrastra un descanso corto.
- **Qué tocar:** derivar las banderas de lo que el motor ya sabe (ausencias, `SharedWorkday`,
  `MinimumRest`, jornada partida, nocturno) y pintarlas con la semántica de color.

---

## 🟠 BLOQUE 2 — Fidelidad estructural

### 7. Las bajas: banda dentro de la celda, no una fila aparte

- **Referencia:** una **banda índigo** (`rgba(60,52,137,.13)`, borde `rgba(60,52,137,.28)`, 16 px)
  **dentro de la celda del puesto**, que se encadena a través de los días
  (`first` / `mid` / `last`: bordes redondeados solo en los extremos) y solo rotula en el primero:
  `Ana · Baja médica`.
- **Turnia:** una fila "Ausencias" separada, arriba del todo.
- **Por qué importa:** en la referencia se ve *el hueco que deja la baja en el puesto donde
  faltaba esa persona*, y se ve **de un tirón**, atravesando los tres días. En mi versión hay que
  cruzar la vista entre dos zonas de la pantalla.
- **Discrepancia consciente que yo introduje y hay que revertir:** argumenté que una baja no es de
  un puesto. Es cierto en el modelo, pero **la referencia gana en la lectura** y esta tanda va de
  fidelidad. Se pinta la banda en la fila del puesto donde esa persona tenía turnos.

### 8. Los conceptos: dentro del carril de la persona, no en una fila aparte

- **Referencia:** el concepto es una barra **discontinua dentro del carril de esa persona en el
  puesto** (Pedro, Sala, "Hora médica" de 10 a 11 sobre su turno de 13 a 17), con la nota
  `Hora médica · no cubre puesto`.
- **Turnia:** fila "Conceptos" separada.
- **Por qué importa:** el valor está en **ver la colisión**: que la hora médica cae dentro del
  tramo en el que se supone que está en la barra. Alineado en el mismo eje pero en otra fila, hay
  que buscarlo.
- **Qué tocar:** la barra del concepto va en el carril de la persona; y si esa persona no tiene
  turno ese día, se le da carril propio en la celda.

### 9. "Sumiller" ocupa una fila entera con siete badges

- **Referencia:** no hay fila de sumiller. El "sin candidato" aparece **en la celda concreta**
  donde se pide (Caja/Mar) con su badge y su tramo rayado.
- **Turnia:** fila entera "Sumiller", vacía, con el badge `Sin candidato en el catálogo` repetido
  **siete veces**, una por día.
- **Por qué importa:** siete veces el mismo aviso es ruido, y el ruido entrena a ignorar. Además
  ocupa una fila de la rejilla para no decir nada nuevo.
- **Qué tocar:** el badge, una vez por celda con demanda; y una sola línea en la franja de
  conflictos de catálogo (que ya existe).

### 10. Badge del imposible: falta la mitad del texto

- **Referencia:** `IMPOSIBLE · solape de la misma persona`
- **Turnia:** `IMPOSIBLE`
- **Por qué importa:** "IMPOSIBLE" a secas no dice qué es imposible. El encargado tiene que
  deducirlo.

### 11. El nocturno no se colorea distinto

- **Referencia:** la barra del turno nocturno se pinta en **índigo oscuro `#534AB7`**, distinta
  del color de la persona, con el icono `☾`.
- **Turnia:** color de la persona, sin icono en la barra.
- **Por qué importa:** el nocturno es la excepción que más cuesta ver en un cuadrante. Merece
  color propio, y el índigo no compite con la semántica de estado.

### 12. Falta el `⚠` / `●` / `☾` como icono de estado del carril

- **Referencia:** al final de la línea del nombre, un icono de 11 px: `⚠` forzado (naranja),
  `●` imposible (rojo), `☾` nocturno (índigo).
- **Turnia:** solo un punto `●` genérico con el color de la gravedad.
- **Por qué importa:** el icono dice *qué* pasa sin leer. El punto solo dice *que* pasa algo.

### 13. El resumen de horas no se trunca: desborda

- **Referencia:** el resumen (`08:00–12:00 · 17:00–21:00`) es `flex: 1; min-width: 0` con
  `text-overflow: ellipsis`. Se come el espacio sobrante y **se recorta él**, nunca el nombre.
- **Turnia:** lo puse `shrink-0` para "no truncar", y con tres bloques **desborda la celda**.
- **Por qué importa:** el nombre es lo que no se puede truncar (Hugo/Humberto). La hora, si no
  cabe, se recorta y se lee en el tooltip. Lo hice al revés de lo que dice el diseño.

### 14. Sin `min-height` en la pista de carriles

- **Referencia:** `minHeight: 22px` en la pista.
- **Turnia:** sin mínimo.

### 15. La rejilla de la pista, mal en la vista Día

- **Referencia:** en la semana las líneas van cada **25 %** (6 h); en el Día, cada **12,5 %** (3 h).
- **Turnia:** calculo el tamaño desde el eje, lo que da lo mismo *solo si el eje mide 24 h*. Si el
  eje se expande (panadería a las 04:00), las líneas dejan de caer en horas redondas.

---

## 🟡 BLOQUE 3 — Cosmético, pero medido (el encargo es "IGUAL")

| # | Aspecto | Referencia | Turnia |
|---|---|---|---|
| 16 | Columna de puestos | **118 px** | 130 px |
| 17 | Radio de la rejilla | **11 px** | 12 px |
| 18 | Padding de celda | **10px 11px 12px** | 10 px |
| 19 | Cabecera de día | `Lun` y `6 jul` **apilados** (12,5 px bold / mono 10 px) | en línea |
| 20 | Texto de la leyenda | `cada columna = 1 día · 06:00 → 06:00 · pasa el ratón sobre una barra estrecha` | `cada columna = 1 día · el eje es la hora real` |
| 21 | Regla horaria en la semana | **no la hay** (el rango se dice en la leyenda) | la añadí en cada columna |
| 22 | Paleta por persona | asignada **por nombre** (Ana `#7F77DD`, Marco `#4E7FD1`, Sara `#7A73C9`…) | los mismos 15 hex pero **por `id % 15`**, así que a cada uno le toca otro color |
| 23 | Tira de cobertura en el Día | 16 px, etiqueta ancha `faltan 2` | 16 px, etiqueta ancha ✓ (ya está bien) |

---

## Una divergencia que propongo MANTENER

**El eje.** La referencia hace `pct(h) = (Math.max(6, Math.min(30, h)) - 6) / 24 * 100`: **recorta**
cualquier cosa fuera de 06:00–06:00. Una panadería que entra a las 04:00 se dibujaría pegada al
borde izquierdo, como si entrara a las 06:00.

Eso es **una mentira dibujada**, y es justo la clase de fallo que llevamos seis tandas cazando. Mi
eje se **ensancha** en vez de recortar. Es la única desviación deliberada de la referencia que
quiero conservar, y la señalo para que decidas tú.

(Consecuencia: con el eje ensanchado, las líneas de la rejilla deben calcularse en horas, no en
porcentajes fijos — es el punto 15.)

---

## Lo que hay que tocar, por fichero

| Fichero | Puntos |
|---|---|
| `app/Services/Scheduling/CoverageCalculator.php` | 1 (devolver también los tramos correctos) |
| `app/Services/Scheduling/CoverageReport.php` | 1 (`gaps()`/`excesses()` siguen filtrando) |
| `app/Services/Scheduling/Presentation/SchedulePayload.php` | 1, 4, 5, 6 (estado del segmento; banderas del panel) |
| `resources/js/Components/Schedule/CoverageStrip.vue` | 1, 4, 5 |
| `resources/js/Components/Schedule/PersonLane.vue` | 2, 11, 12, 13, 14 |
| `resources/js/Components/Schedule/WeekGrid.vue` | 3, 7, 8, 9, 10, 15, 16–21 |
| `resources/js/Components/Schedule/DayGrid.vue` | 5, 10, 15 |
| `resources/js/Components/Staff/StaffPanel.vue` | 6 |
| `resources/js/Components/Schedule/Legend.vue` | 20 |
| `app/Services/Scheduling/Presentation/PersonPalette.php` | 22 |
| `database/seeders/DemoSeeder.php` | (para que la demo enseñe los seis estados a la vez) |

---

## Los seis estados: cuáles se ven hoy

| Estado | Color | ¿Se ve en Turnia? |
|---|---|---|
| Imposible | rojo rayado `#C81E1E` | ✅ sí |
| Incumplimiento | naranja `#E8590C` | ✅ sí |
| Aviso | ámbar `#C2870A` | ✅ sí |
| Cobertura correcta | verde `#15803D` | ❌ **NO. Ni uno.** |
| Exceso | índigo `#7F77DD` | ✅ sí |
| Sin candidato | gris rayado `#8A8A99` | ⚠️ solo el badge; en la tira sale **rojo**, como un hueco normal |
