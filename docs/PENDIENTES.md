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

### El seeder deja Cocina, Sala y Caja vacías el sábado y el domingo

En hostelería el fin de semana es el **pico de carga**, y la demo hace parecer que el bar
cierra la cocina. Se arregla cuando montemos el año entero de cuadrantes.

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
  tiene DENTRO el alto (16 px), el grosor de cada franja de gravedad (2/3/4) y hasta la trama del
  imposible. **Si cambia cualquiera de esos números, la paleta hay que VOLVER A GENERARLA**
  (`tests/Visual/paleta.mjs`), no parchear un color a mano. Ya pasó una vez: el modelo metía "el
  ancho de una barra" como si fuera uno solo (50 px, un turno de 8 h) y la paleta **solo era cierta
  a ese ancho** — un turno de una hora se veía marrón. Ver `docs/RESPONSIVE.md` §4.
- **⚠️ SOLO SE HA PROBADO EN CHROMIUM, Y A `deviceScaleFactor: 1`.** Una pantalla Retina (DPR 2)
  renderiza el antialiasing distinto, y **el antialiasing es exactamente lo que separa el modelo de
  la imagen** en toda esta matriz. Es el hueco más grande que queda. Firefox y Safari tampoco se han
  abierto.
- **⚠️ PLANTILLAS DE MÁS DE DOCE PERSONAS.** La paleta tiene doce colores con separación
  perceptual verificada (ΔE00 mínimo 16,5), y se REPARTEN por orden de id — sin colisiones hasta
  el doce. A partir de ahí **se repiten**, y dos personas de la misma empresa vuelven a tener la
  misma barra. No hay doce mil colores que se distingan en la zona fría, así que la salida no es
  «más colores»: habrá que decidir otra cosa (¿un segundo canal? ¿el color solo para quien está
  en la celda?). `tests/Visual/pixeles.mjs` lo denunciará en cuanto ocurra.
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

## Despliegue

### `/public/build` está en `.gitignore` y Hostinger no tiene Node

Vue compila **en local**. El servidor solo tiene PHP y MySQL, así que el `build` tiene que
llegar de alguna forma: o se deja de ignorar y viaja en el repo, o se sube por FTP en cada
despliegue. **Decisión pendiente del usuario.**
