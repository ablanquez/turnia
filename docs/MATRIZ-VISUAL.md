# La matriz visual de la parrilla

**Este documento manda sobre el código.** Si un componente pinta algo que aquí no está
escrito, el que está mal es el componente.

## Por qué existe

Siete rondas de arreglos visuales, y cada una destapó una casuística que nadie había
contemplado: el «sin candidato» indistinguible de un hueco normal, el gris haciendo cuatro
trabajos, el rayado tapando el número del déficit, el aviso sin sujeto (dos veces), el color
de relleno usado como color de texto, la celda imposible sin cobertura.

Cada arreglo fue un parche puntual. **No existía ningún sitio que dijera «este caso se pinta
así».** El motor tiene sus enums —ahí está enumerado QUÉ PUEDE PASAR— pero el mapeo
`caso → representación` estaba repartido por los componentes Vue, decidido sobre la marcha.

Por eso cada ronda aparecía un caso nuevo. Esto lo cierra.

**Y no es una lista de casos: es un sistema de composición.** Del producto de las dimensiones
salen cientos de combinaciones expresables. No se enumeran: se derivan. Si una combinación
queda indefinida, **falta una ley, no falta un caso**.

Es el mismo principio que hizo bueno al motor —el comportamiento vive en la tabla, no en el
código—. Aquí: **la representación sale de las leyes, no de una lista.**

---

## 1. Las dimensiones

### 1.1 El bloque (lo que ocupa a una persona en el tiempo)

| # | Dimensión | Valores | Origen |
|---|---|---|---|
| B1 | **Naturaleza** | `turno` · `concepto` | `Assignment` / `ConceptEntry` |
| B2 | **Cómputo** (solo conceptos) | `adds` · `reduces_required` · `separate_counter` · `blocks` | `Computation` |
| B3 | **Gravedad acumulada** | subconjunto de {`notice`, `breach`, `impossible`} → 8 | `Severity`, y **se acumulan** |
| B4 | **Forzado** (solo turnos) | sí · no | `assignment.override` |
| B5 | **Cruza medianoche** | sí · no | `endHour > 24` |
| B6 | **Solapa consigo misma** | sí · no | geometría del carril |
| B7 | **Comparte celda** | sí · no | otras personas en el mismo puesto/día |
| B8 | **Se sale del eje** | *imposible por construcción* | el eje se ensancha (ley 1) |

Combinaciones **expresables**: 352. Combinaciones **alcanzables con datos reales**: **44.**

Y la diferencia no es cobertura que falte: es el modelo. Un concepto **no puede ser forzado**
(no cuelga de un turno) ni tener un **notice** (ninguna de sus cinco reglas es informativa), y
**solo el de contador aparte puede incumplir** (el tope de horas extra es su única regla de
gravedad media — ver `Validation/Rules/Concept/`).

Las 44 están escritas en `tests/Visual/matriz.mjs` (`ESPERADAS`), **derivadas del modelo, no de
mi gusto**, y el test falla si alguna no aparece. Esa lista es lo único que caza un dato que el
backend deja de mandar: ver §4.10.

### 1.2 El tramo de cobertura

| # | Dimensión | Valores |
|---|---|---|
| T1 | **Estado** | `covered` · `missing` · `excess` · **`unrequested`** |
| T2 | **Incubrible** | sí · no *(solo tiene sentido con `missing`)* |
| T3 | **Declarado** (`demanded`) | sí · no ← **hay dos ceros distintos** |
| T4 | **Cabe el rótulo** | frase entera · cifra sola · nada *(escalera de degradación)* |

Estados efectivos: `covered`, `missing`, `missing+incubrible`, `excess`, `unrequested` = **5**,
por 3 escalones = **15**.

> ⚠️ **T3 es la dimensión que casi me como.** `required = 0` significa dos cosas OPUESTAS:
> «nadie ha dicho nada sobre este tramo» (fuera de franja) y «alguien declaró CERO personas»
> (el día que el bar cierra). En el segundo, poner a alguien **sí es un exceso** — y del caro.
> Ver §4.9.

### 1.3 La banda de ausencia

| # | Dimensión | Valores |
|---|---|---|
| A1 | **Bloquea** | sí (`Computation::Blocks`) · no |
| A2 | **Tiene alta** | sí · **no** (`ends_on = null`) |
| A3 | **Posición en la semana** | única · primera · media · última |
| A4 | **Gravedad** | ninguna · notice · breach · impossible |

**64 combinaciones.**

### 1.4 La celda

| # | Dimensión | Valores |
|---|---|---|
| C1 | **Cartel de imposible** | sí · no |
| C2 | **Cartel de sin candidato** | sí · no |
| C3 | **Cerrada** | sí (no laborable **y** no se pide a nadie) · no |
| C4 | **Vacía** | sí · no |

