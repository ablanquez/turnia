# El responsive de escritorio

**Instrumentos:** [`tests/Visual/resoluciones.mjs`](../tests/Visual/resoluciones.mjs) (las 16
combinaciones + la bisección) · [`tests/Visual/anchos.mjs`](../tests/Visual/anchos.mjs) (el peor
caso geométrico) · [`tests/Visual/lupa.mjs`](../tests/Visual/lupa.mjs) (para mirar)

Todo medido **sobre la página real**, abierta en Chromium a cada tamaño exacto, y **sobre la
imagen renderizada** — ni una variable CSS.

---

## 0. La decisión de fondo

> El que gestiona usa ordenador. El que consulta usa móvil. **Son dos vistas distintas, no una que
> se encoge.**

Esta tanda es **el espectro de escritorio**. La vista móvil del empleado es otra tanda y no se ha
tocado.

---

## 1. La tabla: 8 resoluciones × panel plegado/desplegado

| resolución | panel | ¿cabe la semana? | columna | barra | ΔE personas | ΔE a otra gravedad | trunca | página |
|---|---|---|---|---|---|---|---|---|
| 1280×720 | plegado | ✅ entera | 156 | 31×16 | ✅ 19,6 | ✅ 23,7 | · | ✅ |
| 1280×720 | desplegado | ❌ faltan 138 px | 150 | 29×16 | ✅ 19,6 | ✅ 23,5 | · | ✅ |
| 1366×768 | plegado | ✅ entera | 168 | 34×16 | ✅ 19,6 | ✅ 23,7 | · | ✅ |
| 1366×768 | desplegado | ❌ faltan 52 px | 150 | 29×16 | ✅ 19,6 | ✅ 23,5 | · | ✅ |
| 1440×900 | plegado | ✅ entera | 179 | 37×16 | ✅ 14,0 | ✅ 23,7 | · | ✅ |
| 1440×900 | desplegado | ✅ entera | 153 | 30×16 | ✅ 18,3 | ✅ 23,7 | · | ✅ |
| 1536×864 | plegado | ✅ entera | 193 | 41×16 | ✅ 18,3 | ✅ 24,3 | · | ✅ |
| 1536×864 | desplegado | ✅ entera | 167 | 34×16 | ✅ 18,3 | ✅ 23,7 | · | ✅ |
| **1920×1080** | plegado | ✅ entera | 247 | 56×16 | ✅ 14,0 | ✅ 23,9 | · | ✅ |
| **1920×1080** | desplegado | ✅ entera | 222 | 49×16 | ✅ 14,0 | ✅ 24,0 | · | ✅ |
| 2560×1440 | plegado | ✅ entera | 339 | 80×16 | ✅ 14,0 | ✅ 24,0 | · | ✅ |
| 2560×1440 | desplegado | ✅ entera | 313 | 73×16 | ✅ 14,0 | ✅ 24,4 | · | ✅ |
| 1366×600 | plegado | ✅ entera | 168 | 34×16 | ✅ 23,6 | ✅ 23,7 | · | ✅ |
| 1366×600 | desplegado | ❌ faltan 52 px | 150 | 29×16 | ✅ 23,6 | ✅ 23,5 | · | ✅ |
| 960×1080 | plegado | ❌ faltan 278 px | 150 | 29×16 | ✅ 14,0 | ✅ 23,5 | · | ✅ |
| 960×1080 | desplegado | ❌ faltan 458 px | 150 | 29×16 | ✅ 14,0 | ✅ 23,5 | · | ✅ |

*ΔE personas: umbral 12 (indistinguibles). ΔE a otra gravedad: umbral 20. Los dos, sobre la
imagen. «Página» = ¿desborda el documento? Que la **parrilla** scrollee es su trabajo; que
desborde la **página**, no.*

**En las 16: nada truncado, ningún cartel fuera de su celda, la página no desborda nunca, y la
matriz visual se cumple.**

