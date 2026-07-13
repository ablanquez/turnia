<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { gridEvery } from '../../composables/useAxis.js';
import { pintarTramo } from '../../composables/useMatrizVisual.js';

/**
 * LA TIRA DE COBERTURA. Se pinta EL DÍA ENTERO, no solo lo que está mal.
 *
 * ⚠️ ESTE COMPONENTE NO DECIDE NI UN SOLO COLOR: los pide (useMatrizVisual) y los pinta.
 *
 * El verde NO es decorativo: es lo que da ESTRUCTURA al día. Sin él, cada celda es un
 * rectángulo gris indistinguible del de al lado; con él, se ve de un vistazo qué está resuelto
 * y qué no. Es la única fila de la celda que se lee sin leer.
 *
 * Y el hueco se pinta DONDE OCURRE: "de 12 a 16 faltan 3; de 16 a 20 faltan 2". Decir que falta
 * gente todo el sábado sería un aviso falso, y un aviso falso entrena a ignorar los avisos.
 */
const props = defineProps({
    segments: { type: Array, required: true },
    axis: { type: Object, required: true },
    // En el zoom Día hay sitio: "faltan 2" en vez de "-2".
    wide: { type: Boolean, default: false },
});

const pintados = computed(() => props.segments.map((s) => ({ s, ...pintarTramo(s) })));

/**
 * ⚠️ NUNCA SE RECORTA UN DATO AL PINTARLO, ASÍ QUE SE MIDE EL SITIO QUE HAY.
 *
 * Aquí ponía `truncate` y en un tramo estrecho salía "sin…": ilegible Y sin el número. Ahora se
 * BAJA DE ESCALÓN — la frase entera, la cifra sola, o nada — y jamás se corta por la mitad.
 */
const tira = ref(null);
const ancho = ref(0);

let observador = null;

onMounted(() => {
    if (!tira.value) {
        return;
    }

    observador = new ResizeObserver(([e]) => {
        ancho.value = e.contentRect.width;
    });

    observador.observe(tira.value);
    ancho.value = tira.value.getBoundingClientRect().width;
});

onBeforeUnmount(() => observador?.disconnect());

/*
 * 10 px en IBM Plex Mono: ~6,1 px por carácter.
 *
 * ⚠️ EL NÚMERO NO CABE EN EL TRAMO: SE CENTRA SOBRE ÉL, CON SU PROPIO AIRE. El "-1" del
 * sumiller vive en un tramo de 3 h, que en la semana son 17 px. Encajonado ahí quedaba diminuto
 * y besando los bordes. Ahora el rótulo NO está confinado al ancho del tramo: se centra en su
 * punto medio y se extiende lo que necesite (a los lados solo hay tira vacía).
 */
const cabe = (texto, s) => texto.length * 6.1 <= (s.width / 100) * ancho.value + 14;

const label = (p) => {
    const opciones = props.wide ? p.escalones : p.escalones.slice(1);

    return opciones.find((texto) => cabe(texto, p.s)) ?? '';
};

const style = (p) => ({
    ...p.estilo,
    position: 'absolute',
    left: `${p.s.left}%`,
    width: `${p.s.width}%`,
    top: 0,
    bottom: 0,
});
</script>

<template>
    <!--
        Los data-t son ganchos para los instrumentos visuales: le dicen DÓNDE mirar. Lo que
        miden —color, geometría, texto pintado, contraste— se lo siguen preguntando al
        NAVEGADOR, nunca a estos atributos.
    -->
    <div
        ref="tira"
        data-t="tira"
        class="relative overflow-hidden rounded-sm bg-sunken"
        :class="wide ? 'h-[18px]' : 'h-[15px]'"
        :style="{
            backgroundImage: 'linear-gradient(90deg, rgb(255 255 255 / 55%) 1px, transparent 1px)',
            backgroundSize: gridEvery(axis, wide ? 3 : 6),
        }"
    >
        <div
            v-for="(p, i) in pintados"
            :key="i"
            data-t="tramo"
            :data-estado="p.s.state"
            :style="style(p)"
            :title="p.tip"
        />

        <!--
            Centrado sobre el PUNTO MEDIO del tramo y con ancho propio, no encajonado en él.

            ⚠️ SIN VELO POR DETRÁS. Le puse uno para que el número no compitiera con las rayas
            del "sin candidato", y en un tramo de 17 px el velo TAPABA las rayas: arreglé la
            mitad del mensaje rompiendo la otra. Ahora las rayas son discretas y el número va
            más oscuro. Las dos cosas se ven.
        -->
        <span
            v-for="(p, i) in pintados"
            :key="`l${i}`"
            v-show="label(p)"
            data-t="tramo-rotulo"
            class="tabular pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-sm px-[3px] text-center text-[10px] font-bold"
            :class="wide ? 'leading-[18px]' : 'leading-[15px]'"
            :style="{ left: `${p.s.left + p.s.width / 2}%`, color: p.tinta }"
        >{{ label(p) }}</span>
    </div>
</template>