**16 combinaciones.** C1 y C2 son **independientes**: pueden darse a la vez (ver §4.5).

### 1.5 El número honesto

El producto cartesiano ingenuo de las cuatro capas da **352 × 15 × 64 × 16 = 5.406.720**.
Ese número no es testable y **tampoco hace falta**: las capas son independientes por
construcción (ley 0). Lo que se prueba es:

1. El producto **completo dentro de cada capa**: 352 + 15 + 64 + 16 = **447 casos**.
2. La **independencia entre capas**, que es la afirmación que sostiene lo anterior y por eso
   **no se asume: se prueba** sobre las interacciones que sí existen (§5).
3. Las **combinaciones múltiples** difíciles, una a una (§5).

El informe (`BACKTEST-COMBINATORIO.md`) dice exactamente qué está probado exhaustivamente y
qué está muestreado. **No presume de lo que no ha medido.**

---

## 2. Las leyes de composición

### Ley 0 — UN CANAL, UNA PREGUNTA

Cada canal visual responde a **una** dimensión y solo a una.

**Es la ley que se ha roto siete veces.** El gris significaba a la vez «cubierto» y «no se
pide nada»; el naranja significaba a la vez «forzado» e «incumple»; el índigo significaba a la
vez «esta persona» y «cruza medianoche». *Dos casos distintos no pueden pintarse igual*, y la
única forma de garantizarlo por construcción —y no caso a caso— es que ningún canal lleve dos
dimensiones encima.

### Ley 1 — EL EJE X ES SOLO TIEMPO

Posición y ancho codifican **cuándo**, y nada más. El eje se ensancha para que quepa todo lo
que hay; **jamás se recorta un bloque**. Un turno de media hora es 3 px, pero está.

### Ley 2 — EL RELLENO DICE DE QUIÉN ES

El relleno de una barra es **el color de la persona**. Nunca el estado. Tapa los nombres de una
celda y todavía tienes que poder reconstruir quién hace qué.

> ⚠️ **Y ESO SE MIDE EN EL PÍXEL, NO EN EL CSS.** La paleta tenía quince colores *distintos* —en
> el CSS— y quince índigos con la misma luminosidad son **un solo color para el ojo**: quince
> pares por debajo del umbral perceptible, con Bea y Tomás compartiendo el RGB exacto. `matriz.mjs`
> daba 44 firmas y 0 gemelos mientras la fila de Barra eran tres barras iguales.
>
> «Firma distinta» no es lo mismo que «se distingue». Lo comprueba `tests/Visual/pixeles.mjs`,
> midiendo el ΔE00 sobre la imagen renderizada. Ver `COTEJO-VISUAL.md`.
>
> **El portador cambia con la vista, y la ley no.** En la Semana la barra está vacía: si tapas el
> nombre solo queda el relleno, y tiene que identificar. En el Día la barra lleva el nombre
> ESCRITO dentro, así que su relleno es un tinte (a plena tinta el texto no se leería, ley 6) y
> quien identifica es el **avatar sólido que va dentro de la barra**. La identidad está siempre
> dentro de lo que se ve, y siempre a plena voz.

### Ley 3 — DOS FRANJAS **POR FUERA** DICEN LA GRAVEDAD

> ⚠️⚠️ **Y SON DOS FRANJAS —ARRIBA Y ABAJO— Y NO UN ANILLO QUE RODEA. ESO NO ES CSS: ES LA LEY 0.**
>
> El anillo era un `outline`, o sea que rodeaba la barra por los cuatro lados. Y ahí su peso —lo que
> el ojo integra— es `1 − (ancho×alto)/((ancho+2w)(alto+2w))`: **depende del ANCHO de la barra.**
>
> | barra | el anillo pesa | el peor color queda a |
> |---|---|---|
> | 50 px (turno de 8 h) | 35 % | ΔE **20,1** ✅ |
> | 10 px (2 h) | 55 % | ΔE **8,7** ❌ |
> | 5 px (**1 h**) | **67 %** | ΔE **5,8** ❌ |
>
> **Un turno de una hora con un aviso ámbar se veía MARRÓN.** El bug de Marco, reencarnado — y esta
> vez la culpa no era del color: era que **el canal cambiaba de peso con la geometría**. Un canal
> que significa una cosa u otra según lo ancha que sea la barra no es un canal: **es una lotería.**
>
> Con dos franjas por fuera (`box-shadow`, que no come relleno) el peso es `2w/(alto+2w)` y **no
> depende del ancho**: 20 % / 27 % / 33 %, siempre. **El problema desaparece por construcción, no
> por ajuste.** Y contamina *menos* que el anillo que rodeaba, incluso en barras anchas. Se sigue
> leyendo como un anillo, porque el redondeo de la barra cierra los lados.
>
> ⚠️ **Y NI LA DEMO NI LOS 96 CASOS DEL CUADRANTE LO HABRÍAN ENSEÑADO NUNCA: todos usan turnos de
> ocho horas.** El peor caso geométrico de la app no estaba sembrado en ninguna parte. Ver
> `docs/RESPONSIVE.md` §4 y `tests/Visual/anchos.mjs`.

