# Informe de estrés del motor de TURNIA

**Fecha:** 12 de julio de 2026
**Alcance:** motor de reglas completo (validadores de asignación, concepto y ausencia; contador de horas; calculador de cobertura; informe de incumplimientos; detector de huérfanas).
**Método:** 20 negocios distintos, un mes de cuadrante colocado *a través del validador real*, y un dataset de un año con 32.057 asignaciones para medir rendimiento sobre MySQL 8.4.
**Estado del código al cerrar:** 160 tests, 444 aserciones, en verde.

---

## 1. Resumen ejecutivo

**¿El motor aguanta?** Sí, con matices importantes.

- **La coherencia global se sostiene.** Se colocaron 1.000+ turnos en 20 negocios, uno a uno, escribiendo solo los que el motor declaraba limpios. Al re-validar el conjunto entero: **cero incumplimientos sobrevenidos**. No existe el caso "colocar A vale, colocar B vale, pero A+B no" en el camino secuencial. Eso era lo que más se temía y no está ahí.
- **Pero el motor SÍ mentía, y mentía callándose.** Se encontraron **dos silencios falsos** y **un fallo que directamente reventaba la aplicación**. Los tres están arreglados y fijados con tests.
- **El motor tiene un agujero de concurrencia real y demostrado.** Dos validaciones simultáneas producen un cuadrante ilegal sin que nadie reciba un aviso. Está reproducido en un test y la solución está diseñada, pero **NO implementada**: pertenece a la capa que escribe.

**¿Dónde no rinde?** En un solo sitio, y es grave:

> **El `ViolationReport` de un mes tarda 2,9 segundos y dispara 6.830 consultas.**

Todo lo demás va sobrado. **Validar una asignación cuesta 4-6 ms.** Eso responde a la pregunta que condicionaba el diseño de la interfaz:

> ### ✅ La parrilla PUEDE validar al arrastrar.
> A 5 ms por validación, un arrastre con validación en vivo es viable sin trucos, sin *debounce* agresivo y sin optimistic UI. El criterio que fijaste (>100 ms = sensación de lentitud) se cumple con un margen de 20×.

---

## 2. Bugs encontrados

### BUG 1 — SILENCIO FALSO: el informe no miraba dos tercios de lo que el motor sabe validar

**Diagnóstico conceptual.** El `ViolationReport` re-validaba **asignaciones**. Nada más. Pero el motor sabe validar tres cosas: asignaciones, conceptos horarios y ausencias. **Lo que el motor sabe validar y nadie re-valida es un silencio falso esperando a ocurrir.**

El caso concreto: María tiene una hora médica el jueves. Días después se registra una baja que cubre ese jueves. Esa hora médica pasa a ser **imposible** — si alguien intentara crearla ahora, el motor la rechazaría. Pero como ya está creada y **nadie vuelve a mirarla nunca**, la contradicción se queda ahí para siempre. El contador la sigue sumando. El informe dice que la semana está limpia.

La idea equivocada de fondo fue asumir que *"el informe es sobre el cuadrante"*, cuando en realidad **el informe es sobre todo lo que ocupa el tiempo de la gente**.

**Arreglo.** `ViolationReport` re-valida los tres sujetos y devuelve objetos `ReportedViolation` con un discriminador (`assignment` | `concept_entry` | `absence`). Las ausencias se incluyen aunque empezaran **antes** de la ventana: una baja abierta de hace un año sigue vigente hoy, y sus contradicciones también.

**Test que lo fija:** `SilentFalseHuntTest::el_informe_de_incumplimientos_ve_los_conceptos_horarios_invalidados_por_una_baja`

---

### BUG 2 — SILENCIO FALSO: un puesto que nadie puede cubrir salía como un hueco normal

**Diagnóstico conceptual.** Se declara que hacen falta 2 de "Sumiller" los sábados. Nadie de la plantilla está cualificado para ese puesto. El calculador decía **"faltan 2"** — exactamente igual que si fuera un hueco corriente.

El encargado abre la parrilla, ve el hueco rojo, y se pone a buscar a quién colocar. Y no encuentra a nadie. Y no entiende por qué. **El problema no estaba en el cuadrante, estaba en el catálogo**, y el motor lo sabía perfectamente pero no lo decía.

Es la misma familia que el hueco fantasma del 25 de diciembre: un aviso técnicamente cierto que apunta al sitio equivocado.

