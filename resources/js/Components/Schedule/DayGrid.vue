<script setup>
import { computed } from 'vue';
import { severityColor, worst } from '../../composables/useSeverity.js';

/**
 * EL ZOOM DÍA. La vista donde la COBERTURA POR SEGMENTOS por fin se lee.
 *
 * En la semana, un día ocupa 320px: el "faltan 3 de 12 a 14, faltan 2 de 14 a 16" cabe,
 * pero apretado. Aquí el día ocupa el ancho entero, así que cada tramo tiene su anchura
 * REAL sobre el eje y su etiqueta completa. Es donde se ve que el motor NO dice "falta
 * gente toda la tarde" —que sería un aviso falso— sino exactamente dónde y cuánta.
 *
 * Y con sitio de sobra, el nombre y la hora van COMPLETOS dentro de la barra. Truncar es
 * ilegible: "Hu…" puede ser Hugo o Humberto, y en un cuadrante eso es un error de
 * plantilla esperando a ocurrir.
 */
const props = defineProps({
    day: { type: Object, required: true },
    axis: { type: Object, required: true },
    positions: { type: Array, required: true },
    people: { type: Array, required: true },
    assignments: { type: Array, required: true },
    conceptEntries: { type: Array, required: true },
    absences: { type: Array, required: true },
    coverage: { type: Object, required: true },
    violations: { type: Object, default: null },
});

const LANE_H = 30;
const LANE_GAP = 3;

const peopleById = computed(() => Object.fromEntries(props.people.map((p) => [p.id, p])));

const uncoverable = computed(() => {
    const set = new Set();
    for (const c of props.coverage.conflicts) {
        if (c.code === 'uncoverable_position' && c.context?.position_id) {
            set.add(c.context.position_id);
        }
    }
    return set;
});

/**
 * Reparte las barras en carriles para que NINGUNA tape a otra.
 *
 * Si dos turnos de la misma persona se solapan (el imposible que el motor denuncia),
 * apilarlos en la misma línea escondería justo lo que hay que ver. Así se ven los dos,
 * uno debajo del otro, pisándose en el eje.
 */
const pack = (bars) => {
    const ordenadas = [...bars].sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);
    const finDeCarril = [];

    for (const bar of ordenadas) {
        let carril = finDeCarril.findIndex((fin) => bar.startHour >= fin);

        if (carril === -1) {
            carril = finDeCarril.length;
            finDeCarril.push(0);
        }

        finDeCarril[carril] = bar.endHour;
        bar.lane = carril;
    }

    return { bars: ordenadas, lanes: Math.max(1, finDeCarril.length) };
};

const rows = computed(() => props.positions.map((position) => {
    const turnos = props.assignments
        .filter((a) => a.positionId === position.id && a.workDate === props.day.date)
        .map((a) => ({ ...a, kind: 'shift' }));

    // Los conceptos NO cubren puesto, pero SÍ ocupan a la persona. Se pintan en la fila
    // del puesto donde esa persona tiene turno ese día, para que se VEA que a las 10 no
    // está en la barra aunque su turno diga que sí.
    const conTurno = new Set(turnos.map((t) => t.personId));
    const conceptos = props.conceptEntries
        .filter((c) => c.workDate === props.day.date && conTurno.has(c.personId))
        .map((c) => ({ ...c, kind: 'concept' }));

    const { bars, lanes } = pack([...turnos, ...conceptos]);

    return {
        position,
        bars,
        lanes,
        uncoverable: uncoverable.value.has(position.id),
        segments: props.coverage.segments.filter(
            (s) => s.positionId === position.id && s.workDate === props.day.date,
        ),
    };
}));

const severityOf = (bar) => {
    if (bar.kind !== 'shift' || !props.violations) {
        return null;
    }

    return worst(props.violations.assignments[bar.id] ?? []);
};

