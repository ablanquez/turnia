# El backtest combinatorio de la matriz visual

**Instrumento:** `tests/Visual/matriz.mjs` · **Datos:** `database/seeders/MatrizSeeder.php`
**Reglas:** `docs/MATRIZ-VISUAL.md` · **Contraprueba:** `tests/Visual/mutaciones.sh`

Todo lo que sigue está medido **sobre la página real, abierta en Chromium a 1366 px**,
preguntándole al navegador el color que *calculó* — nunca el que estaba declarado.

---

## 1. Resumen ejecutivo

Sí, está cubierto. **44 casos de bloque, 44 firmas visuales distintas, 0 gemelos.**

Y había **siete agujeros**, cinco de ellos silencios o mentiras que la parrilla llevaba
pintando desde hace tandas. Ninguno se había detectado en las siete rondas anteriores, porque
todos los instrumentos preguntaban *«¿está bien pintado esto?»* — y todos estos casos lo
estaban, uno a uno. Lo que fallaba era **el conjunto**: dos cosas distintas con el mismo píxel.

| Instrumento | Comprobaciones | Estado |
|---|---|---|
| `comprobar.mjs` (la demo, globales) | 21 | ✅ |
| `backtest.mjs` (13 escenarios sembrados) | 72 | ✅ |
| `cotejo.mjs` (celda a celda, persona a persona) | 89 filas | ✅ |
| **`matriz.mjs`** (el producto cartesiano) | **44 + 6 + 4 + 3** | ✅ |
| PHPUnit | 207 tests / 684 aserciones | ✅ |
| `mutaciones.sh` (el detector contra sí mismo) | **8 bugs reintroducidos → 8 cazados** | ✅ |

Los instrumentos **se acumulan, no se sustituyen**. El cotejo caza cosas que la matriz no ve
(el contraste real de cada rótulo, el aire entre carriles); la matriz caza cosas que el cotejo
no ve (que dos casos distintos compartan píxel). Ninguno sobra.

---

## 2. Cuántas combinaciones son, de verdad

El producto cartesiano **ingenuo** de las cuatro capas da:

```
BLOQUES 352  ×  TRAMOS 15  ×  BANDAS 64  ×  CELDAS 16  =  5.406.720
```

Ese número **no es testable, y tampoco hace falta**: las capas son independientes por
construcción (ley 0 — un canal, una pregunta). Lo que se prueba es:

1. **El producto completo DENTRO de cada capa** — 447 combinaciones.
2. **La independencia entre capas**, que es la afirmación que sostiene lo anterior, y por eso
   **no se asume: se prueba** sobre las interacciones que sí existen (§6).
3. **Todos los pares**, capa a capa: 44×43/2 = 946 pares de bloques, 15 de tramos, 6 de bandas.

Y de las 352 combinaciones teóricas de bloque, **solo 44 son alcanzables con datos reales**.
No es una excusa: es el modelo. Las 308 restantes no existen, y el informe dice por qué (§4).

---

## 3. Los pares que se pintaban IGUAL siendo DISTINTOS

Esto es lo que más interesaba del informe: **los silencios falsos visuales.** Siete.

### 3.1 🔴 Turno forzado limpio ≡ turno que incumple

```js
if (block.forced || severity === 'breach') { return { background: '#E8590C' } }
```

El mismo naranja para dos cosas **opuestas**: un forzado es *una decisión tomada, con
constancia*; un incumplimiento es *un aviso que nadie ha atendido*. Y un turno forzado cuyo
motivo ya no existe se pintaba como un problema que no tenía.

**Ahora:** el naranja es solo del incumplimiento (ley 3). El forzado es una **muesca** (ley 0:
canal propio). Un turno forzado que además incumple enseña las dos cosas.

### 3.2 🔴 Nocturno de cualquiera ≡ turno normal de una persona índigo

El nocturno se pintaba `#534AB7` **sustituyendo** al color de la persona. Dos fallos en uno:

- la barra dejaba de identificar a nadie (en una celda con tres personas, ¿de quién es?);
- ese índigo es casi idéntico a los de la propia paleta de personas (`#5566B8`, `#6478C4`,
  `#6C74C6`), así que **ni siquiera decía «nocturno» de forma fiable**.

Un canal llevando dos preguntas, y contestando mal a las dos.

**Ahora:** relleno = persona (ley 2); la nocturnidad es un **filo** en el borde del día + `☾`.