### Ley 3 (cómo era, y por qué se sacó de dentro de la barra)

Rojo = imposible · naranja = incumplimiento · ámbar = aviso · sin anillo = limpio.
**Nunca identidad.** Así la gravedad no borra a la persona, y la persona no disfraza la
gravedad.

> ⚠️ **CON EL COLOR QUE RELLENA, NO CON EL QUE ESCRIBE.** Cada gravedad tiene dos versiones: el
> relleno (vibrante, para verse de un vistazo) y la tinta (oscura, para leerse con 4,5 de
> contraste). Usaba la TINTA, y el ámbar del aviso salía marrón sucio: la ley se cumplía en el
> código y no en la pantalla. **Una marca no se lee: se ve.**

> ⚠️⚠️ **Y VA POR FUERA DE LA BARRA. ESO NO ES UN DETALLE DE CSS: ES LA LEY 0 EN SU FORMA LITERAL.**
>
> Durante dos tandas la gravedad fue un **borde**, o sea tinta **dentro** de la barra. Y una barra
> de la Semana mide 12 px, así que un borde de 2 px arriba y 2 abajo es el **cuarenta por ciento**
> de la barra. El ojo no ve dos canales: ve **una mezcla**. Medido sobre la imagen:
>
> | barra | se ve | suena a |
> |---|---|---|
> | ciruela `#5C4460` + borde ámbar | `#855F3E` **marrón** | tinta de aviso, ΔE 10,1 |
> | teal `#14748A` + borde ámbar | `#5A7C57` **VERDE** | **verde de COBERTURA**, ΔE 10,2 |
>
> La segunda línea es la que da miedo: **una barra con un AVISO se veía del color que esta app usa
> para decir «todo bien»**. Y la mezcla se alejaba ΔE 20–31 del color de la persona, así que el
> borde también se estaba comiendo la ley 2 — la misma que subir de 8 a 10 px solo alivió.
>
> Ahora el anillo es un `outline`: no ocupa ni un píxel del relleno. **Dos preguntas, dos
> espacios.** Y el **grosor** sube con la gravedad (aviso 2 · incumplimiento 3 · **imposible 4**):
> eso NO viola la ley 0 —que prohíbe *un canal con dos preguntas*—, sino que aplica la ley 6 —*una
> pregunta contestada por dos canales*.
>
> Y el aviso se queda fino **a propósito**: informa, no pide nada (ley 14). **Los dos gordos son
> los dos que piden una decisión.** El grosor dice lo mismo que el cartel.

> ⚠️ **EL GROSOR NO ES GRATIS, Y AJUSTARLO OBLIGA A RECALCULAR LA PALETA.** Cada píxel que engorda
> un anillo se lo quita al relleno. El imposible empezó en 2 px y la celda de Tomás era *azul con
> una textura rara*; a 3 px se volvió una cápsula roja. Y entonces el que se quedó corto fue el
> **incumplimiento**: a 2 px sobre una barra de 12, el naranja se leía como un **borde**, no como
> una alarma. Subirlo a 3 mandó el margen a **−2,4** con la paleta de entonces.
>
> La salida no fue otro color: fue **otra vez el alto de la barra**. `8 → 10 → 12 → 16`. Y la
> lección, la misma las cuatro veces: **dos preguntas peleándose por el mismo sitio se arreglan
> dándoles más sitio.**

### Ley 4 — LA TRAMA DICE «ESTO NO CUBRE EL PUESTO»

El mismo significado en **las tres capas**, y por eso el rayado es reconocible sin aprenderlo:

- barra **imposible** → rayada *(un turno imposible no cubre: el motor no lo cuenta)*
- **concepto** → hueco *(ocupa a la persona, no cubre el puesto)*
- tramo **incubrible** → rayado *(falta gente y no hay a quién poner)*

### Ley 5 — LA FORMA DICE LA NATURALEZA

Turno = barra sólida · concepto = barra hueca · ausencia = banda que atraviesa los días.

### Ley 6 — NINGÚN COLOR VA SOLO

Todo lo que dice un color lo dice **también una palabra**. El color es para el vistazo; la
palabra es la que se lee y la que sobrevive a un daltónico y a una captura en gris.

### Ley 7 — LA PEOR GRAVEDAD MANDA EL COLOR; TODAS VAN A LAS NOTAS

