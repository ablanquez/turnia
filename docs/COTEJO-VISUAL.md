# El cotejo del píxel

**Instrumento:** `tests/Visual/pixeles.mjs` · **Contraprueba:** `tests/Visual/mutaciones.sh`
**Paleta:** `tests/Visual/paleta.mjs` (el generador) → `app/.../PersonPalette.php`

Todo lo que sigue está medido **sobre la imagen renderizada**: se abre la página a 1366 px, se
captura, se decodifica la captura en un canvas dentro del propio Chromium y se muestrea el píxel.
Distancia perceptual **CIEDE2000 (ΔE00)**, la fórmula entera. **Ni una variable CSS.**

---

## 0. Por qué existe este documento

`matriz.mjs` dio **44 firmas visuales y 0 gemelos**. Y las barras de la Semana eran
**indistinguibles a ojo**. *«Firma distinta»* no es lo mismo que *«se distingue»*.

Y ahora, una vuelta más de la misma tuerca: **una barra puede tener el color correcto y aun así
estar diciendo una mentira, porque lo que lleva pegado al lado la cambia.**

---

## 1. El diagnóstico: la paleta NO era la culpable

Se pidió medir el ΔE entre cada color de persona y los colores semánticos. Se midió. **Los doce
pasan, con holgura** — el peor a 28,8, y el umbral está en 20.

**Ningún relleno declarado suena a un estado.** Entonces, ¿por qué la barra de Marco se veía
marrón?

### Porque el borde de gravedad iba DENTRO de la barra

Una barra de la Semana medía 10 px, y un borde de 2 px arriba y 2 abajo es el **40 % de la barra**.
El ojo no ve dos canales: ve **una mezcla**.

| barra de 10 px | color que sale | suena a |
|---|---|---|
| Marco `#5C4460` + borde **ámbar** | **`#855F3E`** | tinta de aviso · **ΔE 10,1** — marrón |
| Iker `#14748A` + borde **ámbar** | **`#5A7C57`** | **verde de COBERTURA · ΔE 10,2** |
| Marco `#5C4460` + borde **naranja** | `#944C3E` | tinta de imposible · ΔE 11,1 |

La segunda fila es la que da miedo, y **no la había visto nadie**: una barra **con un aviso** se
veía del color que esta app usa para decir **«todo bien»**.

Y la mezcla se alejaba **ΔE 20–31 del color de la persona**: el borde también se estaba comiendo la
ley 2. **Subir de 8 a 10 px fue un parche.**

---

## 2. Hacían falta DOS arreglos, y ninguno de los dos bastaba solo

Esta es la tabla que decidió la tanda:

| | gravedad como **borde** (dentro) | gravedad como **anillo** (fuera) |
|---|---|---|
| **paleta de croma ≥ 20** | **−18,4** ❌ | **−2,3** ❌ |
| **paleta de croma ≥ 30** | **−14,1** ❌ | **+2,6** ✅ |

*margen* = ΔE(barra vista, gravedad **ajena** más cercana) − ΔE(barra vista, color de su persona).
**Negativo = la barra se parece más a una gravedad que NO tiene que a la persona de quien es.**

- **Solo sacar el borde fuera** → la paleta vieja **sigue mintiendo** (−2,3). `#5C4460` es un
  ciruela apagado de **croma 22**, y un color de croma bajo **no tiene identidad propia: adopta la
  del vecino**.
- **Solo arreglar la paleta** → el borde **sigue comiéndose el 40 %** de la barra (−14,1).

### Y un tercer número, que manda sobre los otros dos

El anillo pesa `2w / (ALTO + 2w)` de lo que el ojo integra. **El alto de la barra decide cuánto
puede contaminar la gravedad:**

| alto de la barra | margen exigido | ΔE00 mínimo **entre personas** |
|---|---|---|
| 10 px | ≥ 8 | 13,9 — *el umbral de «indistinguible» está en 12* |
| **12 px** | **≥ 8** | **15,5** ✅ |

Dos píxeles más de barra le quitan peso al anillo, y **ese peso vuelve entero a la identidad**. La
misma pelea de siempre —dos preguntas por el mismo sitio— resuelta **dándoles más sitio**.

---

