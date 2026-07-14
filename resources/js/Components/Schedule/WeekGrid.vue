<script setup>
import { Link } from '@inertiajs/vue3';
import { computed, inject } from 'vue';
import CoverageStrip from './CoverageStrip.vue';
import PersonLane from './PersonLane.vue';
import { cartelesDe, gritadasDe, pintarBanda } from '../../composables/useMatrizVisual.js';
import { severityFill, OK_FILL } from '../../composables/useSeverity.js';

/**
 * LA REJILLA: 7 días × puestos, y EL TIEMPO EN EL EJE X.
 *
 * Medidas tomadas de la referencia renderizada: 118 px + 7×320 px, radio 11 px, celda con
 * padding 10/11/12 y un MÍNIMO de alto.
 *
 * ⚠️ EL MÍNIMO EXISTE, Y NO ES PARA QUE TODAS LAS FILAS MIDAN LO MISMO.
 *
 * Sin él, una fila sin nadie colapsa a la altura de su texto y la rejilla deja de parecer una
 * rejilla: parece un listado. Con él, el ojo conserva el ritmo de las columnas. Pero estaba
 * en 124 px —generoso para una fila con tres personas, absurdo para el Sumiller, que solo
 * tiene una etiqueta y una tira— así que baja a 92: lo justo para que la fila siga siendo una
 * fila.
 *
 * Lo que NO se hace es igualar los puestos: cada fila crece con lo que tiene dentro, y Barra
 * con tres personas es más alta que Caja con una. La uniformidad sería mentir sobre la carga.
 *
 * Este componente NO calcula ninguna regla ni toca una sola fecha. Todo llega ya
 * posicionado del servidor (TimeAxis): convertir zonas horarias en el navegador usaría la
 * zona DEL NAVEGADOR y no la del bar, y un encargado en Canarias vería el cuadrante de
 * Madrid corrido una hora. Sería una mentira dibujada.
 */
const props = defineProps({
    company: { type: Object, required: true },
    calendar: { type: Object, required: true },
    window: { type: Object, required: true },
    axis: { type: Object, required: true },
    positions: { type: Array, required: true },
    people: { type: Array, required: true },
    assignments: { type: Array, required: true },
    conceptEntries: { type: Array, required: true },
    absences: { type: Array, required: true },
    // DIFERIDA, y en el mismo grupo que las violaciones: la cobertura DEPENDE de ellas (un
    // turno imposible no cubre). null = todavía no se sabe, y NO se pinta nada.
    coverage: { type: Object, default: null },
    violations: { type: Object, default: null },
});

/* ══════════════════════════════════════════════════════════════════════════════
 * LA CAPA QUE EDITA — se INYECTA, no se crea aquí.
 *
 * El dueño del gesto es la página (Week.vue): un arrastre empieza en el panel de plantilla y acaba
 * en esta rejilla, y esos dos son hermanos. Si `edicion` es null, el que mira no puede gestionar y
 * aquí no hay ni celdas de destino ni nada que coger.
 * ══════════════════════════════════════════════════════════════════════════════ */

const edicion = inject('edicion', null);

const puedeEditar = computed(() => !! edicion);

