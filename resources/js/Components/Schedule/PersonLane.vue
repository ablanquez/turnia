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
    /**
     * La columna es estrecha: la semana entera cabe a 1366 px, pero a costa de columnas de
     * ~160 px, y ahí no caben el nombre y la hora en la MISMA línea.
     *
     * ⚠️ LA HORA NO SE PIERDE: BAJA DE LÍNEA.
     *
     * Ocultarla habría sido la salida fácil, y habría sido perder un dato para ganar
     * espacio. Recortarla ("12:00–2…") habría parecido un error. Debajo del nombre cabe
     * entera, y el nombre —que es lo que jamás se puede truncar— sigue en su línea.
     */
    compact: { type: Boolean, default: false },
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

const ALTO = 8;
const HUECO = 2;

/**
 * DOS TURNOS EL MISMO DÍA SON DOS BARRAS. SIEMPRE.
 *
 * ⚠️ EL FALLO QUE ESTO ARREGLA ERA UNA INCOHERENCIA ENTRE VISTAS.
 *
 * En el zoom Día, el solape de Tomás (10:00–18:00 y 14:00–20:00) se VE: dos barras
 * pisándose. En la Semana, las dos barras caían en la MISMA pista de 8 px, se solapaban
 * píxel a píxel y se leían como una sola barra larga. El imposible había que CREÉRSELO
 * leyendo el texto — y este diseño es bueno precisamente porque las cosas SE VEN.
 *
 * La misma situación, contada de dos maneras. Ahora se cuenta igual en las dos.
 *
 * El reparto es geométrico y NO juzga nada:
 *   · si dos bloques SE PISAN  → sub-carriles distintos → se ven encimados → IMPOSIBLE
 *   · si entre ellos hay AIRE  → el mismo sub-carril    → hueco físico     → PARTIDA
 *
 * Quien decide cuál es cuál es el motor. Aquí solo se pinta lo que hay, y lo que hay se ve.
 */
const repartidos = computed(() => {
    const orden = props.blocks.slice().sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);
    const finDeSubcarril = [];

    for (const bloque of orden) {
        let i = finDeSubcarril.findIndex((fin) => bloque.startHour >= fin);

        if (i === -1) {
            i = finDeSubcarril.length;
            finDeSubcarril.push(0);
        }

        finDeSubcarril[i] = bloque.endHour;
        bloque.subcarril = i;
    }

    return { bloques: orden, subcarriles: Math.max(1, finDeSubcarril.length) };
});

const altoPista = computed(() => {
    const n = repartidos.value.subcarriles;

    return n * ALTO + (n - 1) * HUECO;
});

const styleOf = (block) => {
    const base = {
        position: 'absolute',
        left: `${block.left}%`,
        width: `${block.width}%`,
        top: `${(block.subcarril ?? 0) * (ALTO + HUECO)}px`,
        height: `${ALTO}px`,
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

            <!-- Ancha: la hora va al lado. Estrecha: baja de línea, pero NO desaparece. -->
            <span
                v-if="!compact"
                class="tabular min-w-0 flex-1 truncate whitespace-nowrap text-[10px] text-[#8A8896]"
            >{{ summary }}</span>

            <span v-else class="flex-1" />

            <!-- El icono dice QUÉ pasa. Un punto solo diría QUE pasa algo. -->
            <span
                v-if="laneSeverity"
                class="ml-0.5 shrink-0 text-[11px] leading-none"
                :style="{ color: severityColor(laneSeverity) }"
            >{{ severityIcon(laneSeverity) }}</span>
        </div>

        <!--
            Y ENVUELVE, no recorta. Una jornada partida son dos horas ("09:00–13:00 · 17:00–21:00")
            y truncarla dejaba "17:00–…", que parece un error. Que ocupe dos líneas: la celda
            tiene alto de sobra, y el dato no se pierde.
        -->
        <div
            v-if="compact"
            class="tabular ml-[22px] text-[9.5px] leading-tight text-[#8A8896]"
        >{{ summary }}</div>

        <!--
            La pista va HUNDIDA respecto a la celda. Antes era gris clarito sobre blanco y
            se confundía con el fondo, con el borde y con la tira de cobertura: el mismo gris
            haciendo cuatro trabajos. Aquí solo hace uno — decir por dónde va el día.
        -->
        <div
            class="bg-sunken relative mt-[3px] overflow-hidden rounded"
            :style="{
                height: `${altoPista}px`,
                backgroundImage: 'linear-gradient(90deg, rgb(255 255 255 / 55%) 1px, transparent 1px)',
                backgroundSize: gridEvery(axis, 6),
            }"
        >
            <div
                v-for="block in repartidos.bloques"
                :key="`${block.kind}-${block.id}`"
                :style="styleOf(block)"
            />
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
