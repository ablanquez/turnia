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
    coverage: { type: Object, required: true },
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

const coverageOf = (positionId, date) => props.coverage.segments.filter(
    (s) => s.positionId === positionId && s.workDate === date,
);

/**
 * El imposible de la celda: se GRITA, y la tira de cobertura DESAPARECE.
 *
 * Con alguien que no puede estar ahí —porque se solapa consigo mismo, o porque está de
 * baja— la cobertura calculada es una ficción: cuenta a quien no puede cubrir. Enseñar un
 * número derivado de un estado imposible es darle apariencia de dato.
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
    .some((s) => s.state === 'uncoverable');
</script>

<template>
    <div class="min-w-0 flex-1 overflow-x-auto py-4 pl-5 pr-3">
        <div
            class="w-max overflow-hidden border border-line bg-white"
            style="display: grid; grid-template-columns: 118px repeat(7, 320px); border-radius: 11px"
        >
            <!-- Cabecera: día y fecha APILADOS, como la referencia. Sin regla horaria: el
                 rango lo dice la leyenda, y así se validó. -->
            <div class="border-b border-r border-line-soft bg-[#FAFAFD]" />

            <div
                v-for="(day, i) in window.days"
                :key="day.date"
                class="border-b border-line-soft px-3 py-2.5"
                :class="[
                    i < 6 ? 'border-r' : '',
                    day.isWorkingDay ? 'bg-[#FAFAFD]' : 'bg-[#F3F2F8]',
                ]"
            >
                <Link :href="dayUrl(day.date)" class="group block">
                    <div class="text-[12.5px] font-bold text-[#41404E] group-hover:text-brand-600">
                        {{ day.weekday }}
                    </div>
                    <div class="tabular text-[10px] text-ink-faint">
                        {{ day.label }}
                        <span v-if="day.holiday" class="font-semibold text-brand-600">· {{ day.holiday }}</span>
                    </div>
                </Link>
            </div>

            <!-- Los puestos -->
            <template v-for="position in positions" :key="position.id">
                <div class="flex items-center border-b border-r border-line-soft bg-[#FAFAFD] px-2.5 py-2.5 text-[13px] font-bold text-[#41404E]">
                    {{ position.name }}
                </div>

                <div
                    v-for="(day, i) in window.days"
                    :key="`${position.id}-${day.date}`"
                    class="relative flex min-h-[124px] flex-col border-b border-line-soft"
                    :class="i < 6 ? 'border-r' : ''"
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
                        class="mb-1.5 inline-block w-fit rounded bg-impossible px-[7px] py-[3px] text-[9px] font-bold tracking-[.02em] text-white"
                    >
                        {{ impossibleIn(position.id, day.date) }}
                    </div>

                    <div
                        v-else-if="uncoverableIn(position.id, day.date)"
                        class="mb-1.5 inline-block w-fit rounded bg-[#5A5A66] px-[7px] py-[3px] text-[9px] font-bold text-white"
                    >
                        Sin candidato en catálogo
                    </div>

                    <div class="flex flex-col gap-2">
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
                        Con un imposible dentro, la cobertura es una ficción: no se pinta.
                        Y donde no se pide gente ni hay nadie, tampoco: una tira gris vacía no
                        informa de nada y llena la rejilla de ruido.
                    -->
                    <div
                        v-if="!impossibleIn(position.id, day.date) && coverageOf(position.id, day.date).length"
                        class="mt-[9px]"
                    >
                        <CoverageStrip :segments="coverageOf(position.id, day.date)" :axis="axis" />
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>