const esDestino = (positionId, date) => edicion?.destinoActual?.value?.positionId === positionId
    && edicion?.destinoActual?.value?.date === date;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * EL COLOR DE LA CELDA DE DESTINO. Y AQUÍ VIVÍA EL PEOR BUG QUE HA TENIDO ESTA APLICACIÓN.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Esto era una línea:
 *
 *     const color = s ? severityFill(s) : '#15803D';   // ← VERDE si no hay severidad
 *
 * Y con ella, **TRES COSAS DISTINTAS SE PINTABAN CON EL MISMO PÍXEL**:
 *
 *     el servidor dijo «limpio»              → VERDE   ✔ correcto
 *     la petición VA EN VUELO, aún no llegó  → VERDE   ✘ no lo sabe: se lo está inventando
 *     la petición FALLÓ (419, 500, red)      → VERDE   ✘ el motor NI SE HA ENTERADO
 *
 * **«No sé» y «sí» eran el mismo color.** La celda decía «adelante, suelta aquí» sobre una
 * comprobación que no había ocurrido — y lo decía en el gesto que más se usa de la aplicación.
 *
 * Es exactamente el silencio falso del que este proyecto se defiende, y estaba en el sitio más caro:
 * **el cliente pintando lo que el servidor no ha confirmado.**
 *
 *     UN CANAL NO PUEDE TENER UN VALOR POR DEFECTO OPTIMISTA.
 *     SI NO SE SABE, SE DICE QUE NO SE SABE.
 *
 * Ahora hay CUATRO estados, y el gris no es un color de relleno: es una respuesta.
 *
 * ⚠️ Y sigue siendo una PREVISUALIZACIÓN. Lo que se pinta aquí NO decide si se puede soltar: al
 * soltar se vuelve a preguntar DENTRO DEL CANDADO, y esa respuesta manda aunque contradiga a esta.
 */
const GRIS = '#8A8598';

/**
 * ⚠️⚠️ QUÉ DICE LA CELDA. **UNA SOLA FUENTE**, Y ESO LO DESTAPÓ LA CONTRAPRUEBA.
 *
 * Esto y el color eran DOS FUNCIONES INDEPENDIENTES: una decidía el píxel y otra escribía el
 * `data-previa` que mide el instrumento. Y dos funciones que contestan a la misma pregunta acaban
 * divergiendo — es la ley 0 otra vez, ahora entre el código y su instrumento.
 *
 * Se vio metiendo el bug a propósito (`mutaciones-tanda9.sh`): al romper el color, **el atributo
 * seguía diciendo la verdad**. La celda se pintaba VERDE con la petición caída, y `errores.mjs`
 * daba verde… porque medía la etiqueta, no el píxel.
 *
 *     UN INSTRUMENTO QUE MIDE UNA ETIQUETA ESCRITA POR OTRO SITIO NO MIDE LO QUE SE PINTA.
 *     MIDE LO QUE ALGUIEN DICE QUE SE PINTA.
 *
 * Ahora el color SALE de aquí. No pueden discrepar.
 */
const estadoDeDestino = (positionId, date) => {
    if (! esDestino(positionId, date)) {
        return null;
    }

    const p = edicion.previa.value;

    // ⚠️ TODAVÍA NO HA CONTESTADO. No es «se puede»: es «espera». (Ley 21: el verde se gana.)
    if (! p) {
        return 'comprobando';
    }

    // ⚠️ NO SE PUDO PREGUNTAR (sesión caducada, servidor caído, red caída). Esto NO es un estado del
    // cuadrante: es una AVERÍA, y tiene que distinguirse de los cuatro colores que sí significan algo.
    if (p.fallo) {
        return 'no-se-pudo';
    }

    return p.severidad ?? 'limpio';
};

const marcaDeDestino = (positionId, date) => {
    const estado = estadoDeDestino(positionId, date);

    if (! estado) {
        return null;
    }

    if (estado === 'comprobando') {
        return {
            boxShadow: `inset 0 0 0 2px ${GRIS}`,
            background: `${GRIS}10`,
        };
    }

    // Rayado: una avería no se puede confundir con ningún estado del cuadrante.
    if (estado === 'no-se-pudo') {
        return {
            boxShadow: `inset 0 0 0 2px ${GRIS}`,
            backgroundImage: `repeating-linear-gradient(45deg, ${GRIS}33 0 4px, transparent 4px 10px)`,
        };
    }

    const color = estado === 'limpio' ? OK_FILL : severityFill(estado);

    return {
        // Un anillo POR DENTRO: no mueve ni un píxel del contenido de la celda.
        boxShadow: `inset 0 0 0 2px ${color}`,
        background: `${color}14`,
    };
};