### 3.3 🔴 Concepto que SUMA HORAS ≡ concepto que solo BLOQUEA

Los cuatro `Computation` pintaban el mismo recuadro discontinuo y decían la misma frase. El
payload mandaba `computation` y `countsAsWork`, y **`PersonLane` no usaba ninguno de los dos.**
«Hora extra» y «hora médica» —opuestos para el contador— eran el mismo píxel, justo en la
pantalla donde el encargado decide *«¿le puedo dar otro turno?»*.

**Ahora:** el que suma tiempo va **tramado**; el que no, **hueco**. Y el pie lo dice con letras.

### 3.4 🔴 «No se pide a nadie» ≡ «sobra gente»

Un turno de 10 a 18 contra una demanda declarada solo de 12 a 16 produce tramos en los bordes
con `required = 0, covered = 1`. Eso pintaba **índigo con «+1»**, igual que un exceso real.
No es que *sobre* uno: es que ahí **no se pide ninguno**.

Es el bug del gris —«cubierto» y «no se pide nada» compartiendo color— reencarnado en índigo.

**Ahora:** cuarto estado `unrequested`, neutro y sin número.

> ⚠️ **Y AL ARREGLARLO ME CARGUÉ OTRA COSA, Y LO CAZÓ UN TEST QUE YA EXISTÍA.**
>
> Traté *todo* `required = 0` como «no se pide». Pero **hay dos ceros distintos**: el que nadie
> ha declarado (fuera de franja) y el que **alguien declaró a propósito** — un requisito de
> CERO personas, que es como se dice «ese día el bar no abre». Poner a alguien ahí **sí es un
> exceso**, y de los caros: pagas una jornada un día que el negocio cierra.
>
> `CoverageCalculatorTest::gente_colocada_un_dia_cerrado_sale_como_exceso` se puso rojo.
> El campo `demanded` es la dimensión que faltaba.

### 3.5 🟠 Baja que BLOQUEA ≡ ausencia que no bloquea

`bandStyle()` ignoraba el campo `blocks`, que el payload venía mandando. Unas vacaciones y una
formación se pintaban idénticas. **Ahora:** la que bloquea va tramada.

### 3.6 🟠 Baja SIN ALTA ≡ baja que continúa la semana que viene

`ends_on = null` («todavía no hay alta») se pintaba con el mismo borde recto que una baja que
simplemente sigue. **Ahora:** el borde derecho se desvanece, y lo dice con letras (ley 6).

### 3.7 🟡 El glifo ↗ tenía dos significados

«También trabaja en otra empresa» (el punto ámbar del avatar) y «contrato sin condiciones
definidas» compartían símbolo. *(Corregido en el catálogo de iconos.)*

---

## 4. Los silencios: lo que el motor sabía y la parrilla no decía

### 4.1 🔴 Las violaciones de CONCEPTOS y AUSENCIAS no se pintaban jamás

El motor las calculaba. El payload las mandaba (`violations.conceptEntries`,
`violations.absences`). **La cabecera las contaba.** Y la parrilla no las pintaba nunca, porque
`violationsOf()` exigía `kind === 'shift'`.

Una hora extra que se pasa del tope de horas extra **no salía por ningún lado**.
Un silencio falso **con contador**: el indicador prometía incidencias que no llevaban a nada.

### 4.2 🔴 La banda de una baja larga caía en `positions[0]`

`bandRowOf()` la ponía en el puesto de menor id donde la persona tuviera **turnos** — y si no
tenía ninguno (que es *exactamente* el caso de una baja larga), caía en el primer puesto de la
lista. La baja de Nuria, que es de cocina, se pintaba en **Barra**: afirmando un agujero en un
puesto que ella no cubre.

Es el **mismo bug que ya estaba arreglado y documentado cuarenta líneas más abajo**, en el
mismo fichero, para los conceptos huérfanos. Ahora va a **todas** las filas que puede cubrir.

### 4.3 🔴 El cartel de «sin candidato» desaparecía si además había un imposible

Eran `v-if` / `v-else-if`. Son dos hechos **independientes**: uno está en el cuadrante, el otro
en el catálogo. **Ahora se apilan.**

### 4.4 🔴 Un concepto nocturno no decía que cruza medianoche