## 3. Qué se ha cambiado

1. **La gravedad sale de la barra.** Era `border` (dentro); ahora es `outline` (fuera). El relleno
   conserva sus **12 px enteros** de persona. Dos preguntas, dos espacios: la ley 0 literal.
2. **El grosor del anillo sube con la gravedad** — aviso 1,5 · incumplimiento 2 · **imposible 3**.
   La barra de Tomás era *azul con una textura rara*; ahora es una **cápsula roja con el color de
   Tomás dentro**. Se lee la alarma **y** se lee de quién es. Antes había que elegir.
3. **La paleta se recalcula con el criterio correcto.** Ya no basta con «estar lejos de un color de
   estado» —eso mide dos parches aislados, y en una parrilla nada está aislado—: ahora se exige que
   **la barra CON su anillo** siga pareciéndose más a su persona que a cualquier gravedad ajena.
   Eso obliga a **croma ≥ 30** y deja fuera la zona de barro **por construcción**.
4. **La barra sube a 12 px**, y el hueco entre sub-carriles a 7 (el anillo del imposible mide 3:
   sin ese aire, los anillos de dos barras que se pisan se tocarían y parecerían uno solo).
5. **Los carteles se unifican** (ley 14): rojo · naranja · gris, apilados, cada uno con su motivo.

---

## 4. El cotejo, sobre la imagen

### 4.1 Cada color de la paleta, contra los ocho semánticos

Se agrupa **por color, no por persona** — y ese cambio es lo que caza la paleta mala (§6).

```
COLOR      PÍXEL MEDIDO   QUIÉN LO LLEVA    ESTADO MÁS CERCANO           ΔE00
#14507E    #14507E        K009 Caso         tinta de aviso               ✅ 42.6
#1486A2    #1486A2        Diego Mora        verde · cobertura correcta   ✅ 34.5
#148CF0    #148CF0        Leo Ferrer        rojo · hueco de cobertura    ✅ 50.0
#14C8D2    #14C8D2        Iker Blanco       verde · cobertura correcta   ✅ 34.9
#1AB6F0    #1AB6F0        K010 Caso         verde · cobertura correcta   ✅ 46.9
#504478    #504478        Bea Soler         tinta de imposible           ✅ 35.8
#5C68CC    #5C68CC        Ana López         rojo · imposible             ✅ 42.6
#981472    #981472        Nuria Peña        tinta de imposible           ✅ 28.8
#98B6F0    #98B6F0        Sara Gil          naranja · incumplimiento     ✅ 46.9
#B662C0    #B662C0        Lucía Díaz        rojo · hueco de cobertura    ✅ 34.8
#C29EF0    #C29EF0        K011 Caso         rojo · hueco de cobertura    ✅ 42.1
#E69EC0    #E69EC0        Marco Ruiz        rojo · hueco de cobertura    ✅ 33.3
```

**Píxel medido = color declarado, exactamente.** Ésa es la prueba de que el anillo **no toca el
relleno**.

### 4.2 La barra ENTERA, con su anillo pegado — que es lo que el ojo integra

**26 parejas (color, gravedad) medidas de 36 posibles. Margen peor: +2,8.** Todas positivas.

```
COLOR      GRAVEDAD    BARRA VISTA  OTRA GRAVEDAD MÁS CERCANA   ΔE     A SU COLOR  MARGEN
#1486A2    impossible  #6C6877      tinta de incumplimiento     30.7   27.8        ✅ +2.8
#98B6F0    impossible  #A77494      tinta de incumplimiento     33.4   29.4        ✅ +4.0
#14507E    impossible  #64415A      tinta de incumplimiento     31.2   26.8        ✅ +4.4
#14C8D2    impossible  #6B858D      verde · cobertura correcta  27.7   22.8        ✅ +4.9
#1AB6F0    impossible  #6B7290      verde · cobertura correcta  36.1   29.2        ✅ +6.9
#504478    impossible  #8C4660      tinta de incumplimiento     26.9   19.4        ✅ +7.5
#E69EC0    breach      #E78B89      rojo · hueco de cobertura   22.0   14.2        ✅ +7.8
#98B6F0    breach      #B49BA8      rojo · hueco de cobertura   31.9   22.4        ✅ +9.5
   … (17 más, de +9,8 a +32,0)
#E69EC0    notice      #E09EA5      naranja · incumplimiento    27.3    8.5        ✅ +18.8
```

