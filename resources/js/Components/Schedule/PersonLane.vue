<script setup>
import { computed } from 'vue';
import { BRAND, BRAND_DARK, severityColor, severityIcon, shortText, worst } from '../../composables/useSeverity.js';
import { gridEvery } from '../../composables/useAxis.js';

/**
 * UN CARRIL: una persona, dentro de un puesto, dentro de un día.
 *
 * EL TIEMPO ES EL EJE X. Las barras se posicionan por su hora real, así que:
 *   · la jornada partida se VE como dos barras con un agujero físico en medio
 *   · el turno nocturno se VE cruzando el borde del día
 *   · el solape se VE como dos barras pisándose
 * Se ve. No hay que leerlo.
 *
 * ⚠️ Y NADA SE TRUNCA. NUNCA. NI EL NOMBRE NI LA HORA.
 *
 * El nombre no se puede truncar ("Hu…" puede ser Hugo o Humberto), así que ENVUELVE: por
 * largo que sea cabe, aunque la celda crezca. Y la hora tampoco se recorta, porque ya no hay
 * una hora larga que recortar: hay UNA POR BARRA.
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

const ALTO = 8;
const HUECO = 2;

/**
 * DOS TURNOS EL MISMO DÍA SON DOS BARRAS. SIEMPRE. Y AHORA TAMBIÉN DOS RÓTULOS.
 *
 * ⚠️ EL FALLO QUE ESTO ARREGLA ERA UNA INCOHERENCIA ENTRE VISTAS.
 *
 * En el zoom Día, el solape de Tomás (10:00–18:00 y 14:00–20:00) se VE: dos barras
 * pisándose. En la Semana caían en la MISMA pista de 8 px, se solapaban píxel a píxel y se
 * leían como una sola barra larga. El imposible había que CREÉRSELO leyendo el texto.
 *
 * Y arreglado eso quedaba media incoherencia: dos barras y UN SOLO rótulo
 * ("10:00-18:00 · 14:…"), así que el ojo veía dos barras y no sabía cuál era cuál. Ahora
 * cada barra tiene su línea, con su hora entera y con una muestra de su propio relleno.
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

/** El relleno de una barra. La muestra del rótulo usa EXACTAMENTE este, y por eso se emparejan. */
const rellenoDe = (block) => {
    if (block.kind === 'concept') {
        // El concepto NO cubre puesto: discontinuo y hueco, para que no se confunda con un turno.
        return { background: 'transparent', border: `1.5px dashed ${BRAND}` };
    }

    const severity = severityOf(block);

    if (severity === 'impossible') {
        return {
            background: 'repeating-linear-gradient(45deg,rgba(200,30,30,.55) 0 4px,rgba(200,30,30,.2) 4px 8px)',
            border: '1px solid #C81E1E',
        };
    }

    if (block.forced || severity === 'breach') {
        return { background: '#E8590C' };
    }

    // El nocturno tiene color propio, y no es el de la persona: es la excepción que más
    // cuesta ver en un cuadrante. Índigo, que no compite con la semántica de estado.
    if (block.crossesMidnight) {
        return { background: BRAND_DARK };
    }

    return { background: props.person.color };
};

const styleOf = (block) => ({
    ...rellenoDe(block),
    position: 'absolute',
    left: `${block.left}%`,
    width: `${block.width}%`,
    top: `${(block.subcarril ?? 0) * (ALTO + HUECO)}px`,
    height: `${ALTO}px`,
    // Un turno de media hora sigue siendo un turno: por estrecho que sea, se ve.
    minWidth: '3px',
    borderRadius: '3px',
    boxSizing: 'border-box',
});

const muestraStyle = (block) => ({
    ...rellenoDe(block),
    width: '10px',
    height: '6px',
    borderRadius: '2px',
    boxSizing: 'border-box',
    flexShrink: 0,
});

/**
 * Una línea por bloque, Y EL CONCEPTO DICE SU NOMBRE.
 *
 * ⚠️ UN SÍMBOLO QUE HAY QUE DEDUCIR NO COMUNICA NADA.
 *
 * La muestra del concepto —un rectángulo con borde discontinuo— iba sola, con un reloj y una
 * hora, y no había manera de saber qué era: había que deducirlo de una nota que estaba tres
 * líneas más abajo. Ahora lleva su etiqueta al lado ("Hora médica · 09:00–11:00") y se
 * entiende sin salir de la línea. El cuadradito ya no es un jeroglífico: es la muestra de
 * SU barra, y al lado pone lo que es.
 */