const barStyle = (bar) => {
    const base = {
        position: 'absolute',
        left: `${bar.left}%`,
        width: `${bar.width}%`,
        top: `${bar.lane * (LANE_H + LANE_GAP)}px`,
        height: `${LANE_H}px`,
        borderRadius: '5px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '0 6px 0 5px',
        overflow: 'hidden',
    };

    const persona = peopleById.value[bar.personId];

    if (bar.kind === 'concept') {
        return {
            ...base,
            background: 'repeating-linear-gradient(45deg,#F3F2FC 0 5px,#FFFFFF 5px 10px)',
            border: '1.5px dashed #7F77DD',
            borderLeft: '1.5px dashed #7F77DD',
        };
    }

    const severity = severityOf(bar);

    return {
        ...base,
        background: severity === 'impossible'
            ? 'repeating-linear-gradient(45deg,rgba(200,30,30,.26) 0 5px,rgba(200,30,30,.08) 5px 10px)'
            : severity === 'breach'
                ? 'rgba(232,89,12,.08)'
                : '#F6F6FB',
        border: severity ? `1.5px solid ${severityColor(severity)}` : '1px solid #E4E3EF',
        // El filo de color de la persona: identifica el carril de un vistazo, sin leer.
        borderLeft: `3px solid ${severity ? severityColor(severity) : persona?.color ?? '#7F77DD'}`,
    };
};

const segStyle = (s) => {
    const base = {
        position: 'absolute',
        left: `${s.left}%`,
        width: `${s.width}%`,
        top: 0,
        bottom: 0,
        boxSizing: 'border-box',
    };

    if (s.missing > 0) {
        return { ...base, background: 'rgba(220,38,38,.24)', borderTop: '2px solid #DC2626' };
    }
    if (s.excess > 0) {
        return { ...base, background: 'rgba(127,119,221,.26)', borderTop: '2px solid #7F77DD' };
    }
    return { ...base, background: 'rgba(21,128,61,.18)', borderTop: '2px solid #15803D' };
};

// Con sitio, la etiqueta se lee entera: "faltan 2", no "-2".
const segLabel = (s) => {
    if (s.missing > 0) {
        return `faltan ${s.missing}`;
    }
    if (s.excess > 0) {
        return `sobra${s.excess > 1 ? 'n' : ''} ${s.excess}`;
    }
    return '';
};

const segLabelColor = (s) => (s.missing > 0 ? '#B0141C' : '#534AB7');

const nombre = (bar) => (bar.kind === 'concept'
    ? bar.name
    : peopleById.value[bar.personId]?.name ?? '?');

const ausentes = computed(() => props.absences.filter(
    (a) => a.startsOn <= props.day.date && (a.endsOn === null || a.endsOn >= props.day.date),
));
</script>