La última fila es **la de Marco**, la que empezó todo esto. Su margen era **−18,4**; ahora es
**+18,8**.

**Diez parejas no han salido en pantalla, y el instrumento LAS DICE** (`#14C8D2+notice`,
`#1486A2+breach`, `#5C68CC+notice`…). No están mal: es que no se han probado. Un hueco declarado no
aprueba; **un hueco callado, sí** — y eso es lo que este instrumento ya no hace.

### 4.3 ¿Se distingue cada persona de las demás?

```
semana   portador: barra     ΔE00 mínimo entre personas: 16.2   ✅   36 pares · 0 indistinguibles
dia      portador: avatar    ΔE00 mínimo entre personas: 16.2   ✅   21 pares · 0 indistinguibles
```

**Cero pares indistinguibles** (umbral: ΔE < 12). Cinco pares en la banda de «cuesta» (< 20), el
peor a 16,2 — Leo `#148CF0` y Sara `#98B6F0`, dos azules de luminosidad distinta.

**Baja de 17,8 a 16,2** respecto a la ronda anterior, y es un precio que se paga a conciencia: dos
personas que cuesta distinguir **se resuelven leyendo el nombre**; una barra que dice
«incumplimiento» sin incumplir **no se resuelve con nada**.

### 4.4 Semana vs Día: ¿se cumple la ley igual en las dos?

Sí, **y la lleva un elemento distinto en cada una** — que no es una escapatoria, es la ley:

- **SEMANA** → la **barra**. Mide 12 px y está vacía: si tapas el nombre, lo único que queda es el
  relleno. ΔE mínimo **16,2**.
- **DÍA** → el **avatar**, sólido, a 20 px y **dentro** de la barra. Aquí la barra lleva **escrito**
  el nombre y la hora, así que su relleno es un **tinte** (a plena tinta el texto no se leería, ley
  6). Medido: el relleno del Día da ΔE mínimo **8,3** y **no basta**; el avatar da **16,2**.

La identidad está siempre dentro de lo que se ve, y siempre a plena voz. **El portador cambia; la
ley, no.**

---

## 5. La pregunta 3: sí, el aviso de Marco debía llevar borde. Y lo llevaba.

Estaba pintado con **la tinta** de la gravedad (`#7D5606`) en vez de con **el relleno** (`#C2870A`).
La tinta es oscura **a propósito** —está calculada para *leerse* como letra con 4,5 de contraste—, y
un borde **no se lee: se ve**. Salía marrón sucio.

Es **mi propia regla aplicada al revés** («el color que rellena y el color que escribe no pueden ser
el mismo»): tengo las dos versiones desde hace tres tandas y usé la que no era.

---

## 6. El instrumento mintió tres veces más. Van catorce.

**12. Descartaba las barras TRAMADAS.** Se excluían de la mediana de identidad **con razón** —llevan
la trama encima del color, y mezclarlas con las lisas produce un color que no es de ninguna de las
dos—. Pero el `continue` las borraba del fichero **entero**. Resultado: **la barra IMPOSIBLE —que es
tramada, y la que lleva el anillo más gordo, o sea la que más puede contaminarse— no se medía en
NINGUNA comprobación.** Verde sobre el caso que más lo necesitaba, y sin decir que se lo saltaba.
*Un descarte silencioso es un aprobado por omisión.*

**13. Medía las parejas que la demo enseña POR CASUALIDAD.** Tres barras con anillo (Marco un aviso,
Sara un incumplimiento, Tomás un imposible) sobre doce colores. Al reintroducir a propósito la
paleta de croma bajo, el instrumento **la dejó pasar** — no porque el color fuera bueno, sino porque
al ciruela le había tocado una persona sin gravedad. **Cobertura por suerte no es cobertura.** Se
arregló midiendo también el **cuadrante de la matriz** (96 casos, todas las gravedades, todos los
colores): ahora se cazan **26 parejas** y **se dicen las 10 que faltan**.

