# Escribir: el arrastre y el candado

**Esta es la tanda que convierte Turnia de un visor en un editor.** Y lleva dentro el riesgo número
uno que quedaba vivo en el proyecto.

---

## 1. La ley

> **LA VALIDACIÓN QUE SE ENSEÑA AL ARRASTRAR ES UNA PREVISUALIZACIÓN.**
> **LA VALIDACIÓN QUE DECIDE ES LA QUE CORRE DENTRO DEL CANDADO.**
> **NO SON LA MISMA LLAMADA, Y CONFUNDIRLAS REABRE EL AGUJERO.**

### El agujero, recordado

Dos escrituras validan a la vez contra el mismo estado. Las dos reciben *«limpio»*. Las dos
escriben. **El resultado combinado nunca se validó contra nada**, y nadie recibió un aviso.

Y el caso peor **no es el duplicado evidente** —ese se ve— sino **dos turnos distintos, en días
distintos, que individualmente cumplen el descanso y juntos lo rompen**.

> ⚠️ **Y esto pasa aunque solo haya UN usuario.** Dos pestañas. O uno que arrastra, se distrae, y
> suelta cinco minutos después — cuando su compañero ya registró una baja.
>
> **El TOCTOU no es «dos personas a la vez». Es «el estado cambió entre que comprobé y escribí».**

---

## 2. La separación, hecha estructura (no disciplina)

| ruta | controlador | qué hace |
|---|---|---|
| `POST .../assignments/preview` | `AssignmentPreviewController` | valida. **No abre transacción. No coge candado. No escribe.** |
| `POST / PATCH / DELETE .../assignments` | `AssignmentController` | **abre transacción, coge el candado, RE-VALIDA dentro**, decide y escribe |

**Son dos controladores distintos a propósito.** Si vivieran en el mismo, el día que alguien
*«refactorice para no repetir»* fundiría las dos validaciones y **reabriría el agujero entero** — con
las mejores intenciones y en un commit que parecería una limpieza. **Aquí la duplicación es el muro.**

Y el candado vive en una sola clase, `AssignmentWriter`, cuya firma **no admite un `ValidationResult`
de fuera**:

```php
public function place(AssignmentDraft $draft, User $user, ?Justificacion $forzar = null): Decision
{
    return DB::transaction(function () use ($draft, $user, $forzar) {
        Person::whereKey($draft->personId())->lockForUpdate()->first();   // ← la tanda entera

        $result = $this->validator->validate($draft);                     // ← RE-VALIDA. Siempre.
        ...
    });
}
```

**No se le puede decir «ya lo validé, escribe». El tipo no lo permite.** La separación deja de
depender de que yo me acuerde.

### Por qué el candado va sobre la PERSONA

El **solape** y el **descanso** —las dos reglas que la concurrencia puede romper— se validan a nivel
de persona, y **cruzan empresas**.

- Bloquear la **empresa** serializaría de más: dos encargados tocando a dos personas distintas no se
  estorban, y estarían haciendo cola.
- Bloquear la **asignación** serializaría de menos: **el caso peor son dos asignaciones distintas.**
  Un candado sobre cada una no las hace hablar entre sí, que es justo lo que hace falta.

### Lo que SÍ se comparte

`AssignmentDraftRequest` traduce la petición a un `AssignmentDraft`, y lo usan los dos. **No es una
contradicción:** lo que caduca es la RESPUESTA de validar, no la PREGUNTA. Si la traducción estuviera
duplicada, el peligro sería el contrario — que la previsualización validara un draft y el candado
validara **otro**, y entonces la previsualización mentiría por construcción.

> **Se comparte la pregunta. No se comparte la respuesta.**

---

## 3. Los tres desenlaces

| gravedad | HTTP | qué pasa |
|---|---|---|
| **IMPOSIBLE** | `422` | **No se escribe.** Se explica por qué y la barra vuelve a su sitio. |
| **INCUMPLIMIENTO** | `409` | **No se escribe.** Se pregunta: *«¿forzar?»* → segunda llamada, que **vuelve a coger el candado y vuelve a validar**. |
| **AVISO / LIMPIO** | `200` | Se escribe. |

