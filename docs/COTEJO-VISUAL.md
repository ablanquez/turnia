# El cotejo del píxel

**Instrumento:** `tests/Visual/pixeles.mjs` · **Contraprueba:** `tests/Visual/mutaciones.sh`
**Paleta:** `tests/Visual/paleta.mjs` (el generador) → `app/.../PersonPalette.php`

Todo lo que sigue está medido **sobre la imagen renderizada**: se abre la página a 1366 px, se
captura, se decodifica la captura en un canvas y se extrae **el píxel del relleno**. Ni una
variable CSS.

---

## 0. Por qué existe este documento

`matriz.mjs` dio **44 firmas visuales y 0 gemelos**. Y las barras de la Semana eran
**indistinguibles a ojo**.

Las dos cosas eran ciertas. `matriz.mjs` compara los colores que el navegador **calcula** para
cada propiedad CSS, y los quince índigos de la paleta vieja eran quince colores **distintos**…
en el CSS. Para un ojo eran uno solo.

> **«Firma distinta» no es lo mismo que «se distingue».**

Es la capa 5 otra vez —*el píxel declarado no es el píxel resultante*— y esta vez peor, porque
el CSS **era correcto**. Lo que fallaba era la paleta, y ningún instrumento que lea el DOM puede
verlo.

---

## 1. Las tres vistas

| Vista | Qué se ve | Quién lleva la identidad |
|---|---|---|
| **SEMANA** | 7 columnas × 5 puestos. Barras de **10 px, sin texto dentro**. | **el relleno de la barra** |
| **DÍA** | 5 filas. Barras de **30 px con el nombre y la hora escritos dentro**. | **el avatar** (sólido, dentro de la barra) |
| **SEMANA VACÍA** | Ni un turno. Tiras rojas, indicador en rojo. | *(nadie: no hay barras)* |

### Y por qué el portador cambia — que no es una escapatoria

La ley 2 dice: *«el relleno dice de quién es: tapa los nombres de una celda y todavía tienes que
poder reconstruir quién hace qué»*. Lo que **no** dice es que tenga que ser el mismo píxel en las
dos vistas. Dice que la identidad tiene que estar **dentro de lo que se ve, y a plena voz**.

- En la **Semana**, si tapas la fila del nombre, lo único que queda es el relleno de la barra.
  **Tiene que identificar, y punto.**
- En el **Día**, la barra lleva **escrito el nombre** dentro, así que su relleno **no puede ir a
  plena tinta**: el texto dejaría de leerse (ley 6). Es un tinte, y un tinte comprime el color
  hacia el blanco. Medido: los rellenos del Día dan **ΔE00 de 7 a 18** y no bastan. Quien
  identifica ahí es el **disco de color del avatar**, que está dentro de la barra y es sólido.

`pixeles.mjs` **suspende por el portador de cada vista** y enseña el otro como dato.

---

## 2. Barra a barra, con el píxel real

### SEMANA — portador: la barra

| Persona | Declarado (CSS) | **PÍXEL REAL** | Alto | Relleno | ¿Se distingue de la más parecida? |
|---|---|---|---|---|---|
| Ana López | `rgb(20,116,138)` | **#14748A** | 10px | 8px | ⚠️ ΔE00 18.5 · Lucía |
| Bea Soler | `rgb(206,170,198)` | **#CEAAC6** | 10px | 8px | ⚠️ ΔE00 18.4 · Iker |
| Diego Mora | `rgb(110,104,198)` | **#6E68C6** | 10px | 8px | ✅ ΔE00 22.1 · Nuria |
| Iker Blanco | `rgb(230,98,174)` | **#E662AE** | 10px | 8px | ⚠️ ΔE00 18.4 · Leo |
| Leo Ferrer | `rgb(170,50,138)` | **#AA328A** | 10px | 8px | ⚠️ ΔE00 17.8 · Marco |
| Lucía Díaz | `rgb(20,146,222)` | **#1492DE** | 10px | 8px | ⚠️ ΔE00 18.4 · Nuria |
| Marco Ruiz | `rgb(92,68,96)` | **#5C4460** | 10px | 6px | ⚠️ ΔE00 17.8 · Leo |
| Nuria Peña | `rgb(158,176,240)` | **#9EB0F0** | 10px | 8px | ⚠️ ΔE00 18.4 · Lucía |
| Sara Gil | `rgb(20,194,228)` | **#14C2E4** | 10px | 6px | ⚠️ ΔE00 18.8 · Lucía |

