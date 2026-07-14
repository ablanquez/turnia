# Pendientes

Lo que está decidido que se hará, pero **no ahora**. No es una lista de deseos: es lo que se
ha mirado, se ha entendido y se ha aparcado a propósito, con el motivo.

---

## Modelo

### Zona horaria POR CALENDARIO, no solo por empresa

Hoy la zona vive en `companies.timezone` y es la que usa `Company::toUtc()` / `localTime()`,
que son los dos únicos sitios donde se convierte. Una empresa con centros en Canarias y en
Madrid necesitaría una zona por calendario (o por "centro", que todavía no existe como
entidad).

**Es un cambio de modelo**, no un ajuste: hay que decidir si el centro es una entidad nueva o
si la zona baja a `calendars`. Se decide cuando montemos la creación de calendarios.

### EL INICIO DEL EJE DEL DÍA, también por calendario

Hoy está **cableado en el código**: `TimeAxis::DEFAULT_FROM = 6.0` → el día de negocio va de
06:00 a 06:00. Funciona para un bar, y **no debería ser una constante**.

Una panadería que entra a las 03:00 no encaja en un eje que empieza a las 06:00 — su día de
negocio arranca de madrugada. Una discoteca querría otro. Hoy el eje *se ensancha* para que
la barra quepa (nunca recorta), pero eso es un parche: lo correcto es que el negocio diga
dónde empieza su día.

**Es exactamente el mismo tipo de parámetro que la zona horaria: una decisión del CALENDARIO,
no del código.** Y va con ella.

⚠️ **Siempre en tramos de 24 h** (00:00→00:00, 06:00→06:00, 03:00→03:00…). No es "elige tu
rango": es **"elige dónde empieza tu día"**. Un eje que no cubra 24 h partiría turnos en dos.

Y no es un detalle estético: **con el eje en 00:00→00:00, el nocturno de 22:00 a 06:00 se
partiría en DOS barras** —una al final de un día y otra al principio del siguiente— cuando es
UN solo turno. Que el eje empiece a las 06:00 es justo lo que lo mantiene entero. Ahí está el
motivo de que este parámetro importe.

### El seeder deja Cocina y Sala casi vacías el fin de semana

En hostelería el fin de semana es el **pico de carga**, y la demo hace parecer que el bar
cierra la cocina. El domingo ya tiene los refuerzos de punta (ley 15), pero la rota de fin de
semana sigue siendo pobre. Se arregla cuando montemos el año entero de cuadrantes.

### ⚠️ MARCO VA EXACTAMENTE A TOPE: 25 h DE 25

Con el refuerzo de punta del miércoles, Marco queda en **25 de 25 horas semanales**. El motor
compara con `<=`, así que no salta. **Pero si alguien le añade un minuto más, el tope semanal
salta en sus CUATRO turnos y la fila entera se pone naranja** — el "cuadrante en llamas" que
`DemoSeeder` existe para evitar. Está a propósito (la demo enseña el borde), y está escrito aquí
para que nadie lo descubra a base de sustos.

### Los tres seeders se reparten los ids de empresa POR ORDEN, y nada lo enforce

`DemoSeeder` (1–2) → `BacktestSeeder` (3–15) → `MatrizSeeder` (16–17). Cada uno escribe en su JSON
(`escenarios.json`, `matriz.json`) los ids que le TOCARON. Si se ejecutan en otro orden, o falta
uno, los JSON apuntan a empresas que ya son de otro y **los instrumentos miden la página
equivocada** — sin decirlo. Ya pasó: `backtest.mjs` estuvo dando 13 fallos sobre un cuadrante que
no era el suyo.

El orden correcto está en el README, y debería estar **en un comando** (`artisan turnia:sembrar`)
en vez de en la memoria de quien lo ejecute.

---

## Interfaz

### El indicador de la cabecera no lleva a ningún sitio

Dice "4 turnos con incidencias · 4 tramos sin cubrir · 1 aviso de catálogo" y ahí se acaba:
**informa, pero no es accionable**. Está bien de momento, pero más adelante **tendrá que
llevar a algún sitio** — un panel, un modal, un filtro que salte a las celdas afectadas.
Falta decidir cuál. **Se decidirá**, no se improvisa.

### Páginas de error propias (400 / 403 / 404 / 500)

Como en Linaje. Va en el bloque de endurecimiento.

---

## Rendimiento

### La demo final llevará UN AÑO ENTERO de cuadrantes

Plan: cargar la semana en curso y **precargar en segundo plano las vecinas** (anterior y
siguiente), que es lo que hace que las flechas se sientan instantáneas.

⚠️ **Eso NO sirve para el zoom Año.** Ahí el problema no es que tarde: es que **el contrato de
datos es distinto**. 30.000 turnos no se pintan uno a uno — el Año necesita **agregados**
(cuántas horas, cuántos huecos, cuántos incumplimientos por semana), no la lista de turnos.
Los zooms Año / Mes / Horas están deliberadamente **deshabilitados** en la interfaz por esto
mismo, y no por falta de tiempo.

---

## Lo que la matriz visual deja abierto

Ver `BACKTEST-COMBINATORIO.md` §8. En resumen, lo que **no** está probado y solo se sabrá en
producción:

- **⚠️ LA PALETA DEPENDE DE LA GEOMETRÍA DE LA BARRA.** Los doce colores salen de un cálculo que
  tiene DENTRO el alto (16 px), el grosor de cada franja de gravedad (2/3/4), la trama (2 px cada 8,
  en la sombra del propio color) y el fondo de la pista. **Si cambia cualquiera de esos números, la
  paleta hay que VOLVER A GENERARLA** (`tests/Visual/paleta.mjs`), no parchear un color a mano. Ya
  pasó: el modelo metía "el ancho de una barra" como si fuera uno solo (50 px, un turno de 8 h) y la
  paleta **solo era cierta a ese ancho** — un turno de una hora se veía marrón. Ver `RESPONSIVE.md`
  §4 y la **ley 16** de la matriz.
- **⚠️ EL COLOR NO PUEDE SER EL ÚNICO CANAL DE IDENTIDAD, Y ESO ES UN TECHO, NO UNA TAREA.**
  Medido: en la zona fría —sin rojo, naranja, ámbar ni verde, que están reservados al estado— **no
  existen doce colores separados ΔE 20 unos de otros. Ni ocho** (el máximo para ocho es 19,6; para
  doce, 16,1). O sea que el aviso «⚠️ cuesta» de `pixeles.mjs` **va a estar siempre encendido**, y
  no por pereza. Hoy lo compensan el avatar con iniciales, el nombre escrito y la línea vertical de
  color: la identidad nunca cuelga solo del relleno. **Si algún día hace falta más, la salida no es
  «más colores»: es otro canal** (¿una forma? ¿un patrón?). Decisión aparcada, no olvidada.
- **⚠️ PLANTILLAS DE MÁS DE DOCE PERSONAS.** La paleta tiene doce colores con separación perceptual
  verificada (D = 16,1) y se REPARTEN por orden de id — sin colisiones hasta el doce. A partir de
  ahí **se repiten**, y dos personas de la misma empresa vuelven a tener la misma barra.
  `tests/Visual/pixeles.mjs` lo denunciará en cuanto ocurra. Es el mismo techo del punto anterior.
- **⚠️ FIREFOX Y SAFARI NO SE HAN ABIERTO.** Chromium sí, y a **siete densidades** —DPR 1, 2 y 3, y
  zoom del navegador al 80/125/150 %— con la matriz entera medida en cada una
  (`tests/Visual/densidad.mjs`): la ley 2, la ley 0 y la trama aguantan, y ningún número se mueve
  más de ±1,5 ΔE. **Retina ya no es un agujero.** Los otros dos motores sí.
- **Más de tres personas por celda.** Los seeders llegan a tres. Con seis, el aire entre bloques
  podría dejar de decir la verdad sobre quién va con quién.
- **El daltonismo.** La ley 6 (ningún color va solo) está probada: toda gravedad lleva su
  palabra. Pero **la trama y el filo no se han probado en escala de grises**, y son marcas de
  forma precisamente para eso.
- **Los colores 11–15 de la paleta de personas** apenas han salido: el reparto va por `crc32`
  del nombre. El contraste se mide en cada pasada, pero no sobre los quince.

Y una regla que hay que mantener viva: si mañana se añade **una regla informativa a los
conceptos**, aparecen 8 casos nuevos y `tests/Visual/matriz.mjs` **los exigirá** — la lista
`ESPERADAS` está derivada del modelo, no de un gusto. Si el test grita «CASO NO ALCANZADO», o el
seeder no lo siembra o **el servidor se está callando un dato**.

---

## Lo que la tanda de ESCRIBIR deja abierto

Ver `docs/ESCRIBIR.md` §8. Lo que **no** entra, y a propósito:

- **Redimensionar el turno estirando el borde.** Gesto propio, geometría propia, previsualización
  propia. Tanda propia.
- **Deshacer / rehacer.** Necesita un modelo de historial que no existe.
- **Editar conceptos horarios y ausencias.** Tienen OTRAS reglas (un concepto cuelga de un catálogo,
  una baja consume cupo). Dejarlos arrastrar «porque están ahí» sería escribir una tabla con las
  reglas de otra.
- **Editar en el zoom Día.** Allí solo hay un día, así que el gesto principal —mover a otro día— no
  existe. Lo que tendría sentido es ajustar las horas arrastrando el borde… que es lo que está fuera.

Y lo que **no está probado**:

- **La concurrencia con MÁS DE DOS escritores, y bajo carga sostenida.** Con dos navegadores está
  medido y cerrado (`tests/Visual/concurrencia.mjs`). Con veinte, no.
- **El arrastre CON EL DEDO.** Pointer Events lo soporta y `touch-none` está puesto, pero **no se ha
  abierto en un móvil ni en una tableta**. Y la vista móvil del empleado sigue siendo otra tanda.
- **El arrastre en Firefox y Safari.** Como todo lo demás: solo Chromium.

---

## Despliegue

### `/public/build` está en `.gitignore` y Hostinger no tiene Node

Vue compila **en local**. El servidor solo tiene PHP y MySQL, así que el `build` tiene que
llegar de alguna forma: o se deja de ignorar y viaja en el repo, o se sube por FTP en cada
despliegue. **Decisión pendiente del usuario.**
