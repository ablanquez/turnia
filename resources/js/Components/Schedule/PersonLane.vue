<script setup>
import { computed } from 'vue';
import { BRAND, BRAND_DARK, severityColor, severityIcon, shortText, worst } from '../../composables/useSeverity.js';
import { gridEvery } from '../../composables/useAxis.js';

/**
 * UN CARRIL: una persona, dentro de un puesto, dentro de un día.
 *
 * Medidas tomadas de la referencia renderizada: avatar 16 px, nombre 12 px/600, resumen en
 * mono 10 px, pista de 8 px con una línea cada 6 h, notas de 9,5 px/600.
 *
 * EL TIEMPO ES EL EJE X. Las barras se posicionan por su hora real, así que:
 *   · la jornada partida se VE como dos barras con un agujero físico en medio
 *   · el turno nocturno se VE cruzando el borde del día
 *   · el solape se VE como dos barras pisándose
 * Se ve. No hay que leerlo.
 *
 * EL NOMBRE NUNCA SE TRUNCA (truncar es ilegible: "Hu…" puede ser Hugo o Humberto). LA
 * HORA SÍ, si no cabe: se recorta ella y se lee entera en el tooltip. Lo tenía al revés.
 */
const props = defineProps({
    person: { type: Object, required: true },
    // Turnos Y conceptos horarios de esta persona ese día: los dos la ocupan físicamente,
    // y por eso van en el mismo carril. Así se VE que la hora médica de las 10 cae dentro
    // del turno de 9 a 17, en vez de haber que buscarla en otra fila.
    blocks: { type: Array, required: true },
    axis: { type: Object, required: true },
    // null mientras el informe no ha llegado. NO significa "sin incidencias".
    violationsById: { type: Object, default: null },
});

const violationsOf = (block) => (
    block.kind === 'shift' && props.violationsById
        ? props.violationsById[block.id] ?? []
        : []
);

const severityOf = (block) => worst(violationsOf(block));

const laneSeverity = computed(() => worst(props.blocks.flatMap(violationsOf)));

const tambienEnOtraEmpresa = computed(() => props.blocks
    .flatMap(violationsOf)
    .some((v) => v.code === 'shared_workday'));

const sinIcono = (texto) => texto.replace(/^[●⚠↗·]\s*/, '').toLowerCase();

const summary = computed(() => props.blocks
    .map((b) => (b.kind === 'concept' ? `◷ ${b.label}` : b.label))
    .join('   ·   '));

const styleOf = (block) => {
    const base = {
        position: 'absolute',
        left: `${block.left}%`,
        width: `${block.width}%`,
        top: 0,
        bottom: 0,
        // Un turno de media hora sigue siendo un turno: por estrecho que sea, se ve.
        minWidth: '3px',
        borderRadius: '3px',
        boxSizing: 'border-box',
    };

    // El concepto NO cubre puesto: discontinuo y hueco, para que no se confunda con un turno.
    if (block.kind === 'concept') {
        return { ...base, background: 'transparent', border: `1.5px dashed ${BRAND}` };
    }

    const severity = severityOf(block);

    if (severity === 'impossible') {
        return {
            ...base,
            background: 'repeating-linear-gradient(45deg,rgba(200,30,30,.55) 0 4px,rgba(200,30,30,.2) 4px 8px)',
            border: '1px solid #C81E1E',
        };
    }

    if (block.forced) {
        return { ...base, background: '#E8590C' };
    }

    // El nocturno tiene color propio, y no es el de la persona: es la excepción que más
    // cuesta ver en un cuadrante. Índigo, que no compite con la semántica de estado.
    if (block.crossesMidnight) {
        return { ...base, background: BRAND_DARK };
    }

    if (severity === 'breach') {
        return { ...base, background: '#E8590C' };
    }

    return { ...base, background: props.person.color };
};