`409` y no `422` para el incumplimiento, y la diferencia importa: **422 es «tu petición no es
válida»** (culpa del que pide) y **409 es «el estado actual no lo permite tal cual»** (no es culpa de
nadie: hay un conflicto que un humano tiene que resolver). Forzar es exactamente eso.

### ⚠️ El drop NO se rechaza en silencio

**Se deja soltar, se valida, y entonces se dice que no y por qué.** Un drop que simplemente «no
engancha» es frustrante y no enseña nada: el usuario prueba tres veces y se va pensando que la app
está rota.

### ⚠️ El TOCTOU de segundo orden

Entre el `409` y el «forzar», **el estado pudo cambiar otra vez**. Así que:

- si al re-validar **ya no incumple** → se escribe **limpio, sin override**, y se le dice. *(Guardar
  la decisión de forzar algo que ya no incumple sería dejar en el expediente de esa persona una firma
  sobre una infracción que nunca ocurrió.)*
- si incumple **por otra regla** → **`409` otra vez, con los motivos nuevos**. El usuario justificó
  una cosa; no se le puede estampar la firma sobre otra.
- y `assignment_overrides.violations` guarda **lo que vio el candado**, no lo que se le enseñó en
  pantalla.

### La justificación es OBLIGATORIA

Es **el único dato de toda la aplicación que no se deriva de nada**. El incumplimiento se DERIVA
(re-validando), porque depende de otras filas y uno guardado se volvería mentira sin que nadie lo
tocara. Pero *«quién decidió saltárselo, cuándo y POR QUÉ»* no se deduce de ninguna fila.

Si se pudiera dejar vacía, en tres semanas todas estarían vacías y el registro no valdría nada:
**una firma sin contrato.**

> Y `user_id` **no es `fillable`**: se asigna a mano, desde la sesión. Si fuera asignable en masa, un
> `force[user_id]` colado en el cuerpo del POST bastaría para firmar una infracción con el nombre de
> otro. Un registro de decisiones humanas que se puede falsificar no vale nada.

---

## 4. El drag & drop: Pointer Events, sin dependencias

Las dependencias de este proyecto son **Vue e Inertia. Y ya.**

- **HTML5 nativo (`dragstart`/`dragover`)**: la imagen que se arrastra la pinta **el navegador**, y
  no se puede sustituir. Y lo que hay que enseñar mientras se arrastra **no es una foto de la barra:
  es la previsualización**. Además, `dragover` no da coordenadas fiables y no funciona con el dedo.
- **SortableJS / `vuedraggable`**: hechas para **listas ordenables**. Aquí hay una rejilla de dos
  dimensiones con un eje temporal dentro de cada celda. No encaja.
- **Pointer Events** (`pointerdown` + `setPointerCapture` + `pointermove` + `pointerup`): es la API de
  la plataforma —lo que las librerías envuelven por dentro—, funciona con ratón y con dedo, y deja
  pintar la previsualización con la matriz visual que ya existe.

### Los gestos

| gesto | qué hace |
|---|---|
| arrastrar una **ficha del panel** → celda | **colocar** (abre el popover de horas) |
| arrastrar una **barra** → otra celda | **mover** (las horas se conservan) |
| arrastrar una **barra** → la **papelera** | **quitar** |
| **Supr** con la barra enfocada | **quitar** |

**La papelera aparece al arrastrar, y no antes.** Un cubo de basura permanente en la pantalla es una
invitación a un accidente; uno que sale justo cuando llevas algo en la mano es una respuesta a lo que
estás haciendo.

**Y un botón «×» en la barra queda descartado por la matriz visual:** un turno de una hora mide 5 px
de ancho — no cabe, y si cupiera **taparía el relleno**, que es el canal de identidad (ley 2). Por eso
quitar tiene dos caminos, y el segundo (Supr) es además el camino sin ratón.

### Las horas al colocar

Las propone **el servidor**, y salen del **hueco de cobertura** de esa celda (*«faltan 1 de 12:00 a
20:00»*): colocar a alguien **donde falta gente** es lo que se quiere hacer nueve de cada diez veces.