**36 pares comparados · 0 indistinguibles (ΔE < 12) · 7 justos (< 20).**
*(Marco y Sara tienen 6 px de relleno y no 8: llevan borde de gravedad de 2 px.)*

### DÍA — portador: el avatar

**21 pares comparados · 0 indistinguibles · ΔE00 mínimo 18.4.**
El relleno de la barra, en esa vista, da un mínimo de 7.3 — **por eso no es el portador**.

### Los umbrales, y por qué

ΔE00 ≈ 2,3 es el «apenas perceptible» clásico, pero está medido con **dos parches grandes y
pegados**, en laboratorio. Aquí son barras de 10 px separadas por texto: el peor caso para el
ojo. Así que:

- **ΔE < 12** → indistinguible de un vistazo. **Suspende.**
- **ΔE < 20** → cuesta. Se avisa, no suspende.

---

## 3. Los pares INDISTINGUIBLES — el antes

Con la paleta anterior, **15 de los 45 pares** estaban por debajo del umbral:

| Par | ΔE00 | Píxeles |
|---|---|---|
| **Bea ≡ Tomás** | **0.0** | `#6A76B8` vs `#6A76B8` — *el mismo color exacto* |
| Diego ≡ Sara | 4.0 | `#9166C0` vs `#9B6FD1` |
| Diego ≡ Iker | 6.1 | `#9166C0` vs `#A06BB0` |
| Diego ≡ Marco | 6.2 | `#9166C0` vs `#7E6FB0` |
| Ana ≡ Nuria | 6.6 | `#5566B8` vs `#6478C4` |
| Iker ≡ Sara | 7.2 | | 
| Marco ≡ Sara | 8.0 | |
| Iker ≡ Marco | 8.9 | |
| Marco ≡ Nuria | 9.5 | |
| Ana ≡ Marco | 10.2 | |
| *(y 5 más)* | | |

La fila de Barra —Iker, Ana, Marco— eran **tres barras del mismo color**.

---

## 4. Las dos causas, y las dos son de raíz

### 4.1 🔴 La paleta: quince índigos con la misma luminosidad

`#7F77DD`, `#5B8DEF`, `#9B6FD1`, `#6478C4`, `#A86BB0`… **toda la paleta vivía en L\* 52–60** y
con el mismo croma. En el Día, con barras de 30 px y el nombre escrito dentro, colaba. En la
Semana, con 10 px y sin texto, no.

**Y la luminosidad es la única señal que sobrevive a 10 píxeles.** Doce tonos igual de oscuros
son un solo tono, por mucho que el matiz cambie.

**La nueva sale de un cálculo** (`tests/Visual/paleta.mjs`): muestreo de punto más lejano en el
espacio Lab, maximizando el **ΔE00 mínimo** entre cualquier par — que es la métrica que importa,
porque una paleta vale exactamente lo que valga su par más parecido.

| | Antes | Ahora |
|---|---|---|
| ΔE00 mínimo | **4.0** | **16.5** |
| Luminosidad | L\* 52 → 60 | **L\* 32 → 74** |
| Colores | 15 | **12** |

Sigue siendo **fría** por la razón de siempre: rojo, naranja, ámbar y verde son del **estado**.
Si una persona pudiera salir en rojo, el rojo dejaría de significar «imposible». El generador lo
impone: **ningún color a menos de ΔE 28 de los cinco colores de estado**.

Y son **doce y no quince a propósito**: por debajo de ese matiz el ΔE mínimo cae en picado.
*Doce colores que se distinguen valen más que quince que no.*

### 4.2 🔴 El reparto: un hash módulo N **colisiona**

`crc32(nombre) % 15`. Suena inofensivo, y es lo que hizo que **Bea y Tomás tuvieran la barra del
mismo RGB exacto**. Ninguna paleta arregla eso: por muy separados que estén los colores, si a dos
personas les toca el mismo, **son el mismo**.