---

## 2. Los umbrales, AL PÍXEL

No interpolados entre dos fotos: **buscados por bisección**, con las dos puntas comprobadas (si el
extremo «malo» no está mal, la bisección no busca nada y lo dice).

| | |
|---|---|
| La semana entera cabe, panel **recogido** | **desde 1238 px** |
| La semana entera cabe, panel **abierto** | **desde 1418 px** |
| El aviso de «no cabe» aparece | **por debajo de 1240 px** |
| Algo se **sale** de la ventana | solo por debajo de **654 px** |

Y ese 1238 no es magia: es una suma que se puede seguir con el dedo.

```
  32   el aire de la página (p-4 a cada lado)
   4   el borde de la tarjeta
 112   el raíl de los puestos ("Sumiller" en negrita, con su aire)
1050   los siete días, a 150 px de mínimo cada uno
  40   el panel de plantilla RECOGIDO
────
1238   →  MIN_SEMANA = 1240
```

`MIN_SEMANA` vive en [`useAncho.js`](../resources/js/composables/useAncho.js) **y el test lo lee de
ahí** — no se guarda su propia copia. Ley 13: el día que la parrilla cambie de mínimo, un test con
la constante vieja daría verde sobre una promesa que ya no se cumple.

---

## 3. Las decisiones, y su porqué

### 3.1 Los tres números que se han movido

| | antes | ahora | por qué |
|---|---|---|---|
| Raíl de puestos | 124 px | **112 px** | «Sumiller» en negrita mide 62 px; 112 sobra |
| Columna mínima | 160 px | **150 px** | es lo que hace que 1280 quepa |
| Panel de plantilla | 264 px | **220 px** | es lo que hace que 1440 quepa **con el panel abierto** |

Dos promesas, y las dos con holgura: **1280 con el panel recogido** y **1440 con el panel
abierto**.

### 3.2 Por debajo de 1240: se desplaza, y SE DICE

La parrilla sigue funcionando —**no oculta ni recorta nada** (ley 10)— pero se pierde lo único que
una vista de *semana* sabe hacer: verla entera de un vistazo.

Así que sale un aviso: *«La semana entera no cabe en esta ventana. Faltan **280 px** para ver los
siete días a la vez. No se oculta nada: la parrilla se desplaza a lo ancho.»* Con el número exacto,
y con un botón al **zoom Día**, que sí funciona en estrecho.

> ⚠️ **Y NO BLOQUEA.** Un cartel que tapara la parrilla sería peor que el problema: el encargado que
> solo tiene esa pantalla se quedaría sin cuadrante. Avisa, ofrece la salida buena, y se aparta.
>
> Y **el silencio no significa «todo bien» tampoco aquí**: quien ve tres días y medio tiene que
> saber que le faltan cuatro. Deducirlo de que hay una barra de scroll es pedirle que adivine.

**No se avisa cuando lo que no deja sitio es el panel abierto**: eso lo ha decidido el usuario y
tiene el botón ahí mismo para deshacerlo. Se avisa cuando **ni siquiera con el panel recogido**
cabría — que es cuando el problema es la ventana. El instrumento comprueba las dos cosas: que el
aviso salga cuando debe (si no, es un **silencio falso**) y que **no** salga cuando no debe (si no,
es un **aviso falso**, y se aprende a ignorarlo).

### 3.3 En pantallas grandes NO se capa el ancho, y es a propósito

A 2560 px la columna llega a 339 px y la barra a 80. Y **eso no es aire desperdiciado: es
resolución temporal.** Esto no es un texto, es una **línea de tiempo**: cada píxel de ancho extra es
precisión en el eje X —dónde empieza un turno, dónde está el hueco de cobertura, cuánto solapan dos
barras—. Es exactamente lo que el zoom Día hace a propósito.

Capar el ancho dejaría dos márgenes vacíos a cambio de **empeorar el dato**. No se hace.