const peopleById = computed(() => Object.fromEntries(props.people.map((p) => [p.id, p])));

const dayUrl = (date) => `/companies/${props.company.id}/calendars/${props.calendar.id}/schedule/day?day=${date}`;

/**
 * LOS CARRILES DE UNA CELDA: una línea por persona.
 *
 * En el carril entran sus turnos Y sus conceptos horarios de ese día: los dos la ocupan
 * físicamente. Así se VE que la hora médica de las 10 cae dentro del turno de 9 a 17 —el
 * conflicto se muestra, no se cuenta—. Estaban en una fila aparte y había que buscarlo.
 */
const lanesOf = (positionId, date) => {
    const turnos = props.assignments
        .filter((a) => a.positionId === positionId && a.workDate === date)
        .map((a) => ({ ...a, kind: 'shift' }));

    const dePuesto = new Set(turnos.map((t) => t.personId));

    const conceptos = props.conceptEntries
        .filter((c) => c.workDate === date && dePuesto.has(c.personId))
        .map((c) => ({ ...c, kind: 'concept' }));

    const porPersona = new Map();

    for (const b of [...turnos, ...conceptos]) {
        if (!porPersona.has(b.personId)) {
            porPersona.set(b.personId, []);
        }
        porPersona.get(b.personId).push(b);
    }

    return [...porPersona.entries()]
        .map(([personId, blocks]) => ({
            person: peopleById.value[personId],
            blocks: blocks.sort((x, y) => x.startHour - y.startHour),
        }))
        .sort((x, y) => x.blocks[0].startHour - y.blocks[0].startHour);
};

/**
 * Un concepto de alguien que ese día NO tiene turno tampoco puede desaparecer: se le da
 * carril propio.
 *
 * ⚠️ PERO EN UN PUESTO QUE ESA PERSONA PUEDA CUBRIR, no en el primero de la lista.
 *
 * Lo tenía cayendo en `positions[0]`, y la hora médica de Nuria —que es de cocina— salía
 * pintada en la fila de BARRA. La barra no la cubre nadie a esa hora, y la parrilla estaba
 * diciendo que sí había alguien de barra al médico. Un dato inventado, dibujado.
 */
const huerfanos = (positionId, date) => {
    const conTurno = new Set(
        props.assignments.filter((a) => a.workDate === date).map((a) => a.personId),
    );

    const sueltos = props.conceptEntries.filter(
        (c) => c.workDate === date
            && !conTurno.has(c.personId)
            // El primer puesto para el que SÍ está cualificada. Si no lo está para
            // ninguno, no se pinta en ninguna fila: no habría fila honesta donde ponerlo.
            && (c.eligiblePositionIds ?? [])[0] === positionId,
    );

    const porPersona = new Map();

    for (const c of sueltos) {
        if (!porPersona.has(c.personId)) {
            porPersona.set(c.personId, []);
        }
        porPersona.get(c.personId).push({ ...c, kind: 'concept' });
    }

    return [...porPersona.entries()].map(([personId, blocks]) => ({
        person: peopleById.value[personId],
        blocks,
    }));
};

const coverageOf = (positionId, date) => (props.coverage?.segments ?? []).filter(
    (s) => s.positionId === positionId && s.workDate === date,
);

/**
 * LOS CARTELES DE LA CELDA. Quién decide cuáles hay: la matriz. Aquí solo se pintan.
 *
 * ⚠️ AQUÍ HABÍA UN SILENCIO FALSO, Y LO METÍ RAZONANDO BIEN.
 *
 * Escribí que "con alguien que no puede estar ahí, la cobertura es una ficción" y escondí la
 * tira. El razonamiento era correcto y el resultado era peor que el problema: la celda de
 * Tomás se quedaba MUDA, sin verde ni rojo, cuando lo que de verdad pasaba es que FALTA
 * GENTE —él no puede estar, así que ese puesto está descubierto—. Callar no deshace el
 * hueco: lo esconde.
 *
 * ⚠️ Y EL CARTEL DICE QUÉ PASA, no una frase fija. Lo tenía cableado a "solape de la misma
 * persona", y en las celdas donde el imposible era una BAJA afirmaba un solape que no existía:
 * un aviso correcto con un motivo falso, en el cartel más grande de la pantalla.
 */