**Arreglo.** `CoverageCalculator` emite un `Notice` de tipo `UncoverablePosition`: *"Se pide cobertura de «Sumiller», pero NADIE de la plantilla está cualificado para ese puesto."* Una sola consulta al pivote `employment_position`, hecha una vez por informe.

**Test que lo fija:** `SilentFalseHuntTest::un_puesto_que_nadie_puede_cubrir_se_denuncia`

---

### BUG 3 — CRASH: el motor reventaba al validar contra una empresa borrada

**Diagnóstico conceptual.** Este no mentía: **petaba**. `Attempt to read property "name" on null`.

En la tanda 2 decidimos, deliberadamente, que **el soft delete NO cascadea**: borrar una empresa no borra sus asignaciones, porque los turnos ocurrieron y las horas se trabajaron. Lo que no vimos es la otra mitad de esa decisión: **las relaciones hijo→padre seguían filtrando al padre borrado**. El hijo vivía y su padre era invisible.

Consecuencia: `$assignment->company` devolvía `null`, y la regla de solape reventaba justo al intentar decir *"ya tiene un turno en ___"*. Y ocurría en el peor momento posible: cuando un encargado de OTRA empresa intenta colocar a esa misma persona.

La idea equivocada de fondo: creímos que "no cascadear" era una decisión sobre el **borrado**. En realidad es una decisión sobre la **lectura**: si el hijo sobrevive al padre, tiene que poder nombrarlo.

**Arreglo.** `->withTrashed()` en todas las relaciones `belongsTo` hacia modelos con soft delete (`Company`, `Person`, `Employment`), en los 11 modelos afectados. Un turno huérfano de empresa sigue ocupando físicamente a la persona, y hay que poder nombrarlo.

**Test que lo fija:** `ChaosTest::una_empresa_borrada_no_deja_de_ocupar_a_la_persona`

---

### BUG 4 — RENDIMIENTO: faltaba un índice, y solo se vio con datos reales

**Diagnóstico.** La regla del descanso busca el turno **anterior** de la persona:

```sql
WHERE person_id = ? AND ends_at <= ? ORDER BY ends_at DESC LIMIT 1
```

Con el índice `(person_id, starts_at)` que teníamos, MySQL encontraba las filas por `person_id` y luego **las ordenaba a mano** por `ends_at`: `Using filesort` sobre 122 filas.

**Arreglo.** Índice `(person_id, ends_at)`. El plan pasa a `Backward index scan` y el filesort desaparece.

| | Antes | Después |
|---|---:|---:|
| Plan | `ref` + **filesort** | `range` + **backward index scan** |
| Filas examinadas | 122 | 56 |
| Tiempo | 0,321 ms | **0,168 ms** |

Migración: `2026_07_12_120017_add_person_ends_at_index_to_assignments_table.php`

---

### NO-BUG, pero merece constar: la memoización que no pagó

Intenté memoizar el contador de horas para atacar las 6.854 consultas del informe. Resultado medido: **6.854 → 6.830**. Prácticamente nada.

Motivo: el coste **no está en el contador** (2 consultas, 0,6 ms), sino en que **cada una de las 494 asignaciones dispara las 8 consultas de las otras reglas**. Y la memoización ni siquiera acertaba, porque cada asignación se excluye a sí misma del contador y eso cambia la clave.

**Lo revertí.** Complejidad sin ganancia es una ñapa, y añadir un caché que no sirve para nada es peor que no tenerlo: deja una trampa cargada para el que venga después y lo encienda donde no debe. El número honesto está en la tabla, y la optimización que SÍ funcionaría está en la sección 4.

---

## 3. Rendimiento (números medidos)

**Dataset:** 20 empresas · 258 personas · 266 contratos · **32.057 asignaciones** (1 año) · 532 conceptos · 62 ausencias · 264 requisitos de cobertura · **7 personas con contrato en varias empresas**.
**Entorno:** MySQL 8.4.3, PHP 8.3.30, Windows/Laragon. Mediana de 5-10 ejecuciones tras calentamiento.