Un turno puede romper descanso corto **y** tope de horas **y** doble empresa a la vez. El borde
lo pinta la peor (`worst()`); **ninguna se pierde**: todas salen en las notas.

### Ley 8 — TODA NOTA LLEVA SUJETO Y HORA

`⚠ 08:00–16:00 · Forzado · descanso corto entre turnos`. Sin excepción. Un aviso sin sujeto
obliga a deducir, y deducir en una parrilla es equivocarse.

### Ley 9 — LO QUE LA CELDA YA GRITA, EL CARRIL NO LO REPITE

El imposible se dice **una** vez, bien. Tres carteles para un solo hecho no es insistir: es
ruido, y el ruido entrena a no leer.

> ⚠️ **Y «GRITA» TIENE QUE SIGNIFICAR «GRITA ESTE BLOQUE», NO «GRITA ALGO PARECIDO».**
>
> El cartel naranja **no** recoge los incumplimientos de un turno forzado (ley 14). Si la regla de
> silencio se conformara con «la celda tiene un cartel de incumplimiento», una celda con dos
> personas —una incumpliendo sin forzar y otra forzada— haría que el cartel de la primera
> **callara la nota de la segunda**, y el motivo del turno forzado desaparecería de la pantalla.
>
> Un silencio falso construido por una regla de silencio. **El ruido se combate quitando
> REPETICIONES, no datos.**

### Ley 10 — NADA SE TRUNCA

Se degrada por escalones (`faltan 2` → `-2` → nada, con el color y el tooltip diciéndolo
igual) o se calla. **Nunca se corta un dato por la mitad**: media cifra no es medio dato, es
un error con aspecto de dato.

### Ley 11 — EL VACÍO SIGNIFICA «NO HAY DATO», NUNCA «TODO BIEN»

El verde dice «bien». El vacío dice «aquí no se pide nada». **Un cuadrante vacío no es un
cuadrante sin problemas: es el peor cuadrante posible.**

### Ley 12 — LA COBERTURA NO CUENTA LO QUE NO CUBRE

Imposibles y conceptos suman cero. Pero **siguen partiendo el día**: el hueco se pinta
exactamente donde está.

### Ley 13 — LA REPRESENTACIÓN VIVE EN UN SOLO SITIO

`resources/js/composables/useMatrizVisual.js`. Los componentes **renderizan lo que esta función
devuelve**; no deciden un color por su cuenta. Dos sitios decidiendo el mismo color acaban
divergiendo, y el que diverja pintará una mentira con aspecto de dato.

> La tabla de motivos de los carteles estaba **duplicada** en `WeekGrid.vue` y en `DayGrid.vue`.
> La misma constante, dos veces. Vive ahora en la matriz, como todo lo demás.

### Ley 14 — EL CARTEL ES PARA LO QUE **PIDE UNA DECISIÓN**, NO PARA LO QUE OCURRE

Un cartel es la señal más fuerte de la parrilla: se ve sin buscarla y lleva el motivo escrito.
Una nota pequeña bajo la barra hay que ir a buscarla. Así que el cartel **se gana**.

**VA A CARTEL** lo que exige que alguien haga algo:

| | | qué hay que hacer |
|---|---|---|
| 🔴 **IMPOSIBLE** | rojo | quitarlo o cambiarlo |
| 🟠 **INCUMPLIMIENTO** | naranja | decidir si se fuerza o se arregla |
| ⬛ **SIN CANDIDATO** | gris | cualificar a alguien o cambiar el requisito |

El **gris** del último no es un capricho de tono: dice que el problema **no está en el
cuadrante, está en el catálogo**. Ninguna combinación de personas arregla un puesto que nadie
de la plantilla sabe cubrir.

**NO VA A CARTEL** lo que solo informa: una hora médica, un permiso, una hora extra (el bloque
ya está ahí, con su forma y su etiqueta); una baja o unas vacaciones (la banda ya lo dice); un
«también trabaja en otra empresa» (dato útil, ninguna acción).

> **Y el motivo es el mismo por el que existe esta matriz: UN CUADRANTE EN LLAMAS NO IMPRESIONA,
> ALARMA.** Si cada hora médica levantase un cartel rojo, la parrilla se llenaría de alarmas que
> no piden nada y el encargado aprendería a no mirarlas. **Un aviso que se ignora no existe.**

> ⚠️ **EL INCUMPLIMIENTO YA FORZADO NO LLEVA CARTEL.** Sale del mismo criterio: el cartel naranja
> dice *«hay que decidir si se fuerza o se arregla»*, y ahí **ya se decidió**, con constancia. No
> se esconde nada —la barra conserva su anillo naranja, su muesca y su nota «Forzado, con
> constancia»—: lo que no hace es **pedir una decisión que ya está tomada**.
>
> El imposible, en cambio, va a cartel **siempre**, forzado o no. No hay «forzar» un imposible:
> hay un turno que **no se puede cumplir**, y esa decisión no existe.

