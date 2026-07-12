<script setup>
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import CoverageStrip from './CoverageStrip.vue';
import PersonLane from './PersonLane.vue';

/**
 * LA REJILLA: 7 días × puestos, y EL TIEMPO EN EL EJE X.
 *
 * Este componente NO calcula ninguna regla ni toca una sola fecha. Todo llega ya
 * posicionado del servidor (TimeAxis): convertir zonas horarias en el navegador usaría la
 * zona DEL NAVEGADOR y no la del bar, y un encargado en Canarias vería el cuadrante de
 * Madrid corrido una hora. Sería una mentira dibujada.
 *
 * Aquí solo se agrupa y se pinta.
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

const uncoverablePositions = computed(() => {
    const set = new Set();

    for (const conflict of props.coverage.conflicts) {
        if (conflict.code === 'uncoverable_position' && conflict.context?.position_id) {
            set.add(conflict.context.position_id);
        }
    }

    return set;
});

/** Los carriles de una celda: UNA LÍNEA POR PERSONA, ordenadas por hora de entrada. */
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
            blocks: blocks.slice().sort((x, y) => x.startHour - y.startHour),
        }))
        .sort((x, y) => x.blocks[0].startHour - y.blocks[0].startHour);
};

const coverageOf = (positionId, date) => props.coverage.segments.filter(
    (s) => s.positionId === positionId && s.workDate === date,
);

/** El solape de la misma persona hay que GRITARLO, no dejarlo en un puntito. */
const impossibleIn = (positionId, date) => {
    if (!props.violations) {
        return false;
    }

    return props.assignments.some(
        (a) => a.positionId === positionId
            && a.workDate === date
            && (props.violations.assignments[a.id] ?? []).some((v) => v.severity === 'impossible'),
    );
};

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
        blocks: blocks.slice().sort((x, y) => x.startHour - y.startHour),
    }));
};

const absencesOf = (date) => props.absences.filter(
    (a) => a.startsOn <= date && (a.endsOn === null || a.endsOn >= date),
);

const gridSize = computed(() => `${100 / ((props.axis.to - props.axis.from) / 6)}% 100%`);

const hayConceptos = computed(() => props.conceptEntries.length > 0);
const hayAusencias = computed(() => props.absences.length > 0);
</script>

