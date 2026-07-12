<script setup>
import { gridEvery } from '../../composables/useAxis.js';

/**
 * LA TIRA DE COBERTURA. Se pinta EL DÍA ENTERO, no solo lo que está mal.
 *
 * ⚠️ Y SE PINTA CON COLORES QUE SE VEN.
 *
 * El verde iba a rgba(21,128,61,.18) sobre un gris claro: el color que salía de esa mezcla
 * era #DDE6DE — o sea, UN GRIS. Los 27 tramos verdes estaban en el DOM y en la pantalla no
 * había ni uno. Medí el array y no el píxel.
 *
 * Y el verde NO es decorativo: es lo que da ESTRUCTURA al día. Sin él, cada celda es un
 * rectángulo gris indistinguible del de al lado; con él, se ve de un vistazo qué está
 * resuelto y qué no. Es la única fila de la celda que se lee sin leer.
 *
 * El hueco se pinta DONDE OCURRE: "de 12 a 16 faltan 3; de 16 a 20 faltan 2". Decir que
 * falta gente todo el sábado sería un aviso falso, y un aviso falso entrena a ignorar los
 * avisos.
 */
const props = defineProps({
    segments: { type: Array, required: true },
    axis: { type: Object, required: true },
    // En el zoom Día hay sitio: "faltan 2" en vez de "-2".
    wide: { type: Boolean, default: false },
});

const ESTILO = {
    covered: { bg: 'var(--color-ok-fill)', border: 'var(--color-ok)', color: '#0F5C2C' },
    missing: { bg: 'var(--color-missing-fill)', border: 'var(--color-missing)', color: '#9E1616' },
    excess: { bg: 'var(--color-excess-fill)', border: 'var(--color-brand-300)', color: 'var(--color-brand-600)' },
    // Rayado, NO rojo. Un hueco rojo dice "ponle a alguien", y aquí no hay a quién poner:
    // el problema no está en el cuadrante, está en el catálogo.
    uncoverable: {
        bg: 'repeating-linear-gradient(45deg, var(--color-void-fill) 0 5px, #EFEDF5 5px 10px)',
        border: '#8A8699',
        color: '#57536A',
    },
};

const style = (s) => ({
    position: 'absolute',
    left: `${s.left}%`,
    width: `${s.width}%`,
    top: 0,
    bottom: 0,
    boxSizing: 'border-box',
    background: ESTILO[s.state].bg,
    borderTop: `2px solid ${ESTILO[s.state].border}`,
});

const label = (s) => {
    if (s.state === 'uncoverable') {
        return props.wide ? 'sin candidato' : 'sin cand.';
    }
    if (s.state === 'missing') {
        return props.wide ? `faltan ${s.missing}` : `-${s.missing}`;
    }
    if (s.state === 'excess') {
        return props.wide ? `sobra${s.excess > 1 ? 'n' : ''} ${s.excess}` : `+${s.excess}`;
    }
    // El tramo correcto no lleva número: el verde ya lo dice, y un "0" sería ruido.
    return '';
};

const tip = (s) => `${s.label} · pide ${s.required}, hay ${s.covered}`;
</script>

<template>
    <div
        class="relative overflow-hidden rounded-sm bg-sunken"
        :class="wide ? 'h-[18px]' : 'h-[15px]'"
        :style="{
            backgroundImage: 'linear-gradient(90deg, rgb(255 255 255 / 55%) 1px, transparent 1px)',
            backgroundSize: gridEvery(axis, wide ? 3 : 6),
        }"
    >
        <div v-for="(s, i) in segments" :key="i" :style="style(s)" :title="tip(s)" />

        <span
            v-for="(s, i) in segments"
            :key="`l${i}`"
            class="tabular pointer-events-none absolute top-0 truncate text-center font-bold"
            :class="wide ? 'text-[10px] leading-[18px]' : 'text-[10px] leading-[15px]'"
            :style="{ left: `${s.left}%`, width: `${s.width}%`, color: ESTILO[s.state].color }"
        >{{ label(s) }}</span>
    </div>
</template>