**Y las decide el servidor porque el cliente no las sabe:** la cobertura viaja como prop diferida
(llega ~700 ms después del primer pintado). Una respuesta que depende de si un dato asíncrono ya
llegó no es una respuesta.

Si el puesto **no pide a nadie** ese día, los campos salen **vacíos**. Y eso no es un fallo: es la
verdad. Un *«09:00–17:00 por defecto»* sería fabricar un dato con aspecto de dato.

---

## 5. El repintado: por qué el informe va DETRÁS de la escritura

El informe cuesta **719 ms y ~1.700 consultas**. Si estuviera en el camino de la escritura, soltar una
barra tardaría un segundo — y la app se sentiría rota, sin que fuera culpa del motor sino de dónde lo
pusimos.

Así que la escritura responde en milisegundos, y después el cliente pide `router.reload()`: las props
**diferidas** (`violations`, `coverage`) se recalculan solas, con el mismo fallback honesto de siempre
(*«comprobando el cuadrante…»*, **nunca verde**).

> ⚠️ **Y eso resuelve solo lo de «mover un turno puede romper OTRO».**
>
> La escritura **no calcula los daños colaterales**. No le hace falta: el informe diferido se
> recalcula sobre el estado REAL y **para toda la semana**, así que la celda que acaba de quedarse sin
> gente se pinta en rojo sola — **sin que la escritura sepa que existe.**
>
> Medido en la página (`tests/Visual/arrastrar.mjs`, caso 4bis): se mueve a Iker del lunes al domingo
> y los **tramos sin cubrir pasan de 4 a 5**, en una celda que la escritura no tocó.

---

## 6. Lo que se ha probado, y cómo

### Dos navegadores peleándose de verdad contra InnoDB

`tests/Visual/concurrencia.mjs`. **No es concurrencia simulada:** dos contextos de Chromium, dos
sesiones, dos peticiones HTTP a la vez → dos procesos de PHP → dos transacciones sobre la misma fila.

El caso peor: **dos turnos distintos, en días distintos, que individualmente cumplen el descanso y
juntos lo rompen.**

| | navegador 1 | navegador 2 |
|---|---|---|
| **previsualización** | `limpio` | `limpio` ← ⚠️ **miente, por construcción** |
| **escritura, CON candado** | `200 escrito` | `409` · *«solo descansa 8 h, y el mínimo es 12»* |
| **escritura, SIN candado** | `200 escrito` | `200 escrito` ← 💀 **el agujero, reproducido** |

> ⚠️ **La tercera fila es la que hace que la segunda valga algo.**
>
> Si el servidor **serializara** las dos peticiones, la segunda vería la escritura de la primera y la
> cazaría igual — **y el test pasaría sin que hubiera habido carrera**. Por eso la prueba se hace dos
> veces, y **quitar el candado tiene que hacer que los dos ganen**. Si no lo hiciera, el instrumento
> lo dice en voz alta: *«el servidor SERIALIZÓ las peticiones: esta prueba NO ha probado nada»*.

### Arrastrar de verdad, con el ratón

`tests/Visual/arrastrar.mjs`. Abre Chromium, coge las barras con `mouse.down()`, las mueve píxel a
píxel y las suelta. Ocho casos cebados: imposible · forzar · no cualificado · de baja · colateral ·
soltar en el mismo sitio · papelera · tecla Supr.

### En PHPUnit

`AssignmentWriterTest` (el candado, los tres desenlaces, el TOCTOU de segundo orden, el forzado que
caduca al mover) y `AssignmentEndpointsTest` (los tres códigos HTTP, las policies, y que **la
previsualización no escribe NUNCA**, ni cuando el resultado es limpio).

---

## 7. Tres cosas que solo se vieron ARRASTRANDO

1. **`arrancado` no era reactivo.** Vivía como un `let` fuera del objeto reactivo, así que Vue **no se
   enteraba** de que el arrastre había empezado: **el fantasma no se pintaba nunca**. Y el arrastre
   funcionaba — el servidor recibía las peticiones. *Un estado que gobierna lo que se pinta y vive
   fuera del sistema reactivo no es un descuido de Vue: es un dato que la pantalla no puede ver.*

