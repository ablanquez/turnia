<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import CoverageStrip from './CoverageStrip.vue';
import { BRAND_DARK, severityColor, severityIcon } from '../../composables/useSeverity.js';
import { pintarBanda, pintarBloque, tintaSobre, violacionesDe } from '../../composables/useMatrizVisual.js';
import { gridEvery } from '../../composables/useAxis.js';

/**
 * EL ZOOM DÍA. La vista donde la COBERTURA POR SEGMENTOS por fin se lee.
 *
 * ⚠️ ESTE COMPONENTE TENÍA SU PROPIA TABLA DE COLORES, Y ESO ERA EL PECADO ORIGINAL.
 *
 * El imposible era `rgba(200,30,30,.26)` aquí y `rgba(200,30,30,.55)` en la semana; el nocturno
 * era `#EEEDFA` aquí y `#534AB7` allí; el concepto tenía un rayado gris aquí y un borde índigo
 * allí. Dos vistas del MISMO hecho, contándolo de dos maneras — y cada arreglo en una vista
 * dejaba la otra desincronizada. Ahora las dos leen useMatrizVisual y no discuten.
 *
 * Lo único que cambia es la ESCALA: aquí la barra mide 30 px y lleva DENTRO el nombre y la
 * hora, así que el relleno va con menos tinta para que el texto se lea. El significado de cada
 * canal es idéntico.
 */