Ahora **se reparte**: las personas de la empresa se ordenan por id y se les da el color `i % 12`.
Determinista, estable (no depende de qué semana mires) y **sin una sola colisión** mientras la
plantilla no pase de doce.

> A partir de doce se repiten, porque no hay doce mil colores que se distingan. **No está
> tapado**: `pixeles.mjs` lo denuncia en cuanto dos barras del mismo color caen en la misma
> vista. El día que la plantilla crezca, lo dirá el instrumento — no una queja.

### 4.3 🟡 El borde de gravedad se pintaba con la TINTA

*(Tu pregunta 3: la barra de Marco sí debía llevar borde ámbar, y lo llevaba — mal pintado.)*

Hay dos versiones de cada color de gravedad, y por una buena razón: el que **rellena** (vibrante,
para verse) y el que **escribe** (oscuro, para leerse con 4,5 de contraste). `bordeDe()` usaba
`severityColor()` — **la tinta**.

Un borde no se lee: **se ve**. Con la tinta, el ámbar del aviso de Marco salía **marrón sucio**,
y la ley 3 («ámbar = aviso») no se cumplía en la pantalla aunque se cumpliera en el código.

Es **mi propia regla aplicada al revés** — *«el color que rellena y el color que escribe no
pueden ser el mismo»*. Tengo las dos versiones desde hace dos tandas y usé la que no era.

### 4.4 🟠 La banda de baja seguía siendo un tachón

Segundo intento. La raya de 2 px cada 8 al 16 % seguía compitiendo con el `Ana López · Baja
médica` que lleva encima. **Una banda no es una barra: es un rótulo, y en un rótulo el texto
manda.** Ahora es una raya de 1,5 px cada 8 al 11 %: se ve como textura, no como tachado.

---

## 5. Semana vs Día: ¿se cumple la ley igual?

```
semana   portador: barra     ΔE00 mínimo entre personas: 17.8   ✅ la ley 2 se cumple
dia      portador: avatar    ΔE00 mínimo entre personas: 18.4   ✅ la ley 2 se cumple
vacia    (ni una barra: nada que comparar — y eso NO es un aprobado)
```

---

## 6. El instrumento me mintió TRES veces más (van doce)

Y las tres **denunciaban fallos que no existían, tapando los que sí**. Se dejan escritas porque
el patrón es siempre el mismo: *el detector falla donde no miras*.

1. **Muestreaba fuera del viewport.** Cuatro personas dieron píxel `#000000` y ΔE **0,0** entre
   ellas — «indistinguibles». Sus barras estaban **por debajo del pliegue** y yo medía el vacío.
   *(Un negro inventado se parece muchísimo a otro negro inventado.)*
2. **Muestreaba el centro de la barra… donde está el texto.** En el Día, el centro de la barra de
   Bea cae encima de la palabra «Bea Soler». Su malva (`#CEAAC6`) salía como un azul grisáceo
   (`#BBD5E3`), y «todos los rellenos del Día se parecían» — se parecían **las letras**.
3. **Muestreaba el centro del avatar… donde están las iniciales.** Y la esquina que elegí después
   era justo donde va **el punto ámbar de «trabaja en otra empresa»**: el avatar de Marco (ciruela
   oscuro) me salía **naranja**.

**El guardia que lo cierra:** si un elemento es opaco, el píxel medido tiene que parecerse al
color declarado. Si no se parece, **el que está mal es el instrumento**, y suspende él. Las tres
mentiras las habría cazado solo.

Y una cuarta, en el arnés de mutaciones:

4. **Una mutación que no se aplica informa «ESCAPADO»** — tan engañoso como cantar «CAZADO» sobre
   un test que reventó. (Cambié esas líneas y los `sed` dejaron de encajar; los ficheros llevan
   CRLF.) Ahora `verificar()` comprueba que **el fichero ha cambiado de verdad** antes de creerse
   nada, y distingue tres estados: **CAZADO · ESCAPADO · NO PROBADA**.