2. **`required_without:assignment` miraba el CUERPO, y `assignment` es un parámetro de la RUTA.** La
   condición no se cumplía nunca, así que al mover se exigía un `employmentId` que no se manda jamás,
   y **la previsualización devolvía 422 en silencio**. Se ve arrastrando; no se ve leyendo.

3. **`shouldRenderJsonWhen(is('api/*'))` no cubría ninguna ruta.** La app **no tiene rutas `/api/*`**,
   así que la condición era siempre falsa y **toda excepción se renderizaba como HTML** — incluidos
   los errores de validación de una petición que pedía JSON, que salían como **un redirect a la
   portada**. El cliente no tenía forma de leer el motivo.

Y una cuarta, en el propio instrumento: **`execSync` mataba `concurrencia.mjs`.** Bloquea el bucle de
eventos de Node, Playwright tiene handles abiertos ahí, y libuv reventaba **después** de imprimir el
informe: **veredicto ✅, código de salida 127.** Un instrumento cuyo veredicto y cuyo código de salida
no coinciden no sirve para nada.

---

## 8. Lo que NO entra en esta tanda, y por qué

- **Redimensionar el turno estirando el borde** (cambiar la hora de fin arrastrando). Es un gesto con
  su propia geometría y su propia previsualización. Tanda propia.
- **Deshacer / rehacer.** Necesita un modelo de historial que no existe.
- **Editar conceptos horarios y ausencias.** Tienen **otras reglas** (un concepto cuelga de un
  catálogo, una baja consume cupo). Dejarlos arrastrar *«porque están ahí»* sería escribir una tabla
  con las reglas de otra.
- **Editar en el zoom Día.** El zoom Día enseña **un solo día**, así que el gesto principal —mover a
  otro día— no existe allí. Lo que sí tendría sentido es ajustar las horas arrastrando el borde, y eso
  es justamente lo que está fuera de esta tanda.

---

## 9. Los CUATRO gestos, y los cuatro salen del mismo `pointerdown`

La tanda anterior dejó tres. Usándola aparecieron dos huecos: **no se podían cambiar las horas de un
turno ya puesto**, y **un turno de una hora no se podía agarrar**.

| gesto | qué hace | cómo se distingue |
|---|---|---|
| Arrastrar a otra celda | **mover** (las horas se conservan) | se mueve > 4 px |
| Arrastrar a la papelera | **quitar** | ídem, y suelta abajo |
| **Pulsar y soltar SIN MOVER** | **editar las horas** | **se mueve < 4 px → es un clic** |
| `Supr` con la barra enfocada | **quitar** (sin ratón) | teclado |

El **umbral de 4 px** ya existía —estaba para que un temblor no se convirtiera en un arrastre— y
**es exactamente la línea que separa los dos gestos**. Solo faltaba escuchar el lado de acá: antes,
un clic era un `return` a secas.

Y el flujo de editar es **el mismo popover, el mismo previsualizar-en-vivo, el mismo candado**. No
es ahorro de código: **es que es la misma pregunta** («¿de qué hora a qué hora?»). Cero mecanismos
nuevos.

> ⚠️ **Y AL EDITAR, EL TURNO NO SE COMPARA CONSIGO MISMO.** La previsualización lleva su propio
> `assignmentId`, así que el motor lo ignora. Sin eso, cambiarle un minuto daría **siempre un solape
> imposible contra su propia versión vieja** — un aviso falso, y de los que hacen creer que la
> aplicación está rota.

> ⚠️ **Y SI LAS HORAS NO CAMBIAN, EL BOTÓN NO SE PUEDE PULSAR.** No es una optimización: guardar un
> turno idéntico pasaría por el candado, **le borraría el override** (la justificación caduca al
> mover) y volvería a preguntar si se fuerza — todo para dejarlo igual que estaba. **Un botón que no
> cambia nada pero destruye una firma es peor que uno que no hace nada.**