const rotulos = computed(() => repartidos.value.bloques.map((b) => ({
    key: `${b.kind}-${b.id}`,
    block: b,
    text: b.kind === 'concept' ? `◷ ${b.name} · ${b.label}` : b.label,
})));

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
        // El nombre ya está en su rótulo, con su hora. Aquí solo queda lo que el rótulo no
        // puede decir: que ocupa a la persona pero NO cubre el puesto.
        if (block.kind === 'concept') {
            añadir('◷ no cubre puesto', BRAND_DARK);
            continue;
        }

        // ⚠️ EL AVISO LLEVA SU HORA. Se me quedó "cruza medianoche" a secas —el aviso sin el
        // dato— y en un carril con dos turnos no se sabría de CUÁL de los dos habla.
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
    const partes = [`${props.person.name} · ${rotulos.value.map((r) => r.text).join('   ·   ')}`];

    for (const block of props.blocks) {
        for (const v of violationsOf(block)) {
            partes.push(v.message);
        }
    }

    return partes.join('\n');
});
</script>

<template>
    <div data-t="carril" :data-persona="person.name" :title="title">
        <div class="flex items-start gap-1.5">
            <span class="relative mt-px flex shrink-0">
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

            <!-- El nombre NO se trunca. Nunca. Si no cabe, ENVUELVE. -->
            <span
                data-t="nombre"
                class="min-w-0 flex-1 break-words text-[12px] font-semibold leading-tight text-ink"
            >{{ person.name }}</span>

            <!-- El icono dice QUÉ pasa. Un punto solo diría QUE pasa algo. -->
            <span
                v-if="laneSeverity"
                class="ml-0.5 shrink-0 text-[11px] leading-none"
                :style="{ color: severityColor(laneSeverity) }"
            >{{ severityIcon(laneSeverity) }}</span>
        </div>

        <!--
            ⚠️ UN RÓTULO POR BARRA, Y CON LA MUESTRA DE SU PROPIO RELLENO.

            Antes las horas iban en una sola línea, unidas por puntos ("10:00–18:00 · 14:…"):
            se truncaban —perdiendo el dato— y, sobre todo, no se sabía QUÉ BARRA ERA CUÁL.
            Con dos barras pisándose, esa línea única era una lista, no una explicación.

            Ahora hay tantos rótulos como barras, en el mismo orden, cada uno con su hora
            entera y una muestra idéntica al relleno de su barra. La partida se lee sin
            esfuerzo, y el solape también.
        -->
        <div
            v-for="rotulo in rotulos"
            :key="rotulo.key"
            data-t="rotulo"
            class="tabular ml-[22px] mt-[3px] flex items-start gap-[5px] text-[10px] leading-tight text-[#8A8896]"
        >
            <!--
                ENVUELVE, no trunca. "Hora médica · 09:00–11:00" no cabe en una columna de
                160 px, y la salida NO es recortarlo: es bajar de línea. Una hora suelta
                ("12:00–20:00") no tiene espacios, así que nunca se parte.
            -->
            <span class="mt-[2px]" :style="muestraStyle(rotulo.block)" />
            <span class="min-w-0 break-words">{{ rotulo.text }}</span>
        </div>

        <!--
            La pista va HUNDIDA respecto a la celda. Antes era gris clarito sobre blanco y
            se confundía con el fondo, con el borde y con la tira de cobertura: el mismo gris
            haciendo cuatro trabajos. Aquí solo hace uno — decir por dónde va el día.
        -->
        <div
            data-t="pista"
            class="relative mt-[5px] overflow-hidden rounded bg-sunken"
            :style="{
                height: `${altoPista}px`,
                backgroundImage: 'linear-gradient(90deg, rgb(255 255 255 / 55%) 1px, transparent 1px)',
                backgroundSize: gridEvery(axis, 6),
            }"
        >
            <div
                v-for="block in repartidos.bloques"
                :key="`${block.kind}-${block.id}`"
                data-t="barra"
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