Se **apilan**, en orden de gravedad, porque son **hechos independientes** (ley 0): una celda
puede ser imposible **y** además no tener a nadie cualificado en el catálogo. Eran `v-if` /
`v-else-if`, y la segunda no salía.

Y el cartel dice **qué** pasa. **Quién** y **cuándo** los siguen diciendo la barra (su color, su
anillo) y su rótulo (su hora): **el cartel no repite lo que otro canal ya lleva.**

> **La demo enseña los dos lados de la regla, a propósito.** Sara (Cocina, lunes) y Leo (Caja,
> lunes) rompen la **misma regla** el **mismo día** con las **mismas horas**. El turno de Sara lo
> forzó alguien y quedó constancia; el de Leo no lo ha mirado nadie. Las dos barras llevan su
> anillo naranja — **solo la de Leo grita.** La diferencia se lee sin explicación.

### Ley 14 bis — LA MISMA REGLA, APLICADA A LA PROPIA AYUDA

La leyenda ocupaba **dos líneas y veinte muestras, siempre**. Era correcta y completa, y por eso
mismo nadie la iba a leer: un encargado que abre la parrilla **no necesita el manual entero
delante todo el rato**.

Y una leyenda que se ignora es tan inútil como un aviso que se ignora. Así que se parte igual que
los carteles:

- **Lo que dice QUÉ HACER** —los tres carteles y su acción— **siempre visible**. Se lo gana: un
  cartel rojo sin saber que significa *«quítalo o cámbialo»* es un adorno.
- **El resto del sistema** —cuenta, gravedad, marcas, cobertura— **a un clic**. No se quita: se
  **esconde**. De 2 líneas a 1; de 115 px a 48.

El **eje** (`el día va de 06:00 → 06:00`) **no se pliega**, y por el mismo motivo por el que
existe: sin él nadie entiende por qué un nocturno de 22:00 a 06:00 cabe entero dentro de su día.

---

## 3. El mapa de canales

| Canal | Dimensión que lleva | Y ninguna otra |
|---|---|---|
| Posición X + ancho | **cuándo** (B8) | ni gravedad, ni importancia |
| Sub-carril (Y) | **solapa consigo** (B6) | |
| Filo vertical + avatar | **de quién es** (B7) | |
| Relleno de la barra | **de quién es** (identidad) | ~~gravedad~~ ~~nocturnidad~~ |
| **Anillo (fuera de la barra)** | **gravedad** (B3): color **y** grosor | ~~forzado~~ · y **no toca el relleno** |
| Borde de la barra | **qué es** (turno / concepto) | ~~gravedad~~ |
| Trama / rayas | **no cubre el puesto** (B1, B2, T2) | |
| Muesca / marca de forma | **forzado** (B4) y **nocturno** (B5), distintas entre sí | |
| Relleno del tramo | **estado de cobertura** (T1) | |
| **Cartel de la celda** | **pide una decisión** (ley 14) | ~~lo que solo informa~~ |
| Rótulos y notas | **el nombre del hecho**, en palabras (ley 6) | |
| Cartel de celda | **lo que para el día** (C1, C2) — **se apilan** | |

---

## 4. Las decisiones de esta tanda

### 4.1 El nocturno conserva el color de la persona

**Antes:** `#534AB7` (= `--color-brand-600`) sustituía al color de la persona. Dos problemas a
la vez: la barra dejaba de identificar a nadie, y ese índigo es casi idéntico a los de la
propia paleta de personas (`#5566B8`, `#6478C4`, `#6C74C6`), así que *ni siquiera decía
«nocturno» de forma fiable*.

**Ahora:** relleno = color de la persona (ley 2). La nocturnidad es una **marca de forma**: la
barra lleva un **filo derecho marcado** en el borde del día (dice «sigue mañana») y el rótulo
lleva `☾`. Y la nota, con su hora, como siempre.

### 4.2 El forzado tiene canal propio

**Antes:** `if (block.forced || severity === 'breach') → naranja`. Un turno **forzado limpio**
—aquel cuyo motivo ya no existe— se pintaba exactamente igual que uno que **incumple**. Son
cosas opuestas: uno es *una decisión tomada*, el otro *un aviso desatendido*.

**Ahora:** el naranja es **solo** del incumplimiento (ley 3). El forzado es una **muesca**
(marca de esquina) sobre el relleno de la persona, y su nota. Así:

- forzado limpio → color de la persona + muesca. No parece un incumplimiento.
- forzado + incumplimiento → borde naranja + muesca. **Se ven las dos cosas.**
- forzado + imposible → borde rojo + trama + muesca. **Se ven las tres.**