| Operación | ms (mediana) | nº queries | Veredicto |
|---|---:|---:|---|
| **Validar 1 asignación** — empresa pequeña (3 empleados) | **4,2** | 9 | ✅ |
| **Validar 1 asignación** — empresa mediana (8 empleados) | **5,9** | 13 | ✅ |
| **Validar 1 asignación** — empresa de **60 empleados** | **4,2** | 11 | ✅ El volumen no la afecta |
| **Validar 1 asignación** — persona con **3 contratos** | **6,1** | 13 | ✅ El cruce entre empresas cuesta ~2 ms |
| Contador — ventana **semana** | 0,6 | 2 | ✅ |
| Contador — ventana **mes** | 0,6 | 2 | ✅ |
| Contador — ventana **año** (sobre 32.000 filas) | **0,8** | 2 | ✅ El índice hace su trabajo |
| `PersonTimeline` — persona con 3 contratos | 1,0 | 3 | ✅ |
| `OrphanFinder` — tras una baja | 1,3 | 4 | ✅ |
| `CoverageCalculator` — **1 semana** (60 empleados, 12 puestos) | 26,6 | 23 | ✅ |
| `CoverageCalculator` — **1 mes** | 102,9 | 91 | 🟡 Aceptable, escala lineal con los días |
| `ViolationReport` — **1 semana** (60 empleados) | **718,9** | **1.570** | 🟠 Usable, pero pesado |
| `ViolationReport` — **1 mes** (60 empleados) | **2.901,3** | **6.830** | 🔴 **El cuello de botella** |

### El desglose de las 11-13 consultas de una validación

Ninguna es un N+1: son las consultas que **realmente hacen falta** para responder.

| Regla | queries |
|---|---:|
| Solape (asignaciones + conceptos de la persona, cruzando empresas) | 2 |
| Límites de horas (3 ventanas × 2 consultas) | 6 |
| Descanso mínimo (turno anterior + siguiente) | 2 |
| Disponibilidad (ausencias que bloquean) | 1 |
| Elegibilidad (pivote) | 1 |
| Tipo de jornada + día compartido | 2 |
| Intervalo, contrato vigente, perfil definido | 0 (leen el modelo ya cargado) |

### Los EXPLAIN de las consultas críticas

| Consulta | Tipo | Índice usado | Filas | Veredicto |
|---|---|---|---:|---|
| **Contador** (la más caliente) | `range` | `employment_id, work_date` | 2 | ✅ |
| **Solape por persona** (cruza empresas) | `range` | `person_id, starts_at` | 56 | ✅ |
| **Descanso** (turno anterior) | `range` | `person_id, ends_at` ← **NUEVO** | 56 | ✅ (antes: filesort) |
| **Parrilla** (turnos de un día) | `ref` | `company_id, work_date` | 28 | ✅ |
| **Cobertura** (calendario+puesto+día) | `ref` | `position_id` (FK) | 1 | ✅ |
| **Disponibilidad** (ausencias) | `range` | `person_id, starts_on, ends_on` | 1 | ✅ |

**Veredicto sobre los índices de la tanda 2, que diseñamos a ciegas:**

- **Ninguna consulta crítica hace *full scan*.** Los seis índices aciertan.
- **Faltaba uno:** `(person_id, ends_at)`. Añadido.
- **No sobra ninguno**, con un matiz: el compuesto `(calendar_id, work_date, position_id)` no lo elige MySQL en la consulta de cobertura (prefiere el índice de la FK `position_id`, que es más estrecho y muy selectivo). Pero **sí lo usa** la consulta "todos los turnos de un calendario en un día", que es la que pintará la parrilla. Se queda.

---

## 4. Decisiones tomadas y su criterio

### El informe se queda lento, y es una decisión, no una rendición

2,9 segundos para el mes de una empresa de 60 empleados. El coste es **inherente al diseño**: el informe re-valida cada sujeto contra el estado completo, y eso es exactamente lo que lo hace **incapaz de mentir**. Un incumplimiento guardado se desincronizaría en cuanto cambiara cualquier fila relacionada.

**Consecuencias de diseño, que la tanda de la parrilla debe respetar:**

1. **El informe NO puede ir en el camino de la petición.** Va en un *job* en cola, o en una pantalla bajo demanda con su indicador de carga. No se refresca al arrastrar un turno.
2. **La ventana natural del informe es la SEMANA (719 ms), no el mes.** Es lo que mira un encargado, y es el número que hay que enseñar.
3. **La optimización que SÍ funcionaría, cuando haga falta:** un objeto de contexto pre-cargado por ventana (todas las asignaciones, conceptos y ausencias de la ventana en 3 consultas, en memoria) que se le pasa a las reglas, en vez de que cada regla consulte por su cuenta. Convierte O(N × reglas) consultas en O(reglas). **No la he hecho ahora** porque exigiría cambiar la firma de las 20 reglas para aceptar un contexto opcional, y eso es un rediseño que merece su propia tanda y su propia discusión. La lentitud actual no bloquea la parrilla.

