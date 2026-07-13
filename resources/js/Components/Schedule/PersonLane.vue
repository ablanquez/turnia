<script setup>
import { computed } from 'vue';
import { BRAND_DARK, severityColor, severityIcon, worst } from '../../composables/useSeverity.js';
import { pintarBloque, tintaSobre, violacionesDe } from '../../composables/useMatrizVisual.js';
import { gridEvery } from '../../composables/useAxis.js';

/**
 * UN CARRIL: una persona, dentro de un puesto, dentro de un día.
 *
 * ⚠️ ESTE COMPONENTE NO DECIDE NI UN SOLO COLOR. Los pide (useMatrizVisual) y los pinta.
 *
 * Durante siete tandas cada componente decidía su rojo sobre la marcha, y por eso cada tanda
 * aparecía un caso nuevo mal pintado. La representación vive ahora en UN sitio, y este fichero
 * solo hace lo que sabe hacer: colocar cosas en el eje X y apilarlas cuando se pisan.
 *
 * EL TIEMPO ES EL EJE X. Las barras se posicionan por su hora real, así que:
 *   · la jornada partida se VE como dos barras con un agujero físico en medio
 *   · el turno nocturno se VE cruzando el borde del día
 *   · el solape se VE como dos barras pisándose
 * Se ve. No hay que leerlo.
 *
 * ⚠️ Y NADA SE TRUNCA. NUNCA. NI EL NOMBRE NI LA HORA.
 */
const props = defineProps({
    person: { type: Object, required: true },
    // Turnos Y conceptos horarios de esta persona ese día: los dos la ocupan físicamente, y
    // por eso van en el mismo carril. Así se VE que la hora médica de las 10 cae dentro del
    // turno de 9 a 17, en vez de haber que buscarla en otra fila.
    blocks: { type: Array, required: true },
    axis: { type: Object, required: true },
    // El informe entero (assignments + conceptEntries), o null mientras no ha llegado.
    // null NO significa "sin incidencias".
    violations: { type: Object, default: null },
    // La CELDA ya grita el imposible en un cartel rojo, arriba. Entonces el carril no lo repite.
    celdaGrita: { type: Boolean, default: false },
});

/**
 * ⚠️ 10 px, Y LOS DOS DE MÁS SON PARA QUE EL RELLENO SIGA DICIENDO DE QUIÉN ES.
 *
 * Con 8 px, un borde de gravedad de 2 px arriba y 2 abajo dejaba CUATRO píxeles de relleno: la
 * barra de Sara —forzada y con descanso corto— era un borrón marrón del que ya no se sacaba su
 * color. El canal del borde se estaba comiendo al de la identidad, que es exactamente lo que la
 * ley 0 prohíbe: dos preguntas peleándose por el mismo sitio.
 *
 * Los tests estaban en verde —el borde era el color correcto y el relleno también— y la barra
 * era ilegible igual. Se vio al MIRARLA.
 */
const ALTO = 10;
const HUECO = 2;

/**
 * EL REPARTO EN SUB-CARRILES ES GEOMÉTRICO Y NO JUZGA NADA:
 *
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

/** Lo que la matriz dice de cada bloque. Una sola llamada, y de ahí sale TODO lo que se pinta. */
const pintados = computed(() => repartidos.value.bloques.map((block) => ({
    key: `${block.kind}-${block.id}`,
    block,
    ...pintarBloque(block, {
        person: props.person,
        violations: props.violations,
        celdaGrita: props.celdaGrita,
    }),
})));

/** La gravedad del carril entero: la peor de todo lo que hay dentro. Turnos Y conceptos. */
const laneSeverity = computed(() => worst(
    props.blocks.flatMap((b) => violacionesDe(b, props.violations)),
));

const tambienEnOtraEmpresa = computed(() => props.blocks
    .flatMap((b) => violacionesDe(b, props.violations))
    .some((v) => v.code === 'shared_workday'));

const notas = computed(() => {
    const vistas = new Set();

    return pintados.value
        .flatMap((p) => p.notas)
        .filter((n) => !vistas.has(n.text) && vistas.add(n.text));
});

const barraStyle = (p) => ({
    ...p.relleno,
    position: 'absolute',
    left: `${p.block.left}%`,
    width: `${p.block.width}%`,
    top: `${(p.block.subcarril ?? 0) * (ALTO + HUECO)}px`,
    height: `${ALTO}px`,
    // Un turno de media hora sigue siendo un turno: por estrecho que sea, se ve.
    minWidth: '3px',
    borderRadius: '3px',
});