### 4.3 El concepto pinta si SUMA TIEMPO

**Antes:** los cuatro `Computation` pintaban el mismo recuadro discontinuo. El payload manda
`computation` y `countsAsWork`, y **`PersonLane` no usaba ninguno de los dos.** «Hora extra» y
«hora médica» —opuestos para el contador— eran el mismo píxel.

**Ahora, dos formas** (la pregunta que el encargado se hace de verdad es *«¿le puedo dar otro
turno?»*):

| Cómputo | ¿Suma tiempo a algún contador? | Pintado |
|---|---|---|
| `adds` | sí, al contador principal | **relleno tramado** (ocupa y computa) |
| `separate_counter` | sí, a su contador aparte | **relleno tramado** (ocupa y computa) |
| `reduces_required` | no *(reduce lo exigible)* | **hueco** (ocupa y no computa) |
| `blocks` | no | **hueco** (ocupa y no computa) |

Los dos van **tramados o huecos** —nunca sólidos— porque **ninguno cubre el puesto** (ley 4).
Lo que cambia es si además *cuenta como tiempo de esa persona*.

> ⚠️ **Decisión derivada, dime si no es la que querías:** he leído «cuenta como trabajado» como
> *«suma tiempo a algún contador»*, y por eso `separate_counter` (las horas extra, que tienen su
> propio tope) va con el mismo pintado que `adds`. El payload traía `countsAsWork = (adds)`, que
> se quedaba corto. Si para ti las horas extra son «otra cosa», es un cambio de una línea.

Y el pie del rótulo deja de mentir por omisión: dice **qué es**, **que no cubre puesto** y
**si cuenta como tiempo trabajado**.

### 4.4 Las violaciones de conceptos y ausencias SE PINTAN

**Antes:** el motor las calculaba, el payload las mandaba (`violations.conceptEntries`,
`violations.absences`), **la cabecera las contaba** — y la parrilla no las pintaba jamás.
`violationsOf()` exigía `kind === 'shift'`. Una hora extra que se pasa del tope no salía por
ningún lado. **Un silencio falso con contador.**

**Ahora:** el concepto hereda el sistema completo del turno (borde = gravedad, notas con su
hora). La ausencia lleva su gravedad en la banda y su nota en el primer día.

### 4.5 Los carteles de celda se APILAN, y son TRES

**Antes:** `v-if="imposible"` / `v-else-if="sinCandidato"`. Una celda que era las dos cosas
enseñaba **solo** el imposible. Violación directa de la ley 0.

**Ahora:** son hechos independientes y se pintan todos, en orden de gravedad — y el sistema
entero es la **ley 14**: rojo (imposible), naranja (incumplimiento **sin forzar**), gris (sin
candidato). Lo que solo informa no lleva cartel.

### 4.6 La banda de ausencia va a TODAS las filas que esa persona puede cubrir

**Antes:** `bandRowOf()` = el puesto de menor id donde tiene turnos, y **si no tiene turnos
—justo el caso de una baja larga— caía en `positions[0]`**. El mismo bug que ya estaba
arreglado y documentado cuarenta líneas más abajo, para los conceptos huérfanos.

**Ahora:** la baja se pinta en **todas** las filas de sus `eligiblePositionIds` — que es donde
de verdad deja el hueco. Si Nuria es de cocina y de sala, su baja se ve en las dos.

### 4.7 La baja sin alta se distingue de la que continúa

`ends_on = null` («baja sin alta todavía») se pintaba **igual** que una baja que simplemente
sigue la semana que viene: borde recto por la derecha. Ahora el borde derecho **se desvanece** y
el rótulo lo dice: `Nuria · Baja · sin alta`.

### 4.8 «Cerrado» ≠ «no laborable»

El zoom Día marcaba `!isWorkingDay`; la Semana, nada. Pero **un bar abre en festivo con toda
normalidad**: teñir la columna por lo que diga el calendario laboral sería sugerir «aquí no se
trabaja» cuando sí se trabaja.

La marca se pinta cuando el día es no laborable **y además no se pide a nadie** — o sea, cuando
el negocio de verdad cierra. Es el dato accionable, no la etiqueta del calendario.

### 4.9 El cuarto estado del tramo: `unrequested`

Un turno de 10:00 a 18:00 contra una demanda declarada solo de 12:00 a 16:00 produce tramos
`10–12` y `16–18` con `required = 0, covered = 1`. Eso se pintaba **índigo con «+1»**, igual
que un exceso real.

Pero *no es que sobre uno*: **es que ahí no se pide a nadie.** «Sobra 1 sobre una demanda de 2»
y «hay 1 donde no se pide ninguno» son dos hechos distintos, y compartían píxel — el bug del
gris otra vez, reencarnado en índigo.