### Las tres gravedades se reportan TODAS, sin que el imposible eclipse al resto

El motor **no corta al primer imposible**. Si un turno solapa, además rompe el descanso, además no está cualificado y además la persona trabaja ese día en otra empresa, se reportan **las cuatro cosas**.

**Criterio:** si el imposible eclipsara al resto, el encargado arreglaría el solape, lo reintentaría, y descubriría el siguiente problema. Y otra vez. **Un diagnóstico a plazos entrena a odiar la herramienta.** Además, la capa que escribe necesita poder bloquear por el imposible *y* registrar el incumplimiento en el mismo gesto.

Demostrado en `RuleInteractionTest::las_tres_gravedades_se_reportan_a_la_vez_sin_que_una_eclipse_a_las_otras`.

### Las reglas no dependen del orden, y está demostrado

Se ejecutaron las 10 reglas de asignación en **orden aleatorio, 100 veces**, sobre un escenario que dispara siete violaciones a la vez. El conjunto de violaciones (código + gravedad + contexto) es **idéntico en las 100**.

No es sorprendente —ninguna regla escribe nada— pero *"no debería"* no es una demostración. Ahora lo es.

### La concurrencia se cierra con transacción + candado sobre la PERSONA

**El agujero (reproducido):** dos encargados validan a la vez contra el mismo estado. Los dos reciben "limpio". Los dos escriben. El resultado combinado **nunca se validó contra nada**, y nadie recibió un aviso. El caso peor no es el duplicado evidente: son **dos turnos distintos, en días distintos, que individualmente cumplen el descanso y juntos lo rompen**.

**La solución, al modo Laravel:**

```php
DB::transaction(function () use ($draft) {
    Person::whereKey($draft->personId())->lockForUpdate()->first();

    $result = app(AssignmentValidator::class)->validate($draft);   // RE-validar DENTRO
    // ...decidir y escribir con el estado ya bloqueado
});
```

**Por qué la persona es el candado correcto:** el solape y el descanso —las dos reglas que la concurrencia puede romper— se validan **a nivel de persona**. Bloquear la persona serializa exactamente las escrituras que pueden interferir, y **deja pasar en paralelo** las que afectan a personas distintas. Bloquear la empresa serializaría de más; bloquear la asignación, de menos.

⚠️ **Corolario para la parrilla:** la validación que se enseña al arrastrar es **una previsualización**. La validación que decide es la que corre **dentro del candado**. No son la misma llamada, y confundirlas reabre el agujero.

### ✅ IMPLEMENTADO, Y PROBADO CON DOS NAVEGADORES DE VERDAD

Vive en `AssignmentWriter`, y **es el único sitio de Turnia que escribe un turno**. Su firma **no admite un `ValidationResult` de fuera**: no se le puede decir «ya lo validé, escribe». El tipo no lo permite, así que la separación deja de depender de que alguien se acuerde.

Y la previsualización vive en **otro controlador** (`AssignmentPreviewController`), a propósito: si estuvieran en el mismo, el día que alguien «refactorice para no repetir» las fundiría y reabriría el agujero — con las mejores intenciones y en un commit que parecería una limpieza.

**Probado con DOS CONTEXTOS DE CHROMIUM, dos sesiones, dos procesos de PHP y una fila de InnoDB** (`tests/Visual/concurrencia.mjs`). El caso peor, no el fácil: dos turnos distintos, en días distintos, que individualmente cumplen el descanso y juntos lo rompen.

| | navegador 1 | navegador 2 |
|---|---|---|
| **previsualización** | `limpio` | `limpio` ← ⚠️ **la previsualización miente, por construcción** |
| **escritura (con candado)** | `200 escrito` | `409` · *«solo descansa 8 h, y el mínimo es 12»* |
| **escritura (SIN candado)** | `200 escrito` | `200 escrito` ← 💀 **el agujero, reproducido** |

> ⚠️ **Y la segunda fila de esa tabla es la que hace que la primera valga algo.**
>
> Si el servidor SERIALIZARA las dos peticiones, la segunda correría después de la primera, vería su escritura y la cazaría igual — **y el test pasaría sin que hubiera habido carrera**. Un verde sobre una carrera que nunca ocurrió no dice nada del candado.
>
> Por eso la prueba se hace **dos veces**, y quitar el candado tiene que hacer que **los dos ganen**. Si no lo hiciera, el instrumento lo dice: *«el servidor SERIALIZÓ las peticiones: esta prueba NO ha probado nada»*.

