<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import CoverageStrip from './CoverageStrip.vue';
import { BRAND, BRAND_DARK, severityColor, shortText, worst } from '../../composables/useSeverity.js';
import { gridEvery } from '../../composables/useAxis.js';

/**
 * EL ZOOM DÍA. La vista donde la COBERTURA POR SEGMENTOS por fin se lee.
 *
 * En la semana, un día ocupa 320 px: el "-3 / -2" cabe, pero apretado. Aquí el día ocupa el
 * ancho entero, así que cada tramo tiene su anchura REAL y su etiqueta ENTERA ("faltan 3").
 * Es donde se ve que el motor no dice "falta gente toda la tarde" —que sería un aviso
 * falso— sino exactamente dónde y cuánta.
 *
 * Y con sitio de sobra, el nombre y la hora van COMPLETOS DENTRO de la barra.
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

const IMPOSIBLE = {
    overlap: 'solape de la misma persona',
    unavailable: 'la persona está ausente',
    contract_inactive: 'fuera de la vigencia del contrato',
    invalid_interval: 'intervalo imposible',
    shift_too_long: 'más de 24 horas',
};

const LANE_H = 30;
const LANE_GAP = 3;

/**
 * LA BARRA SE ADAPTA A LO QUE DE VERDAD CABE.
 *
 * A 1366 px la pista mide ~915 px, así que una barra de 4 h son 152 px: no caben "Lucía
 * Díaz" y "09:00–13:00". Antes se recortaba a media cadena ("13:00–17:") y quedaba como un
 * error, mientras la cabecera prometía "nombre y hora completos, siempre". Una promesa
 * falsa en la propia interfaz.
 *
 * EL NOMBRE ES LA PRIORIDAD y no se trunca nunca ("Hu…" puede ser Hugo o Humberto). La hora
 * se enseña solo si cabe ENTERA, y si no cabe se lee en el tooltip. Y si no cabe ni el
 * nombre, queda el avatar con su color.
 */
const pista = ref(null);
const anchoPista = ref(0);


let observador = null;

onMounted(() => {
    if (!pista.value) {
        return;
    }

    observador = new ResizeObserver(([e]) => {
        anchoPista.value = e.contentRect.width;
    });

    observador.observe(pista.value);
    anchoPista.value = pista.value.getBoundingClientRect().width;
});

onBeforeUnmount(() => observador?.disconnect());

const anchoDe = (bar) => (bar.width / 100) * anchoPista.value;

const muestraNombre = (bar) => anchoDe(bar) >= 60;
const muestraHora = (bar) => anchoDe(bar) >= 168;

const peopleById = computed(() => Object.fromEntries(props.people.map((p) => [p.id, p])));

/** Reparte las barras en carriles para que ninguna tape a otra: el solape hay que VERLO. */
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

const violationsOf = (bar) => (
    bar.kind === 'shift' && props.violations
        ? props.violations.assignments[bar.id] ?? []
        : []
);