/** La muestra del rótulo usa EXACTAMENTE el mismo relleno que su barra. Por eso se emparejan. */
const muestraStyle = (p) => ({
    ...p.relleno,
    width: '10px',
    height: '7px',
    borderRadius: '2px',
    flexShrink: 0,
});

/** El tooltip: aquí SÍ va todo, sin recortar. Se pide, no se impone. */
const title = computed(() => {
    const partes = [`${props.person.name} · ${pintados.value.map((p) => p.rotulo.hora).join('   ·   ')}`];

    for (const block of props.blocks) {
        for (const v of violacionesDe(block, props.violations)) {
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
                    data-t="avatar"
                    :data-persona="person.name"
                    class="tabular flex h-4 w-4 items-center justify-center rounded-full text-[7.5px] font-semibold"
                    :style="{ background: person.color, color: tintaSobre(person.color) }"
                >{{ person.initials }}</span>

                <!-- Punto ámbar: ese día también trabaja en otro sitio. Se ve sin leer nada. -->
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

            <span
                v-if="laneSeverity"
                class="ml-0.5 shrink-0 text-[11px] leading-none"
                :style="{ color: severityColor(laneSeverity) }"
            >{{ severityIcon(laneSeverity) }}</span>
        </div>

        <!--
            TODO LO DE UNA PERSONA CUELGA DE UNA LÍNEA DE SU COLOR. Y ESO NO ES DECORACIÓN.

            Al dar una línea a cada barra, el carril PERDIÓ EL AGRUPAMIENTO: los rótulos quedaron
            flotando y había que deducir de quién eran POR PROXIMIDAD. En una parrilla que existe
            para saber QUIÉN está CUÁNDO, un horario sin dueño no es información: es un acertijo.
        -->
        <div class="ml-[7px] mt-[3px] border-l-2 pl-[9px]" :style="{ borderColor: person.color }">
            <div
                v-for="p in pintados"
                :key="p.key"
                data-t="rotulo"
                class="mt-[4px] flex items-start gap-[5px] first:mt-0"
            >
                <span class="relative mt-[4px] block" :style="muestraStyle(p)">
                    <span
                        v-if="p.forzado"
                        class="absolute left-0 top-0 h-0 w-0 border-l-[4px] border-t-[4px] border-l-white border-t-transparent"
                    />
                </span>

                <span class="min-w-0 flex-1">
                    <!--
                        LA HORA SE LEE. NO SE SUSURRA. Estaba en gris claro (contraste 3,4) debajo
                        de un nombre en negrita, y en una parrilla de turnos "¿a qué hora entra?"
                        se pregunta tanto como "¿quién es?".
                    -->
                    <span class="tabular block text-[10.5px] font-semibold leading-tight text-ink">
                        {{ p.rotulo.hora }}<span v-if="p.nocturno" class="ml-[3px] text-[9px]">☾</span>
                    </span>

                    <span
                        v-if="p.rotulo.pie"
                        class="mt-[1px] block break-words text-[9.5px] font-semibold leading-tight"
                        :style="{ color: BRAND_DARK }"
                    >◷ {{ p.rotulo.pie }}</span>
                </span>
            </div>

            <!--
                La pista va HUNDIDA respecto a la celda. Antes era gris clarito sobre blanco y se
                confundía con el fondo, con el borde y con la tira: el mismo gris haciendo cuatro
                trabajos. Aquí solo hace uno — decir por dónde va el día.
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
                <div v-for="p in pintados" :key="p.key" data-t="barra" :style="barraStyle(p)">
                    <!-- LA MUESCA: se forzó. Una decisión tomada, no un aviso desatendido. -->
                    <span
                        v-if="p.forzado"
                        data-t="muesca"
                        class="absolute left-0 top-0 h-0 w-0 border-l-[5px] border-t-[5px] border-l-white border-t-transparent"
                    />

                    <!-- EL FILO: cruza medianoche. "Sigue mañana." -->
                    <span
                        v-if="p.nocturno"
                        data-t="filo-noche"
                        class="absolute right-0 top-0 h-full w-[3px] rounded-r-[2px] bg-ink"
                    />
                </div>
            </div>

            <div
                v-for="(nota, i) in notas"
                :key="i"
                data-t="nota"
                class="mt-[5px] flex items-start gap-[5px] text-[9.5px] font-semibold leading-tight"
                :style="{ color: nota.color }"
            >
                <span
                    v-if="nota.dot"
                    class="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full"
                    :style="{ background: nota.color }"
                />
                <span class="min-w-0 break-words">{{ nota.text }}</span>
            </div>
        </div>
    </div>
</template>