**El riesgo número uno que quedaba vivo deja de estarlo.**

---

## 5. Lo que sigue sin cubrir, y por qué

| Hueco | Por qué no está cubierto |
|---|---|
| **`requiredReductionMinutes()` sigue sin consumidor** | Deuda consciente de la tanda 4. El modelo no tiene campo de *jornada exigible* contra el que restar. Es una pieza de negocio sin definir, no un olvido. |
| ~~**La concurrencia real (dos procesos PHP simultáneos)**~~ | ✅ **CERRADO.** Dos contextos de Chromium, dos procesos de PHP, una fila de InnoDB (`tests/Visual/concurrencia.mjs`). Y con la contraprueba: sin el candado, **los dos escriben**. |
| **Empresas con miles de empleados** | El tope medido es 60 empleados y 32.000 asignaciones/año. Una cadena de 500 empleados no está probada. La validación no depende del tamaño de la empresa (todas sus consultas van por índices selectivos), así que **debería** escalar — pero "debería" no es "está medido". |
| **La cobertura con muchos puestos y ventanas largas** | `CoverageCalculator` hace O(días × puestos con requisitos) consultas. Un mes con 12 puestos: 91 consultas, 103 ms. Un trimestre con 30 puestos sería ~700 consultas. No se ha medido. |
| **El comportamiento con la caché de MySQL fría** | Todas las medidas son tras calentamiento. El primer golpe del día será peor. |
| **Zonas horarias distintas de `Europe/Madrid`** | El modelo lo soporta (los instantes son UTC y la zona es de la empresa), pero **todos los tests usan Madrid**. Una empresa en Canarias no se ha probado. |
| **Colisiones de UUID, corrupción de datos, fallos de disco** | Fuera del alcance. |

---

## 6. Veredicto honesto

### Lo que está PROBADO

- **El motor no se contradice a sí mismo.** 1.000+ turnos colocados uno a uno en 20 negocios distintos siguen limpios al re-validarlos en bloque.
- **Las reglas son independientes del orden.** Demostrado con 100 permutaciones.
- **Las tres gravedades conviven** sin eclipsarse ni duplicarse.
- **El cruce entre empresas funciona**, que era el flanco más frágil: 7 personas con contratos en varias empresas, y el solape, el descanso y las bajas cruzan las fronteras correctamente. Una persona con 5 contratos en 5 empresas se comporta bien.
- **Los datos sucios no lo tumban:** tope de 0 (≠ null), empresa que no abre nunca, festivo sobre día no laborable, baja dentro de baja, ausencia de 5 años, contrato de un solo día, fechas en 1900 y 2200, 200 turnos en un día, perfiles borrados, empresas borradas.
- **Validar cuesta 4-6 ms.** La parrilla puede validar al arrastrar. Este es el dato que desbloquea la tanda 5.
- **Los índices aguantan.** Ninguna consulta crítica hace *full scan* sobre 32.000 filas.

### Lo que se ASUME y solo se sabrá en producción

- ~~**Que la concurrencia real se comporta como la simulada.**~~ ✅ **Ya no se asume: se ha medido.** Dos navegadores, dos procesos de PHP, una fila de InnoDB. Uno gana, el otro pierde y sabe por qué. Y sin el candado, los dos escriben — así que la carrera era de verdad. Lo que sigue sin probarse es la concurrencia **con más de dos** escritores y bajo carga sostenida.
- **Que 60 empleados es representativo.** Si aparece un cliente con 500, hay que volver a medir. No hay razón teórica para que se degrade, pero no está medido.
- **Que 2,9 segundos de informe son tolerables.** Depende de cómo se use. Si alguien lo pone en el camino de la petición, la app se sentirá rota, y no será culpa del motor sino de dónde se colocó.
- **Que el reloj del servidor y el de MySQL están de acuerdo.** Todo el motor descansa en instantes UTC. Un servidor con la zona mal configurada mentiría de forma silenciosa y sistemática. **Merece una comprobación en el arranque del despliegue.**

### La frase que resume el estado

> El motor **no peta y no se contradice**. Los tres fallos que quedaban eran **de omisión**: sitios donde dejaba de mirar. Los dos silencios falsos están cerrados y el crash está arreglado. Lo que queda vivo no es un bug: es **una ventana de concurrencia entre validar y escribir**, y se cierra en la capa que escribe, no aquí.