/**
 * Las notas de la celda: UNA LÍNEA cada una.
 *
 * El mensaje completo del motor va en el tooltip de la barra. Volcarlo aquí estiraba las
 * celdas al triple y la semana dejaba de caber en la pantalla.
 */
const notes = computed(() => {
    const out = [];
    const vistas = new Set();

    const añadir = (text, color, dot = false) => {
        if (!vistas.has(text)) {
            vistas.add(text);
            out.push({ text, color, dot });
        }
    };

    for (const block of props.blocks) {
        if (block.kind === 'concept') {
            añadir(`${block.name} · no cubre puesto`, BRAND_DARK);
            continue;
        }

        if (block.crossesMidnight) {
            añadir(`☾ ${block.label} · cruza medianoche`, BRAND_DARK);
        }

        const rotas = violationsOf(block);

        // "⚠ Forzado · descanso corto entre turnos", en UNA línea. Separar el "forzado" de
        // su motivo daba dos notas para un solo hecho, y la celda crecía por nada.
        if (block.forced && rotas.length) {
            for (const v of rotas) {
                añadir(`⚠ Forzado · ${sinIcono(shortText(v))}`, severityColor(v.severity));
            }

            continue;
        }

        if (block.forced) {
            añadir('⚠ Forzado, con constancia', '#E8590C');
        }

        for (const v of rotas) {
            añadir(shortText(v), severityColor(v.severity), v.severity === 'notice');
        }
    }

    return out;
});

/** El tooltip: aquí SÍ va todo, sin recortar. Se pide, no se impone. */
const title = computed(() => {
    const partes = [`${props.person.name} · ${summary.value}`];

    for (const block of props.blocks) {
        for (const v of violationsOf(block)) {
            partes.push(v.message);
        }
    }

    return partes.join('\n');
});
</script>

<template>
    <div :title="title">
        <div class="flex items-center gap-1.5">
            <span class="relative flex shrink-0">
                <span
                    class="tabular flex h-4 w-4 items-center justify-center rounded-full text-[7.5px] font-semibold text-white"
                    :style="{ background: person.color }"
                >{{ person.initials }}</span>

                <!-- Punto ámbar: ese día también trabaja en otro sitio. Es un AVISO, y se ve
                     sin leer nada. -->
                <span
                    v-if="tambienEnOtraEmpresa"
                    class="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-notice"
                />
            </span>

            <!-- El nombre NO se trunca. Nunca. -->
            <span class="shrink-0 whitespace-nowrap text-[12px] font-semibold text-ink">{{ person.name }}</span>

            <!-- La hora SÍ, si no cabe: se lee entera en el tooltip. -->
            <span class="tabular min-w-0 flex-1 truncate whitespace-nowrap text-[10px] text-[#8A8896]">
                {{ summary }}
            </span>

            <!-- El icono dice QUÉ pasa. Un punto solo diría QUE pasa algo. -->
            <span
                v-if="laneSeverity"
                class="ml-0.5 shrink-0 text-[11px] leading-none"
                :style="{ color: severityColor(laneSeverity) }"
            >{{ severityIcon(laneSeverity) }}</span>
        </div>

        <div
            class="relative mt-[3px] h-2 overflow-hidden rounded"
            :style="{
                background: '#F1F0F6',
                backgroundImage: 'linear-gradient(90deg,#E4E3EC 1px,transparent 1px)',
                backgroundSize: gridEvery(axis, 6),
            }"
        >
            <div v-for="block in blocks" :key="`${block.kind}-${block.id}`" :style="styleOf(block)" />
        </div>

        <div
            v-for="(note, i) in notes"
            :key="i"
            class="mt-1 flex items-center gap-[5px] text-[9.5px] font-semibold leading-tight"
            :style="{ color: note.color }"
        >
            <span
                v-if="note.dot"
                class="h-1.5 w-1.5 shrink-0 rounded-full"
                :style="{ background: note.color }"
            />
            {{ note.text }}
        </div>
    </div>
</template>
