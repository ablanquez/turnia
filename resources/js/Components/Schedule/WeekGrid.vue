<script setup>
import { computed } from 'vue';
import CoverageStrip from './CoverageStrip.vue';
import PersonLane from './PersonLane.vue';

/**
 * LA REJILLA: 7 días × puestos, y el TIEMPO EN EL EJE X.
 *
 * Este componente NO calcula ninguna regla ni toca una sola fecha. Todo llega ya
 * posicionado del servidor (TimeAxis), porque convertir zonas horarias en el
 * navegador usaría la zona DEL NAVEGADOR y no la del bar: un encargado en Canarias
 * vería el cuadrante de Madrid corrido una hora. Sería una mentira dibujada.
 *
 * Aquí solo se agrupa y se pinta.
 */
const props = defineProps({
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

const peopleById = computed(() =>
    Object.fromEntries(props.people.map((p) => [p.id, p])),
);

/** Los puestos que nadie de la plantilla puede cubrir. */
const uncoverablePositions = computed(() => {
    const set = new Set();

    for (const conflict of props.coverage.conflicts) {
        if (conflict.code === 'uncoverable_position' && conflict.context?.position_id) {
            set.add(conflict.context.position_id);
        }
    }

    return set;
});

/** Los carriles de una celda: una línea por persona, ordenadas por hora de entrada. */
const lanesOf = (positionId, date) => {
    const enCelda = props.assignments.filter(
        (a) => a.positionId === positionId && a.workDate === date,
    );

    const porPersona = new Map();

    for (const a of enCelda) {
        if (!porPersona.has(a.personId)) {
            porPersona.set(a.personId, []);
        }
        porPersona.get(a.personId).push(a);
    }

    return [...porPersona.entries()]
        .map(([personId, blocks]) => ({
            person: peopleById.value[personId],
            blocks: blocks.sort((x, y) => x.startHour - y.startHour),
        }))
        .sort((x, y) => x.blocks[0].startHour - y.blocks[0].startHour);
};

const coverageOf = (positionId, date) =>
    props.coverage.segments.filter(
        (s) => s.positionId === positionId && s.workDate === date,
    );

/** Los conceptos horarios de un día: ocupan a la persona pero no cubren puesto. */
const conceptsOf = (date) => {
    const delDia = props.conceptEntries.filter((c) => c.workDate === date);
    const porPersona = new Map();

    for (const c of delDia) {
        if (!porPersona.has(c.personId)) {
            porPersona.set(c.personId, []);
        }
        porPersona.get(c.personId).push(c);
    }

    return [...porPersona.entries()].map(([personId, blocks]) => ({
        person: peopleById.value[personId],
        blocks: blocks.sort((x, y) => x.startHour - y.startHour),
    }));
};

/** Las ausencias vigentes ese día. Bloquean el día entero: no tienen hora. */
const absencesOf = (date) =>
    props.absences.filter(
        (a) => a.startsOn <= date && (a.endsOn === null || a.endsOn >= date),
    );

const hayConceptos = computed(() => props.conceptEntries.length > 0);
const hayAusencias = computed(() => props.absences.length > 0);
</script>

<template>
    <div class="overflow-x-auto py-4 pl-5 pr-2">
        <div
            class="w-max overflow-hidden rounded-xl border border-[--color-line] bg-white"
            style="display: grid; grid-template-columns: 118px repeat(7, 320px)"
        >
            <!-- Cabecera: los días -->
            <div class="border-b border-r border-[--color-line-soft] bg-[#FAFAFD]" />

            <div
                v-for="day in window.days"
                :key="day.date"
                class="border-b border-r border-[--color-line-soft] bg-[#FAFAFD] px-3 py-2.5"
                :class="{ 'bg-[#F3F2F8]': !day.isWorkingDay }"
            >
                <div class="text-[12.5px] font-bold text-[#41404E]">{{ day.weekday }}</div>
                <div class="tabular text-[10px] text-[--color-ink-faint]">
                    {{ day.label }}
                    <span v-if="day.holiday" class="font-semibold text-[--color-brand-600]">
                        · {{ day.holiday }}
                    </span>
                </div>
            </div>

            <!--
                AUSENCIAS EN SU PROPIA FILA, y no dentro del puesto.

                Una baja no es de un puesto: es de la persona, y le impide cubrir
                cualquiera. Meterla en la fila de "barra" porque Ana suele estar en barra
                sería inventarse una relación que no existe en el modelo.
            -->
            <template v-if="hayAusencias">
                <div
                    class="flex items-center border-b border-r border-[--color-line-soft] bg-[#FAFAFD] px-2.5 py-2.5 text-[13px] font-bold text-[#41404E]"
                >
                    Ausencias
                </div>

                <div
                    v-for="day in window.days"
                    :key="`abs-${day.date}`"
                    class="flex flex-col gap-1 border-b border-r border-[--color-line-soft] px-2.5 py-2.5"
                >
                    <div
                        v-for="absence in absencesOf(day.date)"
                        :key="absence.id"
                        class="flex items-center gap-1.5 truncate rounded px-1.5 py-1 text-[9.5px] font-bold"
                        style="background: rgba(60,52,137,.13); color: #3C3489"
                    >
                        <span
                            class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7px] text-white"
                            :style="{ background: peopleById[absence.personId]?.color }"
                        >{{ peopleById[absence.personId]?.initials }}</span>
                        {{ peopleById[absence.personId]?.name }} · {{ absence.name }}
                    </div>
                </div>
            </template>

            <!--
                CONCEPTOS HORARIOS EN SU PROPIA FILA.

                Ocupan a la persona (por eso salen en el mismo eje, alineados con sus
                turnos: se VE que la hora médica de las 10 cae dentro del turno de 9 a 17)
                pero NO cubren puesto, así que no pueden vivir en la fila de un puesto ni
                contar en la cobertura.
            -->
            <template v-if="hayConceptos">
                <div
                    class="flex items-center border-b border-r border-[--color-line-soft] bg-[#FAFAFD] px-2.5 py-2.5 text-[13px] font-bold text-[#41404E]"
                >
                    Conceptos
                </div>

                <div
                    v-for="day in window.days"
                    :key="`con-${day.date}`"
                    class="flex flex-col gap-2 border-b border-r border-[--color-line-soft] px-2.5 py-2.5"
                >
                    <div v-for="lane in conceptsOf(day.date)" :key="lane.person.id">
                        <div class="flex items-center gap-1.5">
                            <span
                                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7.5px] font-semibold text-white"
                                :style="{ background: lane.person.color }"
                            >{{ lane.person.initials }}</span>
                            <span class="shrink-0 text-xs font-semibold text-[--color-ink]">
                                {{ lane.person.name }}
                            </span>
                            <span class="tabular min-w-0 flex-1 truncate text-[10px] text-[#8A8896]">
                                {{ lane.blocks.map((b) => `${b.name} ${b.label}`).join(' · ') }}
                            </span>
                        </div>

                        <div class="relative mt-0.5 h-2 overflow-hidden rounded bg-[#F1F0F6]">
                            <!-- Rayado y con borde discontinuo: NO cubre puesto. -->
                            <div
                                v-for="block in lane.blocks"
                                :key="block.id"
                                :style="{
                                    position: 'absolute',
                                    left: `${block.left}%`,
                                    width: `${block.width}%`,
                                    top: 0,
                                    bottom: 0,
                                    borderRadius: '3px',
                                    border: '1.5px dashed #7F77DD',
                                    background: 'repeating-linear-gradient(45deg,#F3F2FC 0 4px,#FFFFFF 4px 8px)',
                                    boxSizing: 'border-box',
                                }"
                            />
                        </div>
                    </div>
                </div>
            </template>

            <!-- Los puestos -->
            <template v-for="position in positions" :key="position.id">
                <div
                    class="flex items-center border-b border-r border-[--color-line-soft] bg-[#FAFAFD] px-2.5 py-2.5 text-[13px] font-bold text-[#41404E]"
                >
                    {{ position.name }}
                </div>

                <div
                    v-for="day in window.days"
                    :key="`${position.id}-${day.date}`"
                    class="relative min-h-[124px] border-b border-r border-[--color-line-soft] px-2.5 pb-3 pt-2.5"
                >
                    <div class="flex flex-col gap-2">
                        <PersonLane
                            v-for="lane in lanesOf(position.id, day.date)"
                            :key="lane.person.id"
                            :person="lane.person"
                            :blocks="lane.blocks"
                            :violations-by-id="violations?.assignments ?? null"
                        />
                    </div>

                    <div class="mt-2.5">
                        <CoverageStrip
                            :segments="coverageOf(position.id, day.date)"
                            :uncoverable="uncoverablePositions.has(position.id)"
                        />
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>