**Ahora es su propio estado**, con su propio pintado (neutro, sin número). Y de paso se tapa un
agujero latente: `CoverageSegment::state()` devolvía `covered` —**verde**— para
`required = 0, covered = 0`. Hoy no llega a la vista porque el calculador descarta ese tramo,
pero era una bomba de relojería: *«no se pide nada» pintado de «correcto»*. **El verde se gana:
ya no hay rama por defecto.**

> ⚠️ **Y AL ARREGLARLO ME CARGUÉ EL AVISO MÁS CARO. Lo cazó un test que ya existía.**
>
> Traté *todo* `required = 0` como «no se pide a nadie». Pero **hay dos ceros**:
>
> · **FUERA DE FRANJA** — no hay ningún requisito encima. Nadie ha dicho nada. No sobra nadie.
> · **CERRADO** — alguien declaró un requisito de **cero personas**: así se dice «ese día el bar
>   no abre». Poner a alguien ahí **SÍ es un exceso**, y del caro: pagas una jornada un día que
>   el negocio cierra.
>
> `CoverageSegment::$demanded` es la dimensión que faltaba, y `merge()` la compara: dos tramos
> con el mismo `required` y el mismo `covered` pueden **no ser el mismo tramo**.

### 4.10 El punto ciego del instrumento: un concepto nocturno no existía

`conceptRows()` **no mandaba `crossesMidnight`**, y los turnos sí. Una hora extra de 22:00 a
06:00 llegaba al navegador afirmando que **no cruza el día**: sin filo, sin `☾`, sin nota. El
bloque más difícil de leer de un cuadrante era justo el que se pintaba mudo.

**Y las tres comprobaciones daban verde**, porque el pintado era *coherente con la mentira del
servidor*. Solo lo caza declarar **qué casos debe permitir el modelo** y exigir que aparezcan
todos. Es la única comprobación que ve un dato que el backend deja de mandar.

### 4.11 Dos cosas que ningún test vio, y vieron los ojos

Con los cuatro instrumentos en verde, al abrir la página:

- **Las bandas de baja parecían cinta de obra.** La trama de la barra (3 px de raya cada 7) se
  lee como textura en 8 px y como un tachón en una banda de 16 px **con texto encima**. Misma
  gramática, otro volumen → `TRAMA_BANDA`.
- **Las barras con gravedad eran un borrón marrón.** Un borde de 2 px arriba y abajo de una
  barra de **8 px** deja **4 px de relleno**: el canal del borde se comía al de la identidad —
  justo lo que la ley 0 prohíbe. → `ALTO = 10`.

**Ningún test mide «se entiende».** Por eso la página se abre. Siempre.

### 4.12 Y `ALTO = 10` NO BASTABA: la lección completa

El arreglo de §4.11 fue un **parche**, y la ronda siguiente lo demostró. Mientras la gravedad
viviera **dentro** de la barra, el borde seguía siendo el 40 % de ella y el ojo seguía viendo una
mezcla — solo que menos. La cuenta entera está en la **ley 3**, y el resultado es que hacían falta
**dos** arreglos, y **ninguno de los dos bastaba solo**:

| | gravedad como **borde** | gravedad como **anillo** |
|---|---|---|
| paleta de croma ≥ 20 | **−18,4** ❌ | **−2,3** ❌ |
| paleta de croma ≥ 30 | **−14,1** ❌ | **+2,6** ✅ |

*(margen = cuánto más se parece la barra vista a **su persona** que a la gravedad ajena más
cercana. Negativo = la barra está diciendo una gravedad que no tiene.)*

Y un tercer número que manda sobre los otros dos: **el alto de la barra**. El anillo pesa
`2w / (ALTO + 2w)` de lo que el ojo integra, así que **subir la barra de 10 a 12 px le quita peso
al anillo, y ese peso vuelve entero a la identidad**:

| alto de la barra | margen exigido | ΔE00 mínimo **entre personas** |
|---|---|---|
| 10 px | ≥ 8 | 13,9 *(el umbral de «indistinguible» está en 12)* |
| **12 px** | **≥ 8** | **15,5** ✅ |

**La misma pelea de siempre —dos preguntas por el mismo sitio— resuelta dándoles más sitio.**

### 4.13 El croma: por qué la paleta era la equivocada aunque pasara su propia prueba

La segunda paleta cumplía su criterio: *«ningún color de persona a menos de ΔE 28 de un color de
estado»*. Los doce, con holgura, el peor a **29,6**. Y la barra de Marco **se veía marrón igual**.

Porque ese ΔE compara **dos parches aislados**, y en una parrilla **nada está aislado**: una barra
lleva **pegada** su marca de gravedad, y el ojo integra las dos. El criterio medía una cosa que no
pasa en la pantalla.

