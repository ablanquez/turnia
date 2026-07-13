<script setup>
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import CoverageStrip from './CoverageStrip.vue';
import PersonLane from './PersonLane.vue';

/**
 * LA REJILLA: 7 días × puestos, y EL TIEMPO EN EL EJE X.
 *
 * Medidas tomadas de la referencia renderizada: 118 px + 7×320 px, radio 11 px, celda con
 * padding 10/11/12 y un MÍNIMO de 124 px de alto (sin él, las celdas vacías se encogen y
 * la rejilla pierde el ritmo: deja de parecer una rejilla y parece un listado).
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
 * El imposible de la celda: se GRITA. Y LA TIRA DE COBERTURA SIGUE AHÍ.
 *
 * ⚠️ AQUÍ HABÍA UN SILENCIO FALSO, Y LO METÍ RAZONANDO BIEN.
 *
 * Escribí que "con alguien que no puede estar ahí, la cobertura es una ficción" y la
 * escondí. El razonamiento era correcto y el resultado era peor que el problema: la celda
 * de Tomás se quedaba MUDA, sin verde ni rojo, cuando lo que de verdad pasaba es que FALTA
 * GENTE —él no puede estar, así que ese puesto está descubierto—. Callar no deshace el
 * hueco: lo esconde.
 *
 * La ficción se arregló donde nacía: el motor ya no cuenta como cobertura un turno
 * imposible. Ahora el número es el REAL, y por eso se pinta.
 *
 * ⚠️ Y EL BADGE DICE QUÉ ES IMPOSIBLE, no una frase fija.
 *
 * Lo tenía cableado a "solape de la misma persona", y en las celdas donde el imposible era
 * una BAJA el cartel afirmaba un solape que no existía. Un aviso correcto con un motivo
 * falso: exactamente el fallo que llevamos siete tandas cazando, y lo metí yo en el cartel
 * más grande de la pantalla.
 */
const impossibleIn = (positionId, date) => {
    if (!props.violations) {
        return null;
    }

    const motivos = props.assignments
        .filter((a) => a.positionId === positionId && a.workDate === date)
        .flatMap((a) => props.violations.assignments[a.id] ?? [])
        .filter((v) => v.severity === 'impossible');

    if (!motivos.length) {
        return null;
    }

    const razon = [...new Set(motivos.map((v) => IMPOSIBLE[v.code] ?? 'no se puede colocar'))];

    return `IMPOSIBLE · ${razon.join(' · ')}`;
};

const IMPOSIBLE = {
    overlap: 'solape de la misma persona',
    unavailable: 'la persona está ausente',
    contract_inactive: 'fuera de la vigencia del contrato',
    invalid_interval: 'intervalo imposible',
    shift_too_long: 'más de 24 horas',
};

/**
 * LA BANDA DE LA BAJA, dentro del puesto y atravesando los días.
 *
 * Una baja no es de un puesto (en el modelo cuelga de la persona) pero se LEE mucho mejor
 * dentro de la fila del puesto que esa persona deja al descubierto: se ve el agujero, y se
 * ve de un tirón, cruzando los tres días. La saqué a una fila propia y me equivoqué: tenía
 * razón en el modelo y estaba equivocado en la lectura.
 *
 * La fila elegida es la del puesto donde esa persona tiene turnos esa semana.
 */
const bandRowOf = (personId) => {
    const suyos = props.assignments
        .filter((a) => a.personId === personId)
        .map((a) => a.positionId);

    return suyos.length ? Math.min(...suyos) : props.positions[0]?.id;
};

const bandsOf = (positionId, date) => props.absences
    .filter((a) => bandRowOf(a.personId) === positionId)
    .filter((a) => a.startsOn <= date && (a.endsOn === null || a.endsOn >= date))
    .map((a) => {
        const dias = props.window.days.map((d) => d.date);
        const cubiertos = dias.filter((d) => a.startsOn <= d && (a.endsOn === null || a.endsOn >= d));

        return {
            ...a,
            esPrimero: cubiertos[0] === date,
            esUltimo: cubiertos[cubiertos.length - 1] === date,
        };
    });

const bandStyle = (b) => ({
    background: 'rgba(60,52,137,.13)',
    border: '1px solid rgba(60,52,137,.28)',
    borderLeftWidth: b.esPrimero ? '1px' : '0',
    borderRightWidth: b.esUltimo ? '1px' : '0',
    borderRadius: b.esPrimero && b.esUltimo ? '5px'
        : b.esPrimero ? '5px 0 0 5px'
            : b.esUltimo ? '0 5px 5px 0'
                : '0',
});

/** Los puestos que nadie de la plantilla puede cubrir: el badge, una vez, donde se pide. */
const uncoverableIn = (positionId, date) => coverageOf(positionId, date)
    .some((s) => s.uncoverable);

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
                style="display: grid; grid-template-columns: 124px repeat(7, minmax(160px, 1fr))"
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
                    class="relative flex min-h-[124px] flex-col"
                    :class="[
                        i < 6 ? 'border-r border-line' : '',
                        p > 0 ? 'border-t-2 border-t-edge' : '',
                        esPar(p) ? 'bg-card' : 'bg-band',
                    ]"
                    style="padding: 10px 11px 12px"
                >
                    <!-- La banda de la baja: atraviesa los días, rotula solo en el primero. -->
                    <div
                        v-for="b in bandsOf(position.id, day.date)"
                        :key="b.id"
                        class="mb-[5px] flex h-4 items-center overflow-hidden whitespace-nowrap px-[7px] text-[9.5px] font-bold text-brand-800"
                        :style="bandStyle(b)"
                    >
                        {{ b.esPrimero ? `${peopleById[b.personId]?.name} · ${b.name}` : '' }}
                    </div>

                    <div
                        v-if="impossibleIn(position.id, day.date)"
                        data-t="imposible"
                        class="mb-1.5 inline-block w-fit rounded bg-impossible px-[7px] py-[3px] text-[9px] font-bold tracking-[.02em] text-white"
                    >
                        {{ impossibleIn(position.id, day.date) }}
                    </div>

                    <div
                        v-else-if="uncoverableIn(position.id, day.date)"
                        data-t="sin-candidato"
                        class="mb-1.5 inline-block w-fit rounded bg-[#5A5A66] px-[7px] py-[3px] text-[9px] font-bold text-white"
                    >
                        Sin candidato en catálogo
                    </div>

                    <!--
                        El hueco ENTRE personas (12 px) es muy mayor que el hueco entre las
                        líneas de una misma persona (3 px). El ojo agrupa por proximidad antes
                        que por cualquier otra cosa, así que la distancia TIENE que decir la
                        verdad sobre quién va con quién.
                    -->
                    <div class="flex flex-col gap-3">
                        <PersonLane
                            v-for="lane in lanesOf(position.id, day.date)"
                            :key="lane.person.id"
                            :person="lane.person"
                            :blocks="lane.blocks"
                            :axis="axis"
                            :violations-by-id="violations?.assignments ?? null"
                        />

                        <PersonLane
                            v-for="lane in huerfanos(position.id, day.date)"
                            :key="`h-${lane.person.id}`"
                            :person="lane.person"
                            :blocks="lane.blocks"
                            :axis="axis"
                            :violations-by-id="violations?.assignments ?? null"
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