5. **El login tenía una carrera.** Con `domcontentloaded` el HTML está pero **Vue no ha
   hidratado**: el clic cae en un formulario que aún no escucha y el test se queda en `/login`
   hasta el timeout. Y un `TimeoutError` devuelve el mismo código de salida que un hallazgo — la
   contraprueba cantaba «REVENTÓ» y me puse a buscar un bug en la banda de las bajas **que no
   existía**.

---

## 7. La contraprueba

`bash tests/Visual/mutaciones.sh` — los once bugs reintroducidos a propósito:

```
CAZADO   1. el nocturno le roba el relleno a la persona           (32, matriz.mjs)
CAZADO   2. el forzado se pinta igual que el que incumple         (16, matriz.mjs)
CAZADO   3. los cuatro cómputos del concepto pintan igual         (32, matriz.mjs)
CAZADO   4. las violaciones de los conceptos no se pintan         (36, matriz.mjs)
CAZADO   5. imposible y sin-candidato no se pueden ver a la vez    (1, matriz.mjs)
CAZADO   6. una baja que bloquea y una que no se pintan igual      (4, matriz.mjs)
CAZADO   7. 'no se pide a nadie' se pinta como 'sobra gente'       (2, matriz.mjs)
CAZADO   8. el servidor se calla que un bloque cruza medianoche   (22, matriz.mjs)
CAZADO   9. el borde de gravedad se pinta con la tinta            (62, matriz.mjs)

  ── y estas dos, SOLO las ve pixeles.mjs ──
CAZADO  10. la paleta vieja (quince índigos)                      (36, pixeles.mjs)
            → «Bea Soler» ≡ «Nuria Peña» — ΔE00 2.7
CAZADO  11. el color se sortea (hash) y colisiona                 (17, pixeles.mjs)
            → «Ana López» ≡ «Bea Soler» — ΔE00 0.0
──────────────────────────────────────────────────────────────────────
CAZADOS: 11    ESCAPADOS: 0    NO PROBADAS: 0
```

**Las mutaciones 10 y 11 son las que justifican que `pixeles.mjs` exista:** con la paleta vieja,
`matriz.mjs` **pasa** — 44 firmas, 0 gemelos — mientras el ojo no distingue nada.

---

## 8. Veredicto honesto

**Lo que está probado, sobre la imagen:**

- Semana: **0 pares indistinguibles** de 36 (ΔE mínimo 17,8).
- Día: **0 pares indistinguibles** de 21 (ΔE mínimo 18,4).
- La ley 2 se cumple **en las dos vistas**, por el elemento que lleva la identidad en cada una.
- La ley 3 se cumple **en la pantalla** y no solo en el CSS: el ámbar se ve ámbar.
- El instrumento caza los 11 bugs, incluidos los 2 que `matriz.mjs` es incapaz de ver.

**Lo que NO está probado, y solo se sabrá en producción:**

1. **Plantillas de más de 12 personas.** Los colores se repiten a partir del doce. `pixeles.mjs`
   lo denunciará el día que dos barras del mismo color coincidan en una vista, pero **hoy no está
   probado** porque la demo tiene diez. Está en `PENDIENTES.md`.
2. **7 pares de la Semana quedan en la banda «cuesta»** (ΔE 17,8–19,3). Por encima del umbral,
   pero no con holgura. Doce colores separados de verdad **no caben** en la zona fría con más
   margen: subirlo obligaría a meter neones o a invadir el rojo/naranja del estado. Es un techo
   del diseño, no un descuido.
3. **El daltonismo.** La ley 6 (ningún color va solo) es la defensa y está probada: toda gravedad
   lleva su palabra. Pero **la paleta de personas no se ha probado en escala de grises**, y ahí la
   diferencia de luminosidad (L\* 32→74) es lo único que quedaría. Debería aguantar. **No lo he
   medido.**
4. **Otras resoluciones.** Todo esto es 1366 px. A 1920 las columnas se ensanchan y las barras
   son más largas — solo puede mejorar. **No lo he medido.**

**¿Queda alguna ley incumplida en alguna vista?** No, de las que se pueden medir. Y las que no se
pueden medir —«¿se entiende?»— siguen necesitando lo mismo de siempre: **abrir la página**.