### Lo que se DESCARTÓ: estirar la barra arrastrando el borde

La columna de un día mide ~150 px para 24 horas → **6 PÍXELES POR HORA**. Cambiar las 20:00 por las
21:00 exigiría mover el ratón **exactamente 6 px**. Y lo peor no es que se falle: es que **se
acertaría por error** — un temblor de 6 px cambiaría un turno sin que nadie lo pidiera.

> **Escribir «21:00» es inequívoco. Arrastrar 6 px es una lotería. En una aplicación cuyo valor
> entero es la precisión, EL TECLADO GANA AL RATÓN.**

(En el zoom Día son 42 px/hora y sí sería viable. Apuntado en `PENDIENTES.md`.)

---

## 10. Lo que la tanda del uso destapó

Cinco cosas, todas encontradas **arrastrando**, no leyendo:

1. **Los dos diálogos se apilaban.** Al forzar desde el popover de horas, el popover no se cerraba:
   quedaban dos respuestas a la misma pregunta en pantalla, y **la de atrás ya no valía** (era una
   previsualización; la de encima es la decisión del candado).
2. **Silencio después de escribir.** → **Ley 18** de la matriz.
3. **`quitar` era el único gesto MUDO, y es el destructivo.** Si el servidor contestaba algo que no
   fuera 200 —un 403, un turno que otro ya había borrado—, **no pasaba nada**: el turno seguía en
   pantalla y el usuario creía haberlo quitado.
4. **El aviso de `Supr` no decía a QUIÉN.** Por la papelera sí (el arrastre lleva la persona en la
   carga); con la tecla, no. El mismo hecho contado de dos maneras según el gesto — **ley 8 rota**.
5. **El mensaje corto se comía el sujeto.** El popover decía «No cualificado para el puesto» y el
   diálogo, del mismo turno y en el mismo segundo, «No está cualificado para el puesto "Cocina"».
   **Acortar es quitar palabras, nunca quitar datos.** El nombre del puesto viaja ahora en el
   contexto de la violación: la vista no puede reconstruirlo, así que **lo manda quien lo sabe**.

Y una sexta, **que no se ve ni arrastrando ni leyendo, y solo la vio el instrumento**: el margen de
agarre que puse dentro de la barra **cegó a `pixel.mjs`** y dejó las diez leyes de la matriz visual
sin comprobar, en silencio. Ver `COTEJO-VISUAL.md` §18.

---

## 11. La app no podía escribir, y todo estaba en verde

El token CSRF salía del `<meta>`, que se renderiza una vez y **en una SPA no se refresca jamás**.
En cuanto la sesión se renovaba, **todas las peticiones daban 419** — y el cliente se lo tragaba en
silencio, porque solo miraba 200/409/422/403.

Tres arreglos, y el tercero es el que de verdad importa:

1. **El token sale de la cookie `XSRF-TOKEN`**, que Laravel reescribe en cada respuesta. Es lo que
   hace Axios; el bug fue usar `fetch` a pelo copiando el patrón de un formulario.
2. **Ninguna respuesta cae en el vacío.** 419/401 → «tu sesión ha caducado» **con botón de recargar**
   (cerrar no arreglaría nada: todo seguiría fallando). 5xx → «el servidor ha fallado». Red caída →
   «no se ha podido hablar con el servidor». Y **siempre**: «no se ha escrito nada». Va por el
   DIÁLOGO, no por un aviso que se desvanece: no ha pasado lo que el usuario pidió.
3. **La celda de destino ya no pinta verde cuando no sabe.** Ver la **ley 20**: «no sé» y «sí» eran
   el mismo píxel, y eso es el silencio falso más caro que puede cometer esta aplicación.

Y la lección, que está en `COTEJO-VISUAL.md` §19: **los tests de Laravel no pasan por CSRF** (está
desactivado en testing) y **todos mis instrumentos de navegador vuelven a entrar antes de cada
caso**, así que ninguno puede tener el token caducado. Probaban que la app funciona cuando todo va
bien. `tests/Visual/errores.mjs` prueba lo otro.