const carteles = (positionId, date) => cartelesDe(
    [
        ...props.assignments
            .filter((a) => a.positionId === positionId && a.workDate === date)
            .map((a) => ({ ...a, kind: 'shift' })),
        ...conceptosDe(positionId, date),
    ],
    props.violations,
    { sinCandidato: uncoverableIn(positionId, date) },
);

/**
 * Los conceptos que se pintan en esta celda: los de quien tiene turno aquí, más los huérfanos.
 * Sus violaciones también van al cartel — un tope de horas extra pasado PIDE una decisión igual
 * que cualquier otro incumplimiento, y hasta hoy no salía por ningún lado.
 */
const conceptosDe = (positionId, date) => {
    const dePuesto = new Set(
        props.assignments
            .filter((a) => a.positionId === positionId && a.workDate === date)
            .map((a) => a.personId),
    );

    return props.conceptEntries
        .filter((c) => c.workDate === date && dePuesto.has(c.personId))
        .map((c) => ({ ...c, kind: 'concept' }))
        .concat(huerfanos(positionId, date).flatMap((l) => l.blocks));
};

/**
 * LA BANDA DE LA BAJA, dentro del puesto y atravesando los días.
 *
 * Una baja no es de un puesto (en el modelo cuelga de la persona) pero se LEE mucho mejor
 * dentro de la fila del puesto que esa persona deja al descubierto: se ve el agujero, y se ve
 * de un tirón, cruzando los tres días.
 *
 * ⚠️ Y VA A TODAS LAS FILAS QUE ESA PERSONA PUEDE CUBRIR, QUE ES DONDE DE VERDAD DEJA EL HUECO.
 *
 * Antes la ponía en el puesto de menor id donde tuviera TURNOS, y si no tenía ninguno —que es
 * JUSTO el caso de una baja larga— caía en positions[0]. La baja de Nuria, que es de cocina,
 * salía pintada en la fila de BARRA: afirmando un agujero en un puesto que ella no cubre. Es
 * exactamente el mismo bug que ya estaba arreglado, y documentado, para los conceptos
 * huérfanos — cuarenta líneas más abajo, en este mismo fichero.
 */
const bandsOf = (positionId, date) => props.absences
    .filter((a) => (a.eligiblePositionIds ?? []).includes(positionId))
    .filter((a) => a.startsOn <= date && (a.endsOn === null || a.endsOn >= date))
    .map((a) => {
        const dias = props.window.days.map((d) => d.date);
        const cubiertos = dias.filter((d) => a.startsOn <= d && (a.endsOn === null || a.endsOn >= d));

        return {
            ...a,
            esPrimero: cubiertos[0] === date,
            esUltimo: cubiertos[cubiertos.length - 1] === date,
        };
    })
    .map((b) => ({ banda: b, ...pintarBanda(b, props.violations) }));

/** Los puestos que nadie de la plantilla puede cubrir: el badge, una vez, donde se pide. */
const uncoverableIn = (positionId, date) => coverageOf(positionId, date)
    .some((s) => s.uncoverable);

/**
 * CERRADO NO ES LO MISMO QUE NO LABORABLE, Y POR ESO NO SE PINTA POR EL CALENDARIO.
 *
 * Un bar abre en festivo con toda normalidad —y en hostelería el festivo es justo el pico de
 * carga—, así que teñir la columna porque el calendario laboral diga "no laborable" sería
 * sugerir "aquí no se trabaja" un día en el que se trabaja.
 *
 * El motor solo marca como cerrado el día que NO es laborable Y ADEMÁS no pide a nadie en
 * ningún puesto. Ese es el dato accionable; la etiqueta del calendario, no.
 */