### 3.4 La ventana baja (1366×600)

La parrilla y el panel conservan cada uno **su scroll interno** y la página no desborda. Verificado
otra vez, con todo lo nuevo (`comprobar.mjs` + el barrido).

---

## 4. ⚠️ La matriz visual SÍ se rompía. Y no por la resolución: por la DURACIÓN de un turno.

Ésta es la parte importante de la tanda, y salió de aplicar lo que se pidió: *no generalices, la
geometría cambia con el ancho*.

El anillo de gravedad era un `outline`: **rodeaba la barra por los cuatro lados**. Su peso —lo que
el ojo integra— es

```
1 − (ancho × alto) / ((ancho + 2w) × (alto + 2w))
```

y eso **depende del ANCHO de la barra**. Medido sobre la imagen:

| barra | el anillo pesa | el peor color queda a |
|---|---|---|
| 50 px (turno de 8 h) | 35 % | ΔE **20,1** ✅ |
| 29 px (6 h) | 40 % | ΔE **17,5** ❌ |
| 10 px (2 h) | 55 % | ΔE **8,7** ❌ |
| 5 px (**1 h**) | **67 %** | ΔE **5,8** ❌ |

**Un turno de una hora con un aviso ámbar se veía MARRÓN.** El bug de Marco, reencarnado — y esta
vez la culpa no era del color, sino de que **el canal cambiaba de peso con la geometría**.

Y la paleta estaba generada con **un ancho fijo de 50 px** metido en el modelo. O sea: **solo era
cierta a ese ancho exacto.**

### El caso no estaba sembrado en ninguna parte

La demo usa turnos de 8 h. Los 96 casos del cuadrante de la matriz usan turnos de 8 h. **El peor
caso geométrico de la aplicación no existía en ningún sitio**, y por eso ningún instrumento lo había
mirado nunca. Ahora se siembra la rampa entera (1, 2, 3, 4, 6 y 8 horas × las tres gravedades) y la
mide [`anchos.mjs`](../tests/Visual/anchos.mjs).

### La solución no fue otra paleta: fue que el anillo deje de rodear

**Dos franjas, arriba y abajo**, por fuera de la barra (`box-shadow`, que no come relleno). Su peso
es `2w / (alto + 2w)` y **NO depende del ancho**: 20 % / 27 % / 33 %, siempre.

**El problema desaparece por construcción, no por ajuste.** Y contamina *menos* que el anillo que
rodeaba, incluso en las barras anchas. Visualmente sigue leyéndose como un anillo, porque el
redondeo de la barra cierra los lados.

Resultado, medido en toda la rampa a 1280 px (el mínimo, donde las barras son más estrechas):

```
barra de  5 px (1 h) → ΔE 23,7 a la gravedad ajena más cercana   ✅
barra de 10 px (2 h) → ΔE 24,2   ✅
barra de 29 px (6 h) → ΔE 24,0   ✅
barra de 38 px (8 h) → ΔE 24,3   ✅
```

Y la paleta se ha regenerado con el modelo bueno **y con colchón** (el generador exige 24 para que
la imagen dé ≥ 20; un generador que apunta al aprobado, suspende):

- ΔE00 mínimo **entre personas**: 13,8
- Lo más cerca que queda una barra de una **gravedad ajena**: **24,1 — a cualquier ancho**

---

## 5. Lo demás que se ha arreglado

**El indicador de la cabecera se cortaba a 960 px.** *«5 turnos con incidencias · 4 tramos sin
cubrir · 1 aviso de catálogo»* llevaba `whitespace-nowrap`: no truncaba, **se salía**, y la cabecera
(con `overflow-hidden`) lo cortaba en seco. Se leía *«…1 aviso de»*. **El dato más importante de la
pantalla, cortado, y sin que ningún test dijera nada** — porque todos buscaban `scrollWidth >
clientWidth`, y esto no era un truncado: era una fuga. Ahora envuelve, y el barrido lo comprueba.