<template>
    <div class="min-w-0 flex-1 overflow-x-auto py-4 pl-5 pr-3">
        <div
            class="w-max overflow-hidden rounded-xl border border-line bg-white"
            style="display: grid; grid-template-columns: 130px repeat(7, 320px)"
        >
            <!-- Cabecera: los días, cada uno con su regla horaria. -->
            <div class="border-b border-r border-line-soft bg-[#FAFAFD]" />

            <div
                v-for="day in window.days"
                :key="day.date"
                class="border-b border-r border-line-soft px-3 pb-1 pt-2.5"
                :class="day.isWorkingDay ? 'bg-[#FAFAFD]' : 'bg-[#F3F2F8]'"
            >
                <Link :href="dayUrl(day.date)" class="group flex items-baseline gap-1.5">
                    <span class="text-[12.5px] font-bold text-[#41404E] group-hover:text-brand-600">
                        {{ day.weekday }}
                    </span>
                    <span class="tabular text-[10px] text-ink-faint">{{ day.label }}</span>
                    <span
                        v-if="day.holiday"
                        class="truncate text-[9.5px] font-semibold text-brand-600"
                    >· {{ day.holiday }}</span>
                </Link>

                <!-- La regla horaria: las mismas marcas que separan las pistas de abajo. -->
                <div class="tabular relative mt-1 h-3 text-[9px] text-[#B7B5C4]">
                    <span
                        v-for="tick in axis.ticks"
                        :key="tick.hour"
                        class="absolute -translate-x-1/2"
                        :style="{ left: `${tick.percent}%` }"
                    >{{ tick.label }}</span>
                </div>
            </div>

            <!--
                AUSENCIAS EN SU PROPIA FILA, y no dentro de un puesto.

                Una baja no es de un puesto: es de la persona, y le impide cubrir
                cualquiera. Meterla en la fila de "barra" porque Ana suele estar en barra
                sería inventarse una relación que no existe en el modelo.
            -->
            <template v-if="hayAusencias">
                <div class="flex items-center border-b border-r border-line-soft bg-[#FAFAFD] px-3 py-2.5 text-[12px] font-bold text-[#41404E]">
                    Ausencias
                </div>

                <div
                    v-for="day in window.days"
                    :key="`abs-${day.date}`"
                    class="flex flex-col gap-1 border-b border-r border-line-soft px-2.5 py-2.5"
                >
                    <div
                        v-for="absence in absencesOf(day.date)"
                        :key="absence.id"
                        class="flex items-center gap-1.5 rounded px-1.5 py-1 text-[9.5px] font-bold"
                        style="background: rgba(60,52,137,.13); color: #3C3489"
                    >
                        <span
                            class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] text-white"
                            :style="{ background: peopleById[absence.personId]?.color }"
                        >{{ peopleById[absence.personId]?.initials }}</span>
                        <span class="truncate">
                            {{ peopleById[absence.personId]?.name }} · {{ absence.name }}
                        </span>
                    </div>
                </div>
            </template>

            <!--
                CONCEPTOS HORARIOS EN SU PROPIA FILA.

                Ocupan a la persona (por eso van en el MISMO eje: mirando la columna se ve
                que la hora médica de las 10 cae dentro del turno de 9 a 17) pero NO
                cubren puesto, así que no pueden vivir en la fila de un puesto ni contar
                en la cobertura.
            -->
            <template v-if="hayConceptos">
                <div class="flex items-center border-b border-r border-line-soft bg-[#FAFAFD] px-3 py-2.5 text-[12px] font-bold text-[#41404E]">
                    Conceptos
                </div>

                <div
                    v-for="day in window.days"
                    :key="`con-${day.date}`"
                    class="flex flex-col gap-2 border-b border-r border-line-soft px-2.5 py-2.5"
                >
                    <div v-for="lane in conceptsOf(day.date)" :key="lane.person.id">
                        <div class="flex items-center gap-1.5">
                            <span
                                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7.5px] font-semibold text-white"
                                :style="{ background: lane.person.color }"
                            >{{ lane.person.initials }}</span>
                            <span class="shrink-0 whitespace-nowrap text-[12px] font-semibold text-ink">
                                {{ lane.person.name }}
                            </span>
                            <span class="tabular shrink-0 whitespace-nowrap text-[10px] text-[#8A8896]">
                                {{ lane.blocks.map((b) => b.label).join('  ·  ') }}
                            </span>
                        </div>

                        <div
                            class="relative mt-1 h-2 overflow-hidden rounded"
                            :style="{
                                background: '#F1F0F6',
                                backgroundImage: 'linear-gradient(90deg,#E4E3EC 1px,transparent 1px)',
                                backgroundSize: gridSize,
                            }"
                        >
                            <!-- Discontinua: ocupa a la persona, pero NO cubre puesto. -->
                            <div
                                v-for="block in lane.blocks"
                                :key="block.id"
                                :style="{
                                    position: 'absolute',
                                    left: `${block.left}%`,
                                    width: `${block.width}%`,
                                    minWidth: '4px',
                                    top: 0,
                                    bottom: 0,
                                    borderRadius: '3px',
                                    border: '1.5px dashed #7F77DD',
                                    background: 'repeating-linear-gradient(45deg,#F3F2FC 0 4px,#FFFFFF 4px 8px)',
                                    boxSizing: 'border-box',
                                }"
                            />
                        </div>

                        <div class="mt-1 text-[9.5px] font-semibold text-brand-600">
                            {{ lane.blocks.map((b) => b.name).join(' · ') }} — no cubre puesto
                        </div>
                    </div>
                </div>
            </template>

            <!-- Los puestos -->
            <template v-for="position in positions" :key="position.id">
                <div class="flex items-center border-b border-r border-line-soft bg-[#FAFAFD] px-3 py-2.5 text-[13px] font-bold text-[#41404E]">
                    {{ position.name }}
                </div>

                <div
                    v-for="day in window.days"
                    :key="`${position.id}-${day.date}`"
                    class="relative flex min-h-[124px] flex-col border-b border-r border-line-soft px-2.5 pb-3 pt-2.5"
                >
                    <div
                        v-if="impossibleIn(position.id, day.date)"
                        class="mb-1.5 w-fit rounded bg-impossible px-1.5 py-0.5 text-[9px] font-bold text-white"
                    >
                        IMPOSIBLE
                    </div>

                    <div class="flex flex-col gap-2.5">
                        <PersonLane
                            v-for="lane in lanesOf(position.id, day.date)"
                            :key="lane.person.id"
                            :person="lane.person"
                            :blocks="lane.blocks"
                            :axis="axis"
                            :violations-by-id="violations?.assignments ?? null"
                        />
                    </div>

                    <div class="flex-1" />

                    <div class="mt-2.5">
                        <CoverageStrip
                            :segments="coverageOf(position.id, day.date)"
                            :axis="axis"
                            :uncoverable="uncoverablePositions.has(position.id)"
                        />
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>