const cerrado = (date) => (props.coverage?.closed ?? []).includes(date);

/**
 * LOS PUESTOS SON BLOQUES, NO FILAS SUELTAS.
 *
 * Barra, Cocina, Sala y Caja son cuatro cosas distintas, y hasta ahora eran una sopa
 * continua de gris y blanco: cinco bloques separados por la misma línea de 1 px que separa
 * dos columnas. Con la misma línea no se puede decir "esto es otra cosa".
 *
 * Ahora cada bloque se identifica por TRES señales a la vez, y ninguna de ellas grita:
 *   · una raya de cebra silenciosa (blanco / casi-blanco)
 *   · un borde de SECCIÓN de 2 px arriba, que pesa el doble que el de una columna
 *   · el nombre del puesto, en un raíl fijo que no se va al desplazar
 */
const esPar = (i) => i % 2 === 0;

/**
 * LAS COLUMNAS SON FLUIDAS, Y ES LO QUE HACE QUE LA SEMANA QUEPA.
 *
 * Con columnas fijas de 300 px la semana pide 2.224 px y a 1366 solo hay 1.290: faltan 934,
 * y el sábado y el domingo —el pico de carga de un bar— se quedaban escondidos detrás del
 * scroll. Con minmax(160px, 1fr) la columna se estira cuando hay sitio y se comprime cuando
 * no lo hay, y a 1366 con el panel recogido la semana entera CABE.
 *
 * ⚠️ Y AL COMPRIMIR NO SE SACRIFICA NINGÚN DATO.
 *
 * Aquí hubo un ResizeObserver que, por debajo de 200 px, escondía la hora del carril. Nació
 * de un problema real —"12:00–18:00 · 14:00–20:00" no cabe en una línea de 160 px— pero la
 * solución era rendirse. Ahora cada barra tiene SU rótulo en SU línea ("12:00–18:00" cabe de
 * sobra) y el nombre envuelve en vez de truncarse. No hay nada que esconder, así que no hace
 * falta medir nada.
 */
</script>