**El panel truncaba los nombres.** `truncate` en la tarjeta de plantilla. Ley 10, otra vez. Ahora
envuelve.

---

## 6. El instrumento mintió otra vez. Van dieciséis.

**«Dentro de la ventana» no es «se ve».** A 1280 px con el panel abierto, las barras del sábado y el
domingo caen dentro de la ventana según su `getBoundingClientRect()` —y es verdad, ahí están sus
coordenadas— pero **no se ven**: están recortadas por el `overflow` de la parrilla y **tapadas por
el panel**. El píxel que salía era **el blanco del panel**.

Y como el blanco es igual al blanco, dos personas distintas daban **ΔE 0,0** y el instrumento cantó
**«LA MATRIZ SE ROMPE»** sobre una página impecable. En una resolución que yo aún no había mirado —
o sea, me habría puesto a arreglar algo que no existe.

`elementFromPoint` es la única pregunta honesta: **«¿QUIÉN está pintado en este píxel?»**. Y ni
siquiera basta: **no sabe de barras de scroll**. Cuando a la parrilla le faltaban 8 px, aparecía una
barra de scroll horizontal que se comía los últimos 15 px de alto y tapaba el avatar de Bea. Ahora
se comprueba también el área de cliente (`clientWidth`/`clientHeight`, que **excluyen** la barra) de
todos los contenedores con scroll.

**Y el guardia habría cazado las dos.** `pixeles.mjs` lo tiene desde hace dos tandas —*si el píxel
medido no cuadra con el color declarado, el que suspende es el instrumento*— y el barrido nuevo
nació sin él. Ahora lo lleva. **Los instrumentos no se sustituyen: se acumulan.**

---

## 7. La contraprueba

**16 bugs reintroducidos, 16 cazados, 0 escapados.** Y el nuevo:

| # | bug | lo caza |
|---|---|---|
| **12c** | **el anillo vuelve a RODEAR** (y en un turno de 1 h se come la barra) | **`anchos.mjs`, y SOLO él** |

`matriz.mjs` **pasa** con el anillo que rodea (los 96 casos son de 8 h). `pixeles.mjs` **pasa**.
`resoluciones.mjs` **pasa**. Solo lo ve el instrumento que siembra el peor caso.

---

## 8. Veredicto honesto

### El mínimo, sin adornos

- **≥ 1280 px, panel recogido → la semana entera.** Es la resolución de escritorio más pequeña que
  existe hoy, y cabe con 42 px de sobra.
- **≥ 1418 px → la semana entera con el panel abierto.**
- **< 1240 px → la parrilla se desplaza, no oculta nada, y lo dice** con el número exacto de píxeles
  que faltan y un botón al zoom Día.
- **No hay un ancho por debajo del cual la parrilla deje de servir**, porque nada se recorta: se
  desplaza. Lo que se pierde es la lectura de un vistazo, y eso está avisado.

### Lo que NO está probado

- **Solo Chromium.** Firefox y Safari no se han abierto. `box-shadow` sin desenfoque y el
  `grid-template-columns` con `minmax` son estándar de sobra, pero *«estándar»* no es *«medido»*.
- **Solo `deviceScaleFactor: 1`.** Una pantalla Retina (DPR 2) renderiza el antialiasing distinto, y
  **el antialiasing es exactamente lo que separa el modelo de la imagen** en toda esta matriz. Es el
  hueco más grande que queda.
- **El zoom del navegador** (Ctrl+±) cambia el `innerWidth` efectivo. Debería comportarse como un
  cambio de ancho —y por tanto estar cubierto— pero **no se ha probado**.
- **La altura solo en 600, 720, 864, 900, 1080 y 1440.** No se ha biseccionado el alto: no hay
  ningún umbral vertical conocido (todo scrollea por dentro), pero **no lo he buscado**.
- **Plantillas de más de doce personas.** Sigue en `PENDIENTES.md`.