const rows = computed(() => props.positions.map((position) => {
    const turnos = props.assignments
        .filter((a) => a.positionId === position.id && a.workDate === props.day.date)
        .map((a) => ({ ...a, kind: 'shift' }));

    const conTurno = new Set(turnos.map((t) => t.personId));
    const conceptos = props.conceptEntries
        .filter((c) => c.workDate === props.day.date && conTurno.has(c.personId))
        .map((c) => ({ ...c, kind: 'concept' }));

    const { bars, lanes } = pack([...turnos, ...conceptos]);

    // El cartel dice QUÉ es imposible. Lo tenía cableado a "solape de la misma persona", y
    // en las celdas donde el imposible era una BAJA afirmaba un solape que no existía.
    const motivos = [...new Set(
        bars
            .flatMap(violationsOf)
            .filter((v) => v.severity === 'impossible')
            .map((v) => IMPOSIBLE[v.code] ?? 'no se puede colocar'),
    )];

    const imposible = motivos.length ? `IMPOSIBLE · ${motivos.join(' · ')}` : null;

    const segments = props.coverage.segments.filter(
        (s) => s.positionId === position.id && s.workDate === props.day.date,
    );

    const notas = [];
    const vistas = new Set();

    for (const bar of bars) {
        if (bar.kind === 'concept' && !vistas.has(bar.name)) {
            vistas.add(bar.name);
            notas.push({ text: `${bar.name} · no cubre puesto`, color: BRAND_DARK });
        }

        for (const v of violationsOf(bar)) {
            const t = shortText(v);
            if (!vistas.has(t)) {
                vistas.add(t);
                notas.push({ text: t, color: severityColor(v.severity) });
            }
        }
    }

    return {
        position,
        bars,
        lanes,
        imposible,
        segments,
        notas,
        // Con un imposible dentro, la cobertura cuenta a alguien que no puede estar ahí.
        // Es una ficción, y una ficción con apariencia de dato es lo peor que se puede pintar.
        muestraCobertura: !imposible,
        sinCandidato: segments.some((s) => s.state === 'uncoverable'),
    };
}));

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
            border: `1.5px dashed ${BRAND}`,
        };
    }

    const severity = worst(violationsOf(bar));

    if (severity === 'impossible') {
        return {
            ...base,
            background: 'repeating-linear-gradient(45deg,rgba(200,30,30,.26) 0 5px,rgba(200,30,30,.08) 5px 10px)',
            border: '1.5px solid #C81E1E',
            borderLeft: '3px solid #C81E1E',
        };
    }

    if (bar.forced || severity === 'breach') {
        return {
            ...base,
            background: 'rgba(232,89,12,.07)',
            border: '1.5px solid #E8590C',
            borderLeft: '3px solid #E8590C',
        };
    }

    return {
        ...base,
        background: bar.crossesMidnight ? '#EEEDFA' : '#F6F6FB',
        border: '1px solid #E4E3EF',
        // El filo con el color de la persona: identifica el carril sin leer.
        borderLeft: `3px solid ${persona?.color ?? BRAND}`,
    };
};

const nombre = (bar) => (bar.kind === 'concept'
    ? bar.name
    : peopleById.value[bar.personId]?.name ?? '?');

const icono = (bar) => {
    if (bar.crossesMidnight) {
        return { simbolo: '☾', color: BRAND_DARK };
    }
    if (bar.forced) {
        return { simbolo: '⚠', color: '#E8590C' };
    }
    const s = worst(violationsOf(bar));
    return s ? { simbolo: s === 'impossible' ? '●' : '⚠', color: severityColor(s) } : null;
};

const title = (bar) => [
    `${nombre(bar)} · ${bar.label}`,
    ...violationsOf(bar).map((v) => v.message),
].join('\n');

const ausentes = computed(() => props.absences.filter(
    (a) => a.startsOn <= props.day.date && (a.endsOn === null || a.endsOn >= props.day.date),
));
</script>