<template>
    <!--
        LA PARRILLA ES SU PROPIO CONTENEDOR DE SCROLL, en los dos ejes.

        Así la página no se desborda nunca, la cabecera de días se queda arriba y la columna
        de puestos se queda a la izquierda. A 1366 px no caben los siete días: sin el raíl
        fijo, al desplazarte pierdes el nombre del puesto y dejas de saber qué estás mirando.
    -->
    <!--
        LA PARRILLA MANDA EN LA ALTURA. El panel es la barra lateral y se adapta.
        Estaba al revés: el panel (diez personas) estiraba el contenedor y la parrilla —cinco
        puestos— se quedaba flotando sobre un vacío blanco enorme. El contenido define el
        alto; la barra lateral, no.

        Por eso la tarjeta tiene altura AUTOMÁTICA (crece con las filas de puestos) y solo se
        topa con max-h-full. Lo que quede por debajo es el SUELO de la página, no un hueco.
    -->
    <div class="flex min-h-0 min-w-0 flex-1 bg-page p-4">
        <!--
            ⚠️ EL REDONDEO Y EL SCROLL VAN EN EL MISMO DIV, Y LA REJILLA NO LLEVA overflow.
            Si la rejilla lleva overflow-hidden (para redondear esquinas), ELLA pasa a ser el
            contenedor de scroll y los sticky se pegan a ella en vez de a la ventana: el raíl
            de puestos desaparecía al desplazarse. Se veía al mirar, no al medir.
        -->
        <div
            class="max-h-full w-full self-start overflow-auto rounded-xl border-2 border-edge bg-card shadow-[0_2px_10px_-4px_rgb(40_36_80/18%)]"
        >
            <div
                class="w-full"
                style="display: grid; grid-template-columns: 112px repeat(7, minmax(150px, 1fr))"
            >
            <!-- Cabecera: día y fecha APILADOS. Sin regla horaria: el rango lo dice la leyenda. -->
            <div class="corner-sticky border-b-2 border-r-2 border-edge bg-rail" />

            <div
                v-for="(day, i) in window.days"
                :key="day.date"
                class="head-sticky border-b-2 border-edge bg-rail px-3 py-2.5"
                :class="i < 6 ? 'border-r border-r-line' : ''"
            >
                <Link :href="dayUrl(day.date)" class="group block">
                    <div class="text-[12.5px] font-bold text-ink group-hover:text-brand-600">
                        {{ day.weekday }}
                    </div>
                    <div class="tabular text-[10px] text-ink-faint">
                        {{ day.label }}
                        <span v-if="day.holiday" class="font-semibold text-brand-600">· {{ day.holiday }}</span>
                    </div>
                </Link>
            </div>

            <!--
                LOS PUESTOS, COMO BLOQUES.

                Tres señales silenciosas para que se vea dónde empieza y acaba cada uno:
                cebra, borde de SECCIÓN de 2 px arriba, y el nombre en un raíl fijo.
            -->
            <template v-for="(position, p) in positions" :key="position.id">
                <div
                    class="rail-sticky flex items-center border-r-2 border-edge px-3 py-2.5 text-[13px] font-bold text-ink"
                    :class="[
                        p > 0 ? 'border-t-2 border-t-edge' : '',
                        esPar(p) ? 'bg-rail' : 'bg-[#EBE9F3]',
                    ]"
                >
                    {{ position.name }}
                </div>

                <div
                    v-for="(day, i) in window.days"
                    :key="`${position.id}-${day.date}`"
                    data-t="celda"
                    :data-celda="`${position.name}|${day.date}`"
                    :data-celda-destino="puedeEditar ? '' : null"
                    :data-position-id="position.id"
                    :data-date="day.date"
                    :data-previa="estadoDeDestino(position.id, day.date)"
                    class="relative flex min-h-[92px] flex-col"
                    :class="[
                        i < 6 ? 'border-r border-line' : '',
                        p > 0 ? 'border-t-2 border-t-edge' : '',
                        esPar(p) ? 'bg-card' : 'bg-band',
                    ]"
                    style="padding: 10px 11px 12px"
                    :style="marcaDeDestino(position.id, day.date)"
                >
                    <!--
                        LA BANDA DE LA BAJA: atraviesa los días, rotula solo en el primero.

                        La trama dice que BLOQUEA la disponibilidad (unas vacaciones y una
                        formación se pintaban idénticas); el desvanecido de la derecha dice que
                        NO TIENE ALTA todavía — antes se pintaba igual que una baja que
                        simplemente continúa la semana que viene.
                    -->
                    <template v-for="b in bandsOf(position.id, day.date)" :key="b.banda.id">
                        <div
                            data-t="banda"
                            :data-persona="peopleById[b.banda.personId]?.name"
                            :data-abierta="b.abierta"
                            class="mb-[5px] flex h-4 items-center overflow-hidden whitespace-nowrap px-[7px] text-[9.5px] font-bold text-brand-800"
                            :style="b.estilo"
                        >
                            {{ b.banda.esPrimero ? `${peopleById[b.banda.personId]?.name} · ${b.banda.name}${b.sufijo}` : '' }}
                        </div>

                        <!-- Sus violaciones, que hasta hoy no se pintaban en ninguna parte. -->
                        <div
                            v-for="(nota, i) in (b.banda.esPrimero ? b.notas : [])"
                            :key="i"
                            data-t="nota"
                            class="mb-[5px] break-words text-[9.5px] font-semibold leading-tight"
                            :style="{ color: nota.color }"
                        >{{ nota.text }}</div>
                    </template>

                    <!--
                        ⚠️ LOS CARTELES SE APILAN. Eran `v-if` / `v-else-if`, y una celda que era
                        las DOS cosas —imposible Y sin candidato— enseñaba solo la primera. Son
                        hechos independientes: uno está en el cuadrante, el otro en el catálogo.
                        Callar uno porque hay otro es esconder un dato.

                        Y ahora TODO lo que pide una decisión lleva cartel, no solo el imposible:
                        rojo (imposible) · naranja (incumplimiento) · gris (sin candidato). Lo que
                        solo INFORMA —una hora médica, una baja, un "trabaja en otra empresa"— no
                        lleva, porque un cuadrante en llamas no impresiona: alarma, y se ignora.
                    -->
                    <div
                        v-for="cartel in carteles(position.id, day.date)"
                        :key="cartel.severidad"
                        data-t="cartel"
                        :data-severidad="cartel.severidad"
                        class="mb-1.5 inline-block w-fit rounded px-[7px] py-[3px] text-[9px] font-bold tracking-[.02em] text-white"
                        :style="{ background: cartel.bg }"
                    >
                        {{ cartel.texto }}
                    </div>

                    <div
                        v-if="cerrado(day.date)"
                        data-t="cerrado"
                        class="mb-1.5 inline-block w-fit rounded border border-line bg-sunken px-[7px] py-[3px] text-[9px] font-bold text-ink-soft"
                    >
                        Cerrado
                    </div>

                    <!--
                        El hueco ENTRE personas (12 px) es muy mayor que el hueco entre las
                        líneas de una misma persona (3 px). El ojo agrupa por proximidad antes
                        que por cualquier otra cosa, así que la distancia TIENE que decir la
                        verdad sobre quién va con quién.
                    -->
                    <div class="flex flex-col gap-4">
                        <PersonLane
                            v-for="lane in lanesOf(position.id, day.date)"
                            :key="lane.person.id"
                            :person="lane.person"
                            :blocks="lane.blocks"
                            :axis="axis"
                            :violations="violations"
                            :gritadas="gritadasDe(carteles(position.id, day.date))"
                        />

                        <PersonLane
                            v-for="lane in huerfanos(position.id, day.date)"
                            :key="`h-${lane.person.id}`"
                            :person="lane.person"
                            :blocks="lane.blocks"
                            :axis="axis"
                            :violations="violations"
                            :gritadas="gritadasDe(carteles(position.id, day.date))"
                        />
                    </div>

                    <div class="flex-1" />

                    <!--
                        LA TIRA SE PINTA TAMBIÉN EN LA CELDA IMPOSIBLE, y sobre todo ahí: es
                        donde el hueco es más real y donde antes la celda se quedaba muda.

                        Solo se calla donde no se pide gente NI hay nadie: una tira gris vacía
                        no informa de nada y llena la rejilla de ruido.

                        ⚠️ Y VA CON LA MISMA SANGRÍA QUE LAS PISTAS (18 px: 7 de margen + 2 de
                        filo + 9 de aire). EL EJE X ES UNO SOLO PARA TODA LA CELDA.

                        Al indentar los carriles bajo su nombre, las pistas se movieron 18 px a
                        la derecha y la tira se quedó donde estaba: las 15:00 de la barra de
                        Tomás dejaron de caer sobre las 15:00 de su hueco. El eje mentía por
                        18 px, y con él la única lectura que esta parrilla presume de dar sin
                        leer — la vertical: "aquí falta gente justo a esta hora".
                    -->
                    <div v-if="coverageOf(position.id, day.date).length" class="ml-[18px] mt-[9px]">
                        <CoverageStrip :segments="coverageOf(position.id, day.date)" :axis="axis" />
                    </div>
                </div>
            </template>
            </div>
        </div>

    </div>
</template>