`conceptRows()` **no mandaba `crossesMidnight`**, y los turnos sí. Una hora extra de 22:00 a
06:00 llegaba al navegador afirmando que no cruza el día: sin filo, sin `☾`, sin nota.

> ⚠️ **ESTE ES EL QUE MÁS ME PREOCUPA, PORQUE LAS TRES COMPROBACIONES DABAN VERDE.**
>
> El instrumento compara el pintado con **lo que el servidor dice**. Si el servidor **calla**,
> el pintado es coherente con el silencio y todo pasa. Lo cacé **contando los casos a mano**:
> salían 36 de los 44 que el modelo permite.
>
> Contar a mano no es un instrumento. Así que ahora la cuenta se declara en el test
> (`ESPERADAS`), y **si falta un caso que el modelo permite, el test lo grita**. Es la única
> comprobación que caza un dato que el backend no manda.

### 4.5 🟡 `CoverageSegment::state()` tenía un `default` que caía en VERDE

Con `required = 0, covered = 0` no encajaba en ningún caso y devolvía `'covered'` — o sea,
**correcto**. Hoy el calculador descarta ese tramo antes de emitirlo, así que no llegaba a la
vista; pero era una bomba de relojería. **El verde se gana**: ya no hay rama por defecto.

---

## 5. Las combinaciones MÚLTIPLES

Las que nadie mira, porque cada pieza está decidida por separado. Todas verificadas:

| Combinación | Qué se pinta | ✅ |
|---|---|---|
| Turno **forzado** que **además solapa** (Impossible) | trama + borde rojo + **muesca**, y la nota del forzado | ✅ |
| Bloque con **Impossible + Breach + Notice** a la vez | borde rojo (ley 7: manda la peor) y **las tres en las notas** | ✅ |
| **Solape dentro de una ausencia** | dos sub-carriles + banda tramada + cartel con **el motivo real** | ✅ |
| **Concepto** en una celda **sin candidato** | concepto hueco/tramado + cartel gris del catálogo | ✅ |
| Nocturno **+ tope pasado + comparte celda** con otras | filo + borde naranja + filo de color propio | ✅ |
| **Exceso** en un puesto **incubrible** | índigo (no rojo) — el rayado es solo del hueco | ✅ |
| **Imposible + sin candidato** en la misma celda | **los dos carteles, apilados** | ✅ |
| Nocturno **forzado** que **incumple** | filo + muesca + borde naranja: **tres marcas, tres hechos** | ✅ |

Las cuatro últimas filas son cruces entre capas: son la prueba de la **independencia** que
justifica no recorrer los 5,4 millones.

---

## 6. La contraprueba: el detector contra sí mismo

> *«Si nada se rompe al primer intento, SOSPECHA DEL TEST.»*

Se reintrodujeron los ocho bugs, uno a uno (`bash tests/Visual/mutaciones.sh`):

```
CAZADO  1. el nocturno le roba el relleno a la persona            (32 discrepancias)
CAZADO  2. el forzado se pinta igual que el que incumple          (16)
CAZADO  3. los cuatro cómputos del concepto pintan igual          (32)
CAZADO  4. las violaciones de los conceptos no se pintan          (36)
CAZADO  5. imposible y sin-candidato no se pueden ver a la vez     (1)
CAZADO  6. una baja que bloquea y una que no se pintan igual       (4)
CAZADO  7. 'no se pide a nadie' se pinta como 'sobra gente'        (2)
CAZADO  8. el servidor se calla que el concepto cruza medianoche   (6)
──────────────────────────────────────────────────────────────────
CAZADOS: 8/8    ESCAPADOS: 0/8
```

### 6.1 Y el instrumento me mintió CINCO veces antes de servir

Van cinco. Se dejan escritas porque el patrón es siempre el mismo — **el detector falla donde
no miras**:

1. **La firma visual no incluía las palabras.** Cazó 8 «gemelos» (imposible ≡ imposible+incumple)
   que no eran gemelos: los distingue la NOTA. La ley 6 dice que ningún color va solo, o sea que
   **el texto es un canal**, y lo estaba dejando fuera de la firma.
2. **La firma incluía el color de la persona.** Cada caso vive con su persona; si el color entra
   en la firma, los 96 casos son trivialmente únicos **por el color del pelo** y el test da verde
   sin haber comprobado nada. Se normaliza a `P`.