<template>
    <div class="flex min-h-0 min-w-0 flex-1 bg-page p-4">
        <div class="max-h-full w-full self-start overflow-auto rounded-xl border-2 border-edge bg-card shadow-[0_2px_10px_-4px_rgb(40_36_80/18%)]">
            <div class="flex items-center gap-3 border-b-2 border-edge bg-rail px-5 py-3.5">
                <span class="rounded bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-800">ZOOM · DÍA</span>
                <div class="flex-1">
                    <div class="text-sm font-bold text-ink">
                        {{ day.weekday }} {{ day.label }}
                    </div>
                    <div class="text-[11.5px] text-ink-soft">
                        Misma parrilla, mismo eje temporal; solo cambia la densidad. Aquí el hueco
                        de cobertura tiene su anchura real y su etiqueta entera: "faltan 3", no "-3".
                    </div>
                </div>
                <div
                    v-if="!day.isWorkingDay"
                    class="rounded bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-800"
                >
                    {{ day.holiday ?? 'No laborable' }}
                </div>
            </div>

            <div v-if="ausentes.length" class="flex flex-wrap gap-2 border-b border-line bg-band px-5 py-2.5">
                <span
                    v-for="a in ausentes"
                    :key="a.id"
                    class="flex items-center gap-1.5 rounded px-2 py-1 text-[9.5px] font-bold text-brand-800"
                    style="background: rgba(60,52,137,.13); border: 1px solid rgba(60,52,137,.28)"
                >
                    <span
                        class="tabular flex h-4 w-4 items-center justify-center rounded-full text-[7.5px] text-white"
                        :style="{ background: peopleById[a.personId]?.color }"
                    >{{ peopleById[a.personId]?.initials }}</span>
                    {{ peopleById[a.personId]?.name }} · {{ a.name }}
                </span>
            </div>

            <div class="px-5 pb-5 pt-3.5">
                <!-- La regla horaria: en el Día SÍ va, como en la referencia. -->
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
                    v-for="(row, p) in rows"
                    :key="row.position.id"
                    class="-mx-5 grid items-start px-5 py-3"
                    :class="[p > 0 ? 'border-t-2 border-edge' : '', p % 2 ? 'bg-band' : 'bg-card']"
                    style="grid-template-columns: 110px 1fr"
                >
                    <div class="flex flex-col gap-1 pt-0.5">
                        <span class="text-[13px] font-bold text-ink">{{ row.position.name }}</span>
                    </div>

                    <div>
                        <div
                            v-if="row.imposible"
                            class="mb-1.5 inline-block rounded bg-impossible px-[7px] py-[3px] text-[9px] font-bold tracking-[.02em] text-white"
                        >
                            {{ row.imposible }}
                        </div>

                        <div
                            v-else-if="row.sinCandidato"
                            class="mb-1.5 inline-block rounded bg-[#5A5A66] px-[7px] py-[3px] text-[9px] font-bold text-white"
                        >
                            Sin candidato en catálogo
                        </div>

                        <div
                            :ref="p === 0 ? (el) => (pista = el) : undefined"
                            class="relative"
                            :style="{
                                height: `${row.lanes * (30 + 3) - 3}px`,
                                minHeight: '30px',
                                backgroundImage: 'linear-gradient(90deg, var(--color-line-soft) 1px, transparent 1px)',
                                backgroundSize: gridEvery(axis, 3),
                            }"
                        >
                            <div
                                v-for="bar in row.bars"
                                :key="`${bar.kind}-${bar.id}`"
                                :style="barStyle(bar)"
                                :title="title(bar)"
                            >
                                <span
                                    v-if="bar.kind === 'shift'"
                                    class="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                                    :style="{ background: peopleById[bar.personId]?.color }"
                                >{{ peopleById[bar.personId]?.initials }}</span>
                                <span
                                    v-else
                                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-brand-300 bg-white text-[11px] text-brand-600"
                                >◷</span>

                                <span
                                    v-if="muestraNombre(bar)"
                                    class="shrink-0 whitespace-nowrap text-[12.5px] font-semibold"
                                    :class="bar.kind === 'concept' ? 'text-brand-600' : 'text-ink'"
                                >{{ nombre(bar) }}</span>

                                <span
                                    v-if="muestraHora(bar)"
                                    class="tabular shrink-0 whitespace-nowrap text-[11px] text-[#8A8896]"
                                >{{ bar.label }}</span>

                                <span
                                    v-if="icono(bar)"
                                    class="ml-auto shrink-0 text-[10px]"
                                    :style="{ color: icono(bar).color }"
                                >{{ icono(bar).simbolo }}</span>
                            </div>
                        </div>

                        <div v-if="row.muestraCobertura" class="mt-2">
                            <CoverageStrip :segments="row.segments" :axis="axis" wide />
                        </div>

                        <div
                            v-for="(nota, i) in row.notas"
                            :key="i"
                            class="mt-1.5 text-[9.5px] font-semibold"
                            :style="{ color: nota.color }"
                        >{{ nota.text }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