Y la causa de fondo tiene nombre: el **croma**. Por debajo de C≈30 un color **no tiene identidad
propia y adopta la del vecino**. Los dos culpables —`#5C4460` (ciruela apagado) y `#927496` (gris
violeta)— tenían **C 22 y C 20**. Barro.

El generador (`tests/Visual/paleta.mjs`) mide ahora **lo que se ve** —la barra **con** su anillo— y
exige que siga pareciéndose más a su persona que a cualquier gravedad ajena. Eso obliga a C ≥ 30 y
deja fuera toda la zona de barro **por construcción**, que es la única forma de que no vuelva.

> **Se pierden 1,0 de ΔE entre personas y se gana que ninguna barra finja una gravedad que no
> tiene.** Es el cambio correcto: dos personas que cuesta distinguir se resuelven **leyendo el
> nombre**; una barra que dice «incumplimiento» sin incumplir **no se resuelve con nada**.

---

## 5. Tabla de referencia

`P` = color de la persona. Cada fila sale de las leyes, no de una decisión suelta.

### 5.1 Bloques

El **anillo** va siempre **por fuera** de la barra (de 16 px), y su grosor sube con la gravedad:
aviso **2 px** · incumplimiento **3 px** · imposible **4 px**.

| Caso | Barra | Cartel de la celda | Nota | ¿Cuenta cobertura? |
|---|---|---|---|---|
| Turno limpio | sólida `P` | — | — | **sí** |
| Turno con aviso | sólida `P` + **anillo ámbar 2 px** | — *(informa, no pide nada)* | `↗ hora · …` ámbar | sí |
| Turno que incumple | sólida `P` + **anillo naranja 3 px** | 🟠 `INCUMPLIMIENTO · motivo` | *(ley 9: lo dice el cartel)* | sí |
| Turno imposible | tramada + **anillo rojo 4 px** | 🔴 `IMPOSIBLE · motivo` | *(ley 9)* | **no** |
| Turno forzado limpio | sólida `P` + **muesca** | — | `⚠ hora · Forzado, con constancia` | sí |
| Turno forzado + incumple | sólida `P` + anillo naranja + **muesca** | **— (ley 14: ya se decidió)** | `⚠ hora · Forzado · …` | sí |
| Turno nocturno | sólida `P` + **filo de continuidad** | — | `☾ hora · cruza medianoche` | sí |
| Turno que solapa consigo | dos barras en **sub-carriles** distintos | 🔴 `IMPOSIBLE · solape` | *(ley 9)* | **no** |
| Concepto que computa | **tramada** `P` | — | — | **no** |
| Concepto que no computa | **hueca** `P` (borde discontinuo) | — | — | **no** |
| Concepto con violación | + **anillo** de su gravedad | según la ley 14 | `⚠ hora · …` | no |
| Puesto sin nadie cualificado | *(no hay barra)* | ⬛ `SIN CANDIDATO EN CATÁLOGO` | — | — |

### 5.2 Tramos de cobertura

| Caso | Relleno | Borde | Rótulo |
|---|---|---|---|
| `covered` | verde | verde | — *(el verde ya lo dice; un «0» sería ruido)* |
| `missing` | rojo | rojo | `faltan N` → `-N` → nada |
| `missing` + incubrible | rojo **+ rayas encima** | rojo | `-N` *(el rojo dice cuánta gente falta; la trama, que no hay a quién poner)* |
| `excess` | índigo | índigo | `sobran N` → `+N` → nada |
| **`unrequested`** | neutro hundido | neutro | — *(no se pide a nadie: no hay número que dar)* |

### 5.3 Bandas de ausencia

| Caso | Banda | Rótulo |
|---|---|---|
| Ausencia que no bloquea | translúcida, borde continuo | `nombre · tipo` |
| Ausencia que **bloquea** | translúcida + **trama** | `nombre · tipo` |
| **Sin alta** (`ends_on = null`) | borde derecho **desvanecido** | `nombre · tipo · sin alta` |
| Con violación | + borde de su gravedad | + su nota |

### 5.4 Celda

| Caso | Pintado |
|---|---|
| Con imposible | cartel rojo, **con el motivo** (no una frase fija) |
| Sin candidato | cartel gris, **apilado** bajo el anterior si lo hay |
| **Cerrada** (no laborable **y** sin demanda) | marca de cerrado |
| Vacía | `min-height` y nada más *(sin ella la fila colapsa y la rejilla deja de parecer rejilla)* |

---

## 6. Lo que sigue sin definir

*(Nada, a día de hoy. Cuando aparezca una combinación que no caiga en ninguna ley, se apunta
aquí y se decide — no se inventa.)*

Ver `BACKTEST-COMBINATORIO.md` §4 para las combinaciones que el instrumento no cubre y solo se
sabrán en producción.
