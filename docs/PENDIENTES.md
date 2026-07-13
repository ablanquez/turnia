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

### El seeder deja Cocina, Sala y Caja vacías el sábado y el domingo

En hostelería el fin de semana es el **pico de carga**, y la demo hace parecer que el bar
cierra la cocina. Se arregla cuando montemos el año entero de cuadrantes.

---

## Interfaz

### El indicador de la cabecera no lleva a ningún sitio

Dice "4 turnos con incidencias · 4 tramos sin cubrir · 1 aviso de catálogo" y ahí se acaba.
Informa, pero no es accionable. Falta decidir qué es: ¿un botón? ¿filtra la parrilla? ¿abre
una lista con los sitios donde están? **Se decidirá**, no se improvisa.

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

## Despliegue

### `/public/build` está en `.gitignore` y Hostinger no tiene Node

Vue compila **en local**. El servidor solo tiene PHP y MySQL, así que el `build` tiene que
llegar de alguna forma: o se deja de ignorar y viaja en el repo, o se sube por FTP en cada
despliegue. **Decisión pendiente del usuario.**