3. **Los gemelos de la tira se agrupaban por escenario, no por estado.** Denunció que
   «cerrado-con-gente» y «excess» se pintaban igual. Y es verdad — **y es correcto**: los dos
   *son* un exceso. Dos escenarios que producen el mismo estado deben pintarse igual.
4. **Buscaba la banda por subcadena**, y `no-bloquea-con-alta` **contiene** `bloquea-con-alta`.
   Medía la banda equivocada y denunciaba un fallo que no existía. Ahora va por `data-persona`.
5. **`networkidle` tiraba el instrumento con un TimeoutError**, que devuelve **el mismo código de
   salida que un hallazgo**. La contraprueba anunciaba «CAZADO» sobre un test que se había caído:
   un detector roto disfrazado de detector que funciona. Ahora `probar()` **exige que el test diga
   qué ha visto**: reventar no es cazar.

---

## 7. Lo que las tres comprobaciones NO vieron, y vieron los ojos

Los cuatro instrumentos estaban en verde, y al **abrir la página** había dos cosas mal:

1. **Las bandas de baja parecían cinta de obra.** Reutilicé la trama de la barra (3 px de raya
   cada 7). En una barra de 8 px se lee como textura; en una banda de 16 px **con texto encima**
   se lee como un tachón que se come el rótulo. Y como la baja se pinta ahora en todas las filas
   que la persona cubre, eran ocho bloques rayados gritando. → `TRAMA_BANDA`, misma gramática,
   otro volumen.

2. **Las barras con gravedad eran un borrón marrón.** Un borde de 2 px arriba y abajo de una
   barra de **8 px** deja **4 px de relleno**: el canal del borde se comía al de la identidad, que
   es justo lo que la ley 0 prohíbe. Los tests daban verde —el borde era el color correcto y el
   relleno también— y la barra era ilegible igual. → `ALTO = 10`.

**Ningún test mide «se entiende».** Por eso la página se abre. Siempre.

---

## 8. Veredicto honesto

**Lo que está probado, exhaustivamente y sobre la página:**

- Las 44 combinaciones de bloque alcanzables: caen en una regla, se pintan como dice la regla, y
  ninguna comparte píxel con otra distinta (946 pares comparados).
- Los 5 estados de la tira + el rayado del incubrible.
- Las 4 combinaciones de banda.
- Los 3 estados de cartel, incluida la doble.
- Las 8 combinaciones múltiples de §5.
- Que el instrumento caza los 8 bugs de esta tanda.

**Lo que NO está probado y solo se sabrá en producción:**

1. **Las 308 combinaciones de bloque que el modelo no permite.** No es cobertura que falte: son
   casos que no existen. Un concepto no puede ser *forzado* (no cuelga de un turno) ni tener un
   *notice* (ninguna de sus cinco reglas es informativa), y solo el de **contador aparte** puede
   incumplir. Si mañana se añade una regla informativa a los conceptos, **aparecen 8 casos nuevos
   y el test los exigirá** — la lista `ESPERADAS` está escrita a partir del modelo, no a mi gusto.

2. **La legibilidad con más de tres personas por celda.** Los seeders llegan a tres. Con seis, el
   carril se estira y el aire entre bloques podría dejar de decir la verdad sobre quién va con
   quién. No lo sé, y no voy a afirmar que sí.

3. **Los colores de persona 11 a 15 de la paleta** apenas han salido: los casos se reparten por
   `crc32` del nombre. El contraste se mide en cada pasada, pero no sobre los 15 colores.

4. **El daltonismo.** La ley 6 (ningún color va solo) es la defensa, y está probada — toda
   gravedad lleva su palabra. Pero **la trama y el filo no se han probado en escala de grises**,
   y son marcas de forma precisamente para eso.

5. **El año.** Todo esto es la semana y el día. El zoom Año tiene un **contrato de datos
   distinto** (agregados, no 30.000 turnos pintados uno a uno) y esta matriz **no le aplica**.

---

## 9. Decisiones derivadas — dime si alguna no es la que querías

Una sola, y está en `MATRIZ-VISUAL.md` §4.3:

**He leído «cuenta como trabajado» como «suma tiempo a algún contador».** Por eso
`separate_counter` (las horas extra, que tienen su propio tope) se pinta igual que `adds`, y
`reduces_required` igual que `blocks`. El payload traía `countsAsWork = (adds)`, que se quedaba
corto. Si para ti las horas extra son «otra cosa», es un cambio de una línea.