**14. Leía el relleno de un bloque HUECO como si fuera negro.** Un concepto que ni cubre ni cuenta
se pinta `transparent`, y el navegador devuelve `rgba(0, 0, 0, 0)`. Yo le arrancaba los tres
primeros números y me quedaba con **`#000000`**: un color que no está en la paleta, que no es de
nadie. Denunciaba un margen de **−33** sobre una barra **que no tiene relleno que contaminar**.

**Y una cuarta, en el propio informe:** el cuadrante de la matriz se coló en la tabla final, cantó
*«ΔE 0,0 · la ley 2 NO se cumple»* (obvio: 96 personas para 12 colores) **y el resumen de abajo
seguía diciendo ✅**. El instrumento contradiciéndose a sí mismo en la misma pantalla. **Un informe
que se desmiente solo no se lee: se ignora.**

### Y la pregunta también estaba mal planteada

«¿Esta barra se parece a un estado?» es la pregunta **equivocada** para una barra imposible: **se
parece a un rojo, y tiene que parecerse**. Un instrumento que la suspendiera por eso estaría
exigiendo que la alarma no suene.

La pregunta buena es la que hiciste tú con los ojos:

> **Una barra nunca puede parecerse a una gravedad que NO es la suya más que a la persona de quien
> es.**

Con el borde dentro, la barra de Marco (que tiene un **aviso**) se veía `#855F3E`: a ΔE 11 de la
tinta de **imposible** y a ΔE 28 del propio Marco. **Se parecía a un imposible casi tres veces más
que a sí mismo.** Eso es lo que hay que cazar, y ahora se caza.

---

## 7. La contraprueba: 14 bugs reintroducidos, 14 cazados

```
CAZADOS: 14    ESCAPADOS: 0    NO PROBADAS: 0
```

| # | bug | lo caza |
|---|---|---|
| 1–9 | los nueve de las tandas anteriores | `matriz.mjs` |
| 10 | el incumplimiento pierde su cartel | `matriz.mjs` |
| 11 | el incumplimiento **ya forzado** también grita | `matriz.mjs` |
| **12** | **la gravedad vuelve DENTRO de la barra** | **`pixeles.mjs`** |
| **13** | **la paleta de croma bajo** (el ciruela que se vuelve marrón) | **`pixeles.mjs`** |
| **14** | el color se sortea (hash) y colisiona | **`pixeles.mjs`** |

Las tres últimas **solo las ve `pixeles.mjs`**, y ése es exactamente el argumento de su existencia:
con el borde dentro y la paleta vieja, `matriz.mjs` **pasa** —44 firmas, 0 gemelos, cada propiedad
CSS con el valor correcto— mientras el ojo ve una barra marrón que dice una gravedad falsa.
**«Declarado bien» no es lo mismo que «se ve bien».**

Y la 13 se caza ahora por un color **distinto** del que la provocó (`#14748A` teal + imposible, no
el ciruela de Marco): la prueba de que ampliar la cobertura al cuadrante de la matriz sirvió.

---

## 8. El anillo del incumplimiento, y por qué el modelo mentía a mi favor

> «El imposible SÍ se ve (le pusiste 3 px). El incumplimiento se queda corto.»

Cierto. Y subirlo **no era gratis**: cada píxel de anillo se lo quita al relleno. Con la barra de
12 px, el naranja a 3 px mandaba el margen a **−2,4**. Se recalculó la paleta con anillos gordos y
barra de 12: **ΔE mínimo entre personas 11,8** — por debajo del umbral de indistinguible. **Doce
colores no caben.**

La salida no era otro color: era **otra vez el alto de la barra**. `8 → 10 → 12 → 16`.

### Pero al medir sobre la imagen, dos barras fallaron. Con el modelo en verde.

El generador decía «margen mínimo +8,2» y la imagen decía **−7,3** y **−1,0**. **Tres errores de
modelo, y los tres me mentían a favor:**

**1. El anillo solo estaba arriba y abajo.** El modelo lo pesaba como `2w / (ALTO + 2w)`. **Falso:
un `outline` rodea la barra por LOS CUATRO LADOS.** En una barra de 50×16 con un anillo de 4, el
anillo es el **43 %** de la caja, no el 33 %. Y en un turno de dos horas, **más de la mitad**.