const props = defineProps({
    day: { type: Object, required: true },
    axis: { type: Object, required: true },
    positions: { type: Array, required: true },
    people: { type: Array, required: true },
    assignments: { type: Array, required: true },
    conceptEntries: { type: Array, required: true },
    absences: { type: Array, required: true },
    // DIFERIDA, con las violaciones: la cobertura depende de ellas. null = todavía no se sabe.
    coverage: { type: Object, default: null },
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
 * EL NOMBRE ES LA PRIORIDAD y no se trunca nunca ("Hu…" puede ser Hugo o Humberto). La hora se
 * enseña solo si cabe ENTERA, y si no cabe se lee en el tooltip. Y si no cabe ni el nombre,
 * queda el avatar con su color.
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

const rows = computed(() => props.positions.map((position) => {
    const turnos = props.assignments
        .filter((a) => a.positionId === position.id && a.workDate === props.day.date)
        .map((a) => ({ ...a, kind: 'shift' }));

    const conTurno = new Set(turnos.map((t) => t.personId));
    const conceptos = props.conceptEntries
        .filter((c) => c.workDate === props.day.date && conTurno.has(c.personId))
        .map((c) => ({ ...c, kind: 'concept' }));

    const { bars, lanes } = pack([...turnos, ...conceptos]);

    // El cartel dice QUÉ es imposible. Lo tenía cableado a "solape de la misma persona", y en
    // las celdas donde el imposible era una BAJA afirmaba un solape que no existía.
    const motivos = [...new Set(
        bars
            .flatMap((b) => violacionesDe(b, props.violations))
            .filter((v) => v.severity === 'impossible')
            .map((v) => IMPOSIBLE[v.code] ?? 'no se puede colocar'),
    )];

    const imposible = motivos.length ? `IMPOSIBLE · ${motivos.join(' · ')}` : null;

    const segments = (props.coverage?.segments ?? []).filter(
        (s) => s.positionId === position.id && s.workDate === props.day.date,
    );

    const pintadas = bars.map((bar) => ({
        bar,
        ...pintarBloque(bar, {
            person: peopleById.value[bar.personId] ?? { color: BRAND_DARK, name: '?', initials: '?' },
            violations: props.violations,
            celdaGrita: !!imposible,
            escala: 'dia',
        }),
    }));

    // Ley 8: toda nota lleva su hora. Y ley 9: lo que el cartel ya grita no se repite. Las dos
    // las aplica la matriz, aquí solo se quitan los duplicados exactos del puesto.
    const vistas = new Set();
    const notas = pintadas
        .flatMap((p) => p.notas)
        .filter((n) => !vistas.has(n.text) && vistas.add(n.text));

    return {
        position,
        pintadas,
        lanes,
        imposible,
        segments,
        notas,
        // LA TIRA SE PINTA TAMBIÉN CON UN IMPOSIBLE DENTRO. La ficción no estaba en pintarla:
        // estaba en que el motor contaba como cobertura a alguien que no podía estar ahí. Eso
        // se arregló en el motor, así que el número de aquí ya es el real.
        sinCandidato: segments.some((s) => s.uncoverable),
    };
}));

const barStyle = (p) => ({
    ...p.relleno,
    position: 'absolute',
    left: `${p.bar.left}%`,
    width: `${p.bar.width}%`,
    top: `${p.bar.lane * (LANE_H + LANE_GAP)}px`,
    height: `${LANE_H}px`,
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '0 6px 0 5px',
    overflow: 'hidden',
});

const nombre = (bar) => (bar.kind === 'concept'
    ? bar.name
    : peopleById.value[bar.personId]?.name ?? '?');

const title = (bar) => [
    `${nombre(bar)} · ${bar.label}`,
    ...violacionesDe(bar, props.violations).map((v) => v.message),
].join('\n');

const ausentes = computed(() => props.absences
    .filter((a) => a.startsOn <= props.day.date && (a.endsOn === null || a.endsOn >= props.day.date))
    .map((a) => ({
        banda: { ...a, esPrimero: true, esUltimo: a.endsOn === props.day.date },
        ...pintarBanda({ ...a, esPrimero: true, esUltimo: a.endsOn === props.day.date }, props.violations),
    })));

const cerrado = computed(() => (props.coverage?.closed ?? []).includes(props.day.date));
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

                <!--
                    CERRADO ≠ NO LABORABLE. Un bar abre en festivo con toda normalidad, así que el
                    "Cerrado" solo se dice cuando el día no es laborable Y ADEMÁS no se pide a
                    nadie. El nombre del festivo se dice siempre: es un dato, no un juicio.
                -->
                <div
                    v-if="cerrado"
                    data-t="cerrado"
                    class="rounded border border-line bg-sunken px-2 py-1 text-[10px] font-bold text-ink-soft"
                >Cerrado</div>

                <div
                    v-if="day.holiday || !day.isWorkingDay"
                    class="rounded bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-800"
                >{{ day.holiday ?? 'No laborable' }}</div>
            </div>

            <div v-if="ausentes.length" class="flex flex-col gap-1.5 border-b border-line bg-band px-5 py-2.5">
                <div class="flex flex-wrap gap-2">
                    <span
                        v-for="a in ausentes"
                        :key="a.banda.id"
                        data-t="banda"
                        :data-persona="peopleById[a.banda.personId]?.name"
                        :data-abierta="a.abierta"
                        class="flex items-center gap-1.5 rounded px-2 py-1 text-[9.5px] font-bold text-brand-800"
                        :style="a.estilo"
                    >
                        <span
                            class="tabular flex h-4 w-4 items-center justify-center rounded-full text-[7.5px] text-white"
                            :style="{ background: peopleById[a.banda.personId]?.color }"
                        >{{ peopleById[a.banda.personId]?.initials }}</span>
                        {{ peopleById[a.banda.personId]?.name }} · {{ a.banda.name }}{{ a.sufijo }}
                    </span>
                </div>

                <!-- Sus violaciones, que hasta hoy no se pintaban en ninguna parte. -->
                <div
                    v-for="(nota, i) in ausentes.flatMap((a) => a.notas)"
                    :key="i"
                    data-t="nota"
                    class="text-[9.5px] font-semibold"
                    :style="{ color: nota.color }"
                >{{ nota.text }}</div>
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
                    data-t="celda"
                    :data-celda="`${row.position.name}|${day.date}`"
                    class="-mx-5 grid items-start px-5 py-3"
                    :class="[p > 0 ? 'border-t-2 border-edge' : '', p % 2 ? 'bg-band' : 'bg-card']"
                    style="grid-template-columns: 110px 1fr"
                >
                    <div class="flex flex-col gap-1 pt-0.5">
                        <span class="text-[13px] font-bold text-ink">{{ row.position.name }}</span>
                    </div>

                    <div>
                        <!-- ⚠️ LOS CARTELES SE APILAN: son dos hechos independientes. -->
                        <div
                            v-if="row.imposible"
                            data-t="imposible"
                            class="mb-1.5 inline-block rounded bg-impossible px-[7px] py-[3px] text-[9px] font-bold tracking-[.02em] text-white"
                        >
                            {{ row.imposible }}
                        </div>

                        <div
                            v-if="row.sinCandidato"
                            data-t="sin-candidato"
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
                                v-for="p2 in row.pintadas"
                                :key="`${p2.bar.kind}-${p2.bar.id}`"
                                data-t="barra"
                                :data-persona="peopleById[p2.bar.personId]?.name"
                                :style="barStyle(p2)"
                                :title="title(p2.bar)"
                            >
                                <!-- LA MUESCA: se forzó. Una decisión tomada, no un aviso desatendido. -->
                                <span
                                    v-if="p2.forzado"
                                    data-t="muesca"
                                    class="absolute left-0 top-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-white border-t-transparent"
                                />

                                <!-- EL FILO: cruza medianoche. "Sigue mañana." -->
                                <span
                                    v-if="p2.nocturno"
                                    data-t="filo-noche"
                                    class="absolute right-0 top-0 h-full w-[4px] bg-ink"
                                />

                                <!--
                                    ⚠️ EN EL DÍA, LA IDENTIDAD LA LLEVA ESTE AVATAR, y por eso va
                                    a color PLENO dentro de la barra.

                                    El relleno de la barra es una tinta al 15 % porque encima va
                                    escrito el nombre y la hora, y a plena intensidad no se
                                    leerían. Pero la ley 2 no se negocia por vista: "tapa los
                                    nombres y todavía tienes que poder reconstruir quién hace
                                    qué". Aquí lo reconstruyes por el disco de color, que está
                                    DENTRO de la barra y es sólido. En la Semana no hay avatar
                                    dentro de la pista, así que ahí lo lleva el relleno.
                                -->
                                <span
                                    v-if="p2.bar.kind === 'shift'"
                                    data-t="avatar"
                                    :data-persona="peopleById[p2.bar.personId]?.name"
                                    class="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                                    :style="{
                                        background: peopleById[p2.bar.personId]?.color,
                                        color: tintaSobre(peopleById[p2.bar.personId]?.color ?? '#000000'),
                                    }"
                                >{{ peopleById[p2.bar.personId]?.initials }}</span>
                                <span
                                    v-else
                                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-brand-300 bg-white text-[11px] text-brand-600"
                                >◷</span>

                                <span
                                    v-if="muestraNombre(p2.bar)"
                                    class="shrink-0 whitespace-nowrap text-[12.5px] font-semibold"
                                    :class="p2.bar.kind === 'concept' ? 'text-brand-800' : 'text-ink'"
                                >{{ nombre(p2.bar) }}</span>

                                <span
                                    v-if="muestraHora(p2.bar)"
                                    class="tabular shrink-0 whitespace-nowrap text-[11px] text-ink-soft"
                                >{{ p2.bar.label }}<span v-if="p2.nocturno" class="ml-[3px]">☾</span></span>

                                <span
                                    v-if="p2.severidad"
                                    class="ml-auto shrink-0 pr-1 text-[10px]"
                                    :style="{ color: severityColor(p2.severidad) }"
                                >{{ severityIcon(p2.severidad) }}</span>
                            </div>
                        </div>

                        <div v-if="row.segments.length" class="mt-2">
                            <CoverageStrip :segments="row.segments" :axis="axis" wide />
                        </div>

                        <div
                            v-for="(nota, i) in row.notas"
                            :key="i"
                            data-t="nota"
                            class="mt-1.5 text-[9.5px] font-semibold"
                            :style="{ color: nota.color }"
                        >{{ nota.text }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