<template>
    <div class="px-6 py-4">
        <div class="overflow-hidden rounded-xl border border-line bg-white">
            <div class="flex items-center gap-3 border-b border-line-soft px-5 py-3.5">
                <span class="rounded bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-800">ZOOM · DÍA</span>
                <div>
                    <div class="text-sm font-bold text-ink">{{ day.weekday }} {{ day.label }}</div>
                    <div class="text-[11.5px] text-ink-soft">
                        Mismo eje temporal, más densidad: aquí cada hueco de cobertura tiene su
                        anchura real y su etiqueta entera.
                    </div>
                </div>
                <div class="flex-1" />
                <div
                    v-if="!day.isWorkingDay"
                    class="rounded bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-800"
                >
                    {{ day.holiday ?? 'No laborable' }}
                </div>
            </div>

            <!-- Las ausencias del día: bloquean a la persona entera, no a un puesto. -->
            <div v-if="ausentes.length" class="flex flex-wrap gap-2 border-b border-line-soft px-5 py-2.5">
                <span
                    v-for="a in ausentes"
                    :key="a.id"
                    class="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold"
                    style="background: rgba(60,52,137,.13); color: #3C3489"
                >
                    <span
                        class="flex h-4 w-4 items-center justify-center rounded-full text-[7.5px] text-white"
                        :style="{ background: peopleById[a.personId]?.color }"
                    >{{ peopleById[a.personId]?.initials }}</span>
                    {{ peopleById[a.personId]?.name }} · {{ a.name }}
                </span>
            </div>

            <div class="px-5 pb-5 pt-3.5">
                <!-- La regla horaria. El eje es el mismo que en la semana. -->
                <div class="mb-1.5 grid" style="grid-template-columns: 110px 1fr">
                    <div />
                    <div class="tabular relative h-3 text-[10px] text-[#A9A7B6]">
                        <span
                            v-for="tick in axis.ticks"
                            :key="tick.hour"
                            class="absolute -translate-x-1/2"
                            :style="{ left: `${tick.percent}%` }"
                        >{{ tick.label }}</span>
                    </div>
                </div>

                <div
                    v-for="row in rows"
                    :key="row.position.id"
                    class="grid items-start border-t border-line-soft py-2.5"
                    style="grid-template-columns: 110px 1fr"
                >
                    <div class="flex flex-col gap-1 pt-0.5">
                        <span class="text-[13px] font-bold text-[#41404E]">{{ row.position.name }}</span>
                        <span
                            v-if="row.uncoverable"
                            class="w-fit rounded bg-[#5A5A66] px-1.5 py-0.5 text-[8.5px] font-bold text-white"
                            title="El problema no está en el cuadrante: está en el catálogo"
                        >SIN CANDIDATO</span>
                    </div>

                    <div>
                        <!-- La pista: las líneas verticales son las 3 horas de la regla. -->
                        <div
                            class="relative"
                            :style="{
                                height: `${row.lanes * (30 + 3) - 3}px`,
                                minHeight: '30px',
                                backgroundImage: 'linear-gradient(90deg,#EDEDF2 1px,transparent 1px)',
                                backgroundSize: `${100 / ((axis.to - axis.from) / 3)}% 100%`,
                            }"
                        >
                            <div
                                v-for="bar in row.bars"
                                :key="`${bar.kind}-${bar.id}`"
                                :style="barStyle(bar)"
                                :title="`${nombre(bar)} · ${bar.label}`"
                            >
                                <span
                                    v-if="bar.kind === 'shift'"
                                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                                    :style="{ background: peopleById[bar.personId]?.color }"
                                >{{ peopleById[bar.personId]?.initials }}</span>
                                <span
                                    v-else
                                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-brand-300 bg-white text-[10px] text-brand-600"
                                >◷</span>

                                <!-- Nombre y hora COMPLETOS. Aquí hay sitio, y por eso existe esta vista. -->
                                <span
                                    class="shrink-0 whitespace-nowrap text-[12.5px] font-semibold"
                                    :class="bar.kind === 'concept' ? 'text-brand-600' : 'text-ink'"
                                >{{ nombre(bar) }}</span>
                                <span class="tabular shrink-0 whitespace-nowrap text-[11px] text-[#8A8896]">
                                    {{ bar.label }}
                                </span>

                                <span
                                    v-if="bar.crossesMidnight"
                                    class="tabular ml-auto shrink-0 text-[10px] text-brand-600"
                                    title="Cruza medianoche"
                                >☾</span>
                                <span
                                    v-else-if="bar.forced"
                                    class="ml-auto shrink-0 text-[10px] text-breach"
                                    title="Forzado por decisión humana, con constancia"
                                >⚠</span>
                            </div>
                        </div>

                        <!--
                            LA TIRA DE COBERTURA. El motivo de que esta vista exista.
                            Cada tramo, con su anchura real y su etiqueta entera.
                        -->
                        <div
                            class="relative mt-2 h-4 overflow-hidden rounded-sm bg-[#F5F4F8]"
                            :style="{
                                backgroundImage: 'linear-gradient(90deg,#E6E5EE 1px,transparent 1px)',
                                backgroundSize: `${100 / ((axis.to - axis.from) / 3)}% 100%`,
                            }"
                        >
                            <div v-for="(s, i) in row.segments" :key="i" :style="segStyle(s)" />
                            <span
                                v-for="(s, i) in row.segments"
                                :key="`l${i}`"
                                class="tabular absolute top-0 truncate text-center text-[9.5px] font-bold leading-4"
                                :style="{ left: `${s.left}%`, width: `${s.width}%`, color: segLabelColor(s) }"
                            >{{ segLabel(s) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