**2. La trama no entraba.** La barra imposible es tramada: su relleno **real** lleva la trama
encima. Compararla contra el color **puro** castigaba a la trama por hacer justo lo que tiene que
hacer.

**3. Se comparaba contra su propia gravedad.** Una barra imposible **se tiene que parecer a un
rojo**. El generador la penalizaba por ello — estaba exigiendo que la alarma no sonara.

### Y la pregunta era relativa cuando tenía que ser absoluta

El criterio era *«la barra debe parecerse más a su persona que a una gravedad ajena»*. **Y eso
acusaba a un inocente:** una barra teal con anillo rojo queda a **ΔE 29,6** del naranja —lejísimos,
no se confunde con nada— pero también lejos del teal, así que el margen salía negativo.

El criterio bueno es **absoluto**:

> **NINGUNA BARRA PUEDE QUEDAR A MENOS DE ΔE 20 DE UNA GRAVEDAD QUE NO ES LA SUYA.**

Y caza los tres casos **reales** sin acusar al que no:

| caso | ΔE a una gravedad ajena | |
|---|---|---|
| Marco `#5C4460` + borde ámbar → marrón | **11,0** | ❌ suena a imposible |
| Iker `#14748A` + borde ámbar → verde | **10,2** | ❌ suena a cobertura correcta |
| magenta `#86207E` + anillo naranja → rojo | **17,2** | ❌ suena a imposible |
| teal `#1486A2` + anillo rojo | **29,6** | ✅ no se confunde con nada |

**Lo que importa no es de qué se aleja una barra: es de qué se ACERCA.**

### El resultado, medido sobre la imagen

```
26 parejas (color, gravedad) medidas · la más cerca de una gravedad ajena: 20.7   ✅
semana   ΔE00 mínimo entre personas: 14.4   ✅
dia      ΔE00 mínimo entre personas: 14.7   ✅
```

**El generador predijo 20,1 y la imagen dice 20,7.** Modelo y realidad coinciden por primera vez —
que es la prueba de que el error de las cuatro caras era el de verdad.

---

## 9. La leyenda

De **2 líneas a 1**; de **115 px a 48**. Y no se ha quitado nada: **lo que dice QUÉ HACER** —los
tres carteles y su acción— se queda siempre visible, y **el resto del sistema** se va detrás de un
botón que dice *«Cómo se lee la parrilla»*. Es la ley 14 aplicada a la propia ayuda: **una leyenda
que se ignora es tan inútil como un aviso que se ignora.**

El **eje** no se pliega: sin él nadie entiende por qué un nocturno de 22:00 a 06:00 cabe entero
dentro de su día.

---

## 10. Veredicto honesto

**Las tres vistas cumplen la ley 0 y la ley 2.** Ninguna barra finge una gravedad que no tiene, y
ninguna persona se confunde con otra.

### Lo que NO está probado, y hay que decirlo

- **10 de las 36 parejas (color, gravedad)** no han salido en pantalla. El instrumento **las
  enumera** en cada pasada. Si mañana a alguien de `#1486AE` le sale un incumplimiento, se medirá.
- **El colchón es de 0,7.** La barra que más se acerca a una gravedad ajena queda a **ΔE 20,7**, con
  el umbral en 20. Y los doce colores **dependen de la geometría**: barra de 16 px, anillos de
  2/3/4, el ancho típico de un turno, hasta la trama del imposible. **Si cambia cualquiera de esos
  números, la paleta hay que VOLVER A GENERARLA**, no parchear un color a mano. Está en
  `PENDIENTES.md`.
- **Plantillas de más de doce personas:** los colores se repiten. `pixeles.mjs` lo denuncia el día
  que ocurra.
- **«Se ve poco» no es una medida.** Que el anillo del incumplimiento se quedara corto **no lo cazó
  ningún instrumento**: lo cazó el usuario, mirando. Lo único que lo sujeta ahora es que `matriz.mjs`
  exige **el grosor que la matriz declara** — si alguien lo baja, salta. Pero el número de la matriz
  lo puso un ojo, no un test.
- **El daltonismo:** la ley 6 está probada (toda gravedad lleva su palabra), pero **la paleta no se
  ha medido en escala de grises**.
